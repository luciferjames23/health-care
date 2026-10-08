import os
import sys
import unittest
from unittest.mock import MagicMock
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.vital_signs_service import create_confirmed_soap_vital


class SoapVitalsPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.note = {"soap_note_id": 81, "patient_id": 142908, "visit_id": 277208, "admission_id": 87508}

    def test_confirmed_spoken_vitals_write_sparse_provenance_rows(self):
        cases = [
            ({"finding_type": "TEMPERATURE", "value": 101, "unit": "F"}, "temperature", 101),
            ({"finding_type": "BLOOD_PRESSURE", "systolic": 130, "diastolic": 80, "unit": "mmHg"}, "systolic_bp", 130),
            ({"finding_type": "PULSE", "value": 96, "unit": "bpm"}, "heart_rate", 96),
            ({"finding_type": "SPO2", "value": 98, "unit": "%"}, "oxygen_saturation", 98),
        ]
        for action_values, expected_column, expected_value in cases:
            with self.subTest(kind=action_values["finding_type"]):
                cur = MagicMock()
                action_id = uuid4()
                cur.fetchone.side_effect = [None, ("MER-PAT-0142908",), (991, "recorded")]
                target, existing = create_confirmed_soap_vital(
                    cur, self.note, {"action_id": action_id, **action_values}, clinician_id=6
                )
                self.assertFalse(existing)
                self.assertEqual(target["vital_id"], 991)
                insert = next(call for call in cur.execute.call_args_list if "INSERT INTO vital_signs" in call.args[0])
                sql = insert.args[0]
                values = insert.args[1]
                self.assertIn("recorded_by", sql)
                self.assertIn("source_soap_note_id", sql)
                self.assertEqual(values[0:5], (142908, "MER-PAT-0142908", 277208, 87508, 6))
                self.assertEqual(values[-2:], (81, str(action_id)))
                self.assertIn(expected_value, values)
                self.assertEqual(sql.count("INSERT INTO vital_signs"), 1)

    def test_retry_returns_existing_source_action_without_insert(self):
        cur = MagicMock()
        cur.fetchone.return_value = (991,)
        action_id = uuid4()
        result, existing = create_confirmed_soap_vital(
            cur, self.note, {"action_id": action_id, "finding_type": "PULSE", "value": 96, "unit": "bpm"},
            clinician_id=6,
        )
        self.assertTrue(existing)
        self.assertEqual(result["vital_id"], 991)
        cur.execute.assert_called_once_with("SELECT vital_id FROM vital_signs WHERE source_action_id=%s", (str(action_id),))

    def test_celsius_is_not_silently_written_as_fahrenheit(self):
        cur = MagicMock()
        with self.assertRaisesRegex(ValueError, "Celsius was not converted"):
            create_confirmed_soap_vital(cur, self.note,
                {"action_id": uuid4(), "finding_type": "TEMPERATURE", "value": 38, "unit": "C"}, clinician_id=6)
        cur.execute.assert_not_called()


if __name__ == "__main__":
    unittest.main()
