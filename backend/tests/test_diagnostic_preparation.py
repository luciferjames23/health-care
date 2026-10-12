import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers import diagnostic_preparation as preparation
from api.auth_helper import encode_token


class DiagnosticPreparationApiTests(unittest.TestCase):
    order_id = uuid4()

    def make_client(self, role="Nurse"):
        app = FastAPI()
        app.include_router(preparation.router)
        app.dependency_overrides[preparation.get_authenticated_staff] = lambda: {
            "user_id": 17,
            "role": role,
            "name": "Test Staff",
        }
        return TestClient(app)

    @staticmethod
    def make_connection(fetchone=None, fetchall=None):
        connection = MagicMock()
        cursor = MagicMock()
        cursor.__enter__.return_value = cursor
        cursor.fetchone.side_effect = fetchone or []
        cursor.fetchall.return_value = fetchall or []
        connection.cursor.return_value = cursor
        return connection, cursor

    def test_nurse_write_allowed_and_identity_is_server_derived(self):
        evidence = {
            "evidence_id": 91,
            "assertion": "CONFIRMED",
            "last_meal_at": datetime(2026, 10, 9, 7, tzinfo=timezone.utc),
            "fasting_started_at": None,
            "source_type": "PATIENT_REPORT",
            "recorded_by_user_id": 17,
            "recorded_by_role": "Nurse",
            "recorded_by_name": "Test Staff",
            "recorded_at": datetime(2026, 10, 9, 9, tzinfo=timezone.utc),
        }
        connection, cursor = self.make_connection(
            fetchone=[{"order_id": self.order_id, "patient_id": 230}, evidence]
        )
        with patch.object(preparation.db_config, "get_db_connection", return_value=connection):
            response = self.make_client().post(
                f"/api/v1/diagnostic-coordination/orders/{self.order_id}/fasting-evidence",
                json={
                    "assertion": "CONFIRMED",
                    "last_meal_at": "2026-10-09T07:00:00Z",
                    "source_type": "PATIENT_REPORT",
                },
            )

        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        self.assertEqual(payload["patient_id"], 230)
        self.assertEqual(payload["evidence"]["recorded_by_user_id"], 17)
        insert_sql, insert_params = cursor.execute.call_args_list[1].args
        self.assertIn("INSERT INTO diagnostic_preparation_evidence", insert_sql)
        self.assertEqual(insert_params[0], self.order_id)
        self.assertEqual(insert_params[5:], (17, "Nurse", "Test Staff"))
        self.assertNotIn("patient_id", insert_sql)

    def test_non_nurse_write_denied(self):
        with patch.object(preparation.db_config, "get_db_connection") as get_connection:
            response = self.make_client("Doctor").post(
                f"/api/v1/diagnostic-coordination/orders/{self.order_id}/fasting-evidence",
                json={"assertion": "NOT_CONFIRMED", "source_type": "CHART_REVIEW"},
            )
        self.assertEqual(response.status_code, 403)
        get_connection.assert_not_called()

    def test_order_scope_is_taken_from_order_not_request_body(self):
        connection, cursor = self.make_connection(fetchone=[{"order_id": self.order_id, "patient_id": 456}])
        with patch.object(preparation.db_config, "get_db_connection", return_value=connection):
            response = self.make_client().post(
                f"/api/v1/diagnostic-coordination/orders/{self.order_id}/fasting-evidence",
                json={
                    "assertion": "NOT_CONFIRMED",
                    "source_type": "CHART_REVIEW",
                    "patient_id": 999,
                },
            )
        self.assertEqual(response.status_code, 422)
        cursor.execute.assert_not_called()

    def test_doctor_read_is_scoped_to_ordering_or_assigned_doctor(self):
        order = {
            "order_id": self.order_id,
            "patient_id": 230,
            "evidence_id": None,
            "assertion": None,
            "last_meal_at": None,
            "fasting_started_at": None,
            "source_type": None,
            "recorded_by_user_id": None,
            "recorded_by_role": None,
            "recorded_by_name": None,
            "recorded_at": None,
        }
        connection, cursor = self.make_connection(fetchall=[order])
        with patch.object(preparation.db_config, "get_db_connection", return_value=connection):
            response = self.make_client("Doctor").get(
                "/api/v1/diagnostic-coordination/fasting-evidence",
                params={"order_ids": str(self.order_id)},
            )
        self.assertEqual(response.status_code, 200, response.text)
        sql, params = cursor.execute.call_args.args
        self.assertIn("o.requested_by = %s", sql)
        self.assertIn("JOIN doctors d", sql)
        self.assertEqual(params, [[str(self.order_id)], 17, 17])

    def test_get_has_no_side_effects_and_returns_missing_evidence(self):
        order = {
            "order_id": self.order_id,
            "patient_id": 230,
            "evidence_id": None,
            "assertion": None,
            "last_meal_at": None,
            "fasting_started_at": None,
            "source_type": None,
            "recorded_by_user_id": None,
            "recorded_by_role": None,
            "recorded_by_name": None,
            "recorded_at": None,
        }
        connection, cursor = self.make_connection(fetchall=[order])
        with patch.object(preparation.db_config, "get_db_connection", return_value=connection):
            response = self.make_client().get(
                "/api/v1/diagnostic-coordination/fasting-evidence",
                params={"order_ids": str(self.order_id)},
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["data"][0]["latest_evidence"], None)
        executed_sql = [call.args[0].strip().upper() for call in cursor.execute.call_args_list]
        self.assertTrue(executed_sql)
        self.assertTrue(all(sql.startswith("SELECT") for sql in executed_sql))
        connection.commit.assert_not_called()
        connection.rollback.assert_not_called()

    def test_invalid_order_is_not_found(self):
        connection, _ = self.make_connection(fetchone=[None])
        with patch.object(preparation.db_config, "get_db_connection", return_value=connection):
            response = self.make_client().post(
                f"/api/v1/diagnostic-coordination/orders/{self.order_id}/fasting-evidence",
                json={"assertion": "NOT_CONFIRMED", "source_type": "CHART_REVIEW"},
            )
        self.assertEqual(response.status_code, 404)
        self.assertIn("not accessible", response.json()["detail"])

    def test_confirmation_requires_a_timezone_aware_meal_or_start_time(self):
        response = self.make_client().post(
            f"/api/v1/diagnostic-coordination/orders/{self.order_id}/fasting-evidence",
            json={"assertion": "CONFIRMED", "source_type": "PATIENT_REPORT"},
        )
        self.assertEqual(response.status_code, 422)

    def test_evidence_is_append_only(self):
        migration = Path(__file__).resolve().parents[1] / "migrations" / "037_ag10_diagnostic_preparation_evidence.sql"
        sql = migration.read_text(encoding="utf-8")
        self.assertIn("BEFORE UPDATE OR DELETE ON diagnostic_preparation_evidence", sql)
        self.assertIn("BEFORE TRUNCATE ON diagnostic_preparation_evidence", sql)
        methods = {
            method
            for route in preparation.router.routes
            for method in (route.methods or set())
        }
        self.assertEqual(methods, {"GET", "POST"})

    def test_authentication_is_required(self):
        app = FastAPI()
        app.include_router(preparation.router)
        with patch.dict(os.environ, {"RAG_DEV_MODE": "0"}):
            response = TestClient(app).get(
                "/api/v1/diagnostic-coordination/fasting-evidence",
                params={"order_ids": str(self.order_id)},
            )
        self.assertEqual(response.status_code, 401)

    def test_database_role_is_used_instead_of_token_role(self):
        app = FastAPI()
        app.include_router(preparation.router)
        app.dependency_overrides = {}
        connection, cursor = self.make_connection(fetchone=[(17, "Doctor", True, "Test Doctor")])
        connection.__enter__.return_value = connection
        token = encode_token({"user_id": 17, "username": "test", "role": "NURSE"})
        with patch.object(preparation.db_config, "get_db_connection", return_value=connection):
            response = TestClient(app).post(
                f"/api/v1/diagnostic-coordination/orders/{self.order_id}/fasting-evidence",
                headers={"Authorization": f"Bearer {token}"},
                json={"assertion": "NOT_CONFIRMED", "source_type": "CHART_REVIEW"},
            )
        self.assertEqual(response.status_code, 403)
        self.assertIn("Only authenticated Nurse", response.json()["detail"])
        cursor.execute.assert_called_once()


if __name__ == "__main__":
    unittest.main()
