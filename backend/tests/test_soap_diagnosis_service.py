import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.soap_diagnosis_service import create_confirmed_diagnosis


class SoapDiagnosisPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.note = {"soap_note_id": 22, "patient_id": 142908, "visit_id": 277208,
                     "admission_id": 87508}
        self.action = {"action_id": "7dabf451-a636-4514-b863-0d69d111f338",
                       "name": "Acute febrile illness", "code": "R50.9"}

    def test_confirmed_diagnosis_writes_patient_visit_and_ag17_provenance(self):
        cur = MagicMock()
        cur.fetchone.side_effect = [None, (9001,), (9001,)]
        record, idempotent = create_confirmed_diagnosis(cur, self.note, self.action, doctor_id=6)
        self.assertFalse(idempotent)
        self.assertEqual(record["diagnosis_id"], 9001)
        insert = next(call for call in cur.execute.call_args_list if "INSERT INTO diagnoses" in call.args[0])
        self.assertEqual(insert.args[1], (9001, 142908, 277208, 87508, 6, "R50.9",
                                         "Acute febrile illness", 22, self.action["action_id"]))
        self.assertIn("FALSE,'AG17'", insert.args[0])

    def test_repeat_returns_existing_source_action_without_duplicate_insert(self):
        cur = MagicMock()
        cur.fetchone.return_value = (9001,)
        record, idempotent = create_confirmed_diagnosis(cur, self.note, self.action, doctor_id=6)
        self.assertTrue(idempotent)
        self.assertEqual(record["diagnosis_id"], 9001)
        self.assertEqual(cur.execute.call_count, 1)


if __name__ == "__main__":
    unittest.main()
