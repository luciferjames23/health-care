import os
import sys
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import HTTPException
from routers import clinical_operations
from services import lab_demo_result_service as demo


class FakeDemoCursor:
    def __init__(self, *, status="Pending", test_code="LAB-01", test_name="CBC"):
        self.status = status
        self.test_code = test_code
        self.test_name = test_name
        self.results = []
        self.audit = []
        self.next_id = 900
        self.current = None
        self.description = []

    def execute(self, sql, params=None):
        compact = " ".join(sql.split())
        if "SELECT u.id, u.is_active, r.name AS role" in compact:
            self.current = {"id": 22, "is_active": True, "role": "Laboratory"}
        elif "SELECT lo.lab_order_id" in compact and "FOR UPDATE OF lo" in compact:
            self.current = {"lab_order_id": params[0], "patient_id": 300, "visit_id": 400,
                            "admission_id": 500, "lab_test_id": 2, "status": self.status,
                            "ordered_date": datetime(2026, 10, 7), "test_code": self.test_code,
                            "test_name": self.test_name}
        elif "SELECT lab_result_id, test_parameter" in compact:
            self.current = None
        elif compact.startswith("SELECT nextval"):
            self.next_id += 1
            self.current = (self.next_id,)
        elif "INSERT INTO lab_results" in compact:
            row = {"lab_result_id": params[0], "lab_order_id": params[1], "patient_id": params[2],
                   "test_parameter": params[3], "result_value": params[4], "unit": params[5],
                   "reference_range": params[6], "abnormal_flag": False,
                   "verification_status": "DEMO_GENERATED", "result_source": params[7],
                   "result_date": datetime(2026, 10, 7)}
            self.results.append(row)
            self.current = {"lab_result_id": params[0], "result_date": row["result_date"]}
        elif compact.startswith("UPDATE lab_orders SET status='Completed'"):
            self.status = "Completed"
            self.current = {"status": "Completed"}
        elif "INSERT INTO audit_logs" in compact:
            self.audit.append(params)
            self.current = None
        else:
            self.current = None

    def fetchone(self):
        row, self.current = self.current, None
        return row

    def fetchall(self):
        return list(self.results)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class DemoConnection:
    def __init__(self, cur):
        self.cur = cur
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def cursor(self):
        return self.cur

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


class LabDemoResultTests(unittest.TestCase):
    def setUp(self):
        self.actor = {"user_id": 22, "username": "lab.user", "auth_method": "password", "role": "Laboratory"}
        self.cur = FakeDemoCursor()
        self.conn = DemoConnection(self.cur)
        self.env = patch.dict(os.environ, {"AG17_LAB_DEMO_RESULTS_ENABLED": "true"})
        self.env.start()
        self.db_name = patch.object(demo.db_config, "DB_NAME", "live_test")
        self.db_name.start()

    def tearDown(self):
        self.env.stop()
        self.db_name.stop()

    def test_pending_cbc_creates_fixed_in_range_labeled_results_and_completes(self):
        result = demo.generate_demo_result(277233, self.actor, lambda: self.conn)
        self.assertEqual(result["status"], "Completed")
        self.assertEqual(result["result_source"], "DEMO_GENERATED")
        self.assertEqual(result["result_label"], "DEMO / SYNTHETIC RESULT")
        values = {row["test_parameter"]: (float(row["result_value"]), row["unit"]) for row in self.cur.results}
        self.assertGreaterEqual(values["Hemoglobin"][0], 11.5)
        self.assertLessEqual(values["Hemoglobin"][0], 15.5)
        self.assertGreaterEqual(values["WBC"][0], 4000)
        self.assertLessEqual(values["WBC"][0], 11000)
        self.assertGreaterEqual(values["Platelets"][0], 150000)
        self.assertLessEqual(values["Platelets"][0], 450000)
        self.assertTrue(all(row["result_source"] == "DEMO_GENERATED" for row in self.cur.results))
        self.assertEqual([row["parameter"] for row in result["results"]], ["Hemoglobin", "WBC", "Platelets"])
        self.assertEqual([params[1] for params in self.cur.audit], ["LAB_DEMO_RESULT_GENERATED", "LAB_ORDER_COMPLETED"])
        self.assertEqual(self.conn.commits, 1)

    def test_repeat_generation_reuses_existing_results_without_duplicates(self):
        first = demo.generate_demo_result(277233, self.actor, lambda: self.conn)
        self.assertEqual(first["status"], "Completed")
        self.cur.status = "Completed"
        second = demo.generate_demo_result(277233, self.actor, lambda: self.conn)
        self.assertTrue(second["idempotent_existing"])
        self.assertEqual(len(self.cur.results), 3)
        self.assertEqual(len(self.cur.audit), 2)

    def test_completed_without_result_cannot_generate(self):
        self.cur.status = "Completed"
        with self.assertRaises(HTTPException) as raised:
            demo.generate_demo_result(277233, self.actor, lambda: self.conn)
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(self.cur.results, [])

    def test_test_without_template_fails_safely(self):
        self.cur.test_code = "XYZ"
        self.cur.test_name = "Unconfigured Test"
        with self.assertRaises(HTTPException) as raised:
            demo.generate_demo_result(277233, self.actor, lambda: self.conn)
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(raised.exception.detail, "Demo result template not configured.")
        self.assertEqual(self.cur.results, [])
        self.assertEqual(self.cur.audit, [])

    def test_verified_laboratory_authorization_is_required(self):
        actor = {"user_id": 22, "username": "doc", "auth_method": "password"}
        self.cur.current = None
        original_execute = self.cur.execute
        def execute(sql, params=None):
            original_execute(sql, params)
            if "SELECT u.id, u.is_active, r.name AS role" in " ".join(sql.split()):
                self.cur.current = {"id": 22, "is_active": True, "role": "Doctor"}
        self.cur.execute = execute
        with self.assertRaises(HTTPException) as raised:
            demo.generate_demo_result(277233, actor, lambda: self.conn)
        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(self.cur.results, [])

    def test_clinical_ops_lab_api_returns_persisted_demo_source_for_patient_360(self):
        demo.generate_demo_result(277233, self.actor, lambda: self.conn)
        cur = MagicMock()
        conn = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cur
        cur.fetchone.return_value = {"total": 1}
        cur.fetchall.side_effect = [
            [{"lab_order_id": 277233, "patient_id": 300, "doctor_id": 6, "visit_id": 400,
              "admission_id": 500, "lab_test_id": 2, "ordered_date": datetime(2026, 10, 7),
              "priority": "Routine", "source": "AG17", "order_status": "Completed",
              "turnaround_minutes": 5, "test_code": "LAB-01", "test_name": "CBC",
              "test_category": "Hematology", "sample_type": "Blood", "standard_charge": 450,
              "doctor_name": "Lab Requesting Doctor", "patient_code": "TEST-PAT", "patient_name": "Test Patient"}],
            [{"lab_result_id": row["lab_result_id"], "lab_order_id": 277233, "patient_id": 300,
              "test_parameter": row["test_parameter"], "result_value": row["result_value"],
              "unit": row["unit"], "reference_range": row["reference_range"],
              "abnormal_flag": False, "verification_status": "DEMO_GENERATED",
              "result_date": datetime(2026, 10, 7), "verified_by": None,
              "result_source": "DEMO_GENERATED"} for row in self.cur.results],
        ]
        with patch.object(clinical_operations.db_connector, "get_connection", return_value=conn), \
             patch.object(clinical_operations.db_connector, "get_dict_cursor", return_value=cur):
            payload = clinical_operations.get_lab_orders(patient_id=300)
        order = payload["data"][0]
        self.assertEqual(order["status"], "Completed")
        self.assertEqual(order["source"], "AG17")
        self.assertEqual(order["results"][0]["result_source"], "DEMO_GENERATED")
        self.assertEqual(order["results"][0]["result_label"], "DEMO / SYNTHETIC RESULT")


if __name__ == "__main__":
    unittest.main()
