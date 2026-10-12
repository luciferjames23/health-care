import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers import clinical_operations as clinical


class LabCollectionEventTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(clinical.router)
        self.app.dependency_overrides[clinical.require_laboratory_collection_writer] = lambda: {
            "user_id": 44, "role": "Laboratory", "name": "Lab User"
        }
        self.app.dependency_overrides[clinical.require_authenticated_lab_reader] = lambda: {
            "user_id": 52, "role": "Doctor"
        }
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        patch.stopall()

    @staticmethod
    def db_mock(fetchone_values, fetchall_values=None):
        conn = MagicMock()
        cur = MagicMock()
        cur.fetchone.side_effect = fetchone_values
        cur.fetchall.return_value = fetchall_values or []
        conn.cursor.return_value = cur
        patch.object(clinical.db_connector, "get_dict_cursor", lambda _conn: cur).start()
        patch.object(clinical.db_connector, "get_connection", lambda: conn).start()
        return conn, cur

    def test_laboratory_write_allowed_and_actor_context_is_server_derived(self):
        recorded = datetime(2026, 10, 9, 8, 30, tzinfo=timezone.utc)
        event = {
            "event_id": 8, "lab_order_id": 73, "patient_id": 19,
            "collection_state": "COLLECTED", "recorded_at": recorded,
            "actor_user_id": 44, "actor_role": "Laboratory", "actor_name": "Lab User",
            "source_type": "MANUAL_LAB_ENTRY",
        }
        corrected = {**event, "event_id": 9, "collection_state": "NOT_COLLECTED"}
        conn, cur = self.db_mock([
            {"lab_order_id": 73, "patient_id": 19}, event,
            {"lab_order_id": 73, "patient_id": 19}, corrected,
        ])
        response = self.client.post("/api/v1/clinical-ops/labs/73/collection-events", json={
            "collection_state": "COLLECTED", "source_type": "MANUAL_LAB_ENTRY",
            "actor_user_id": 999, "actor_role": "Doctor", "recorded_at": "2000-01-01T00:00:00Z",
            "patient_id": 999,
        })
        self.assertEqual(response.status_code, 422)
        response = self.client.post("/api/v1/clinical-ops/labs/73/collection-events", json={
            "collection_state": "COLLECTED", "source_type": "MANUAL_LAB_ENTRY",
        })
        self.assertEqual(response.status_code, 201)
        insert_call = next(call for call in cur.execute.call_args_list if "INSERT INTO lab_specimen_collection_events" in call.args[0])
        self.assertEqual(insert_call.args[1], (73, 19, "COLLECTED", 44, "Laboratory", "Lab User", "MANUAL_LAB_ENTRY"))
        second = self.client.post("/api/v1/clinical-ops/labs/73/collection-events", json={
            "collection_state": "NOT_COLLECTED",
        })
        self.assertEqual(second.status_code, 201)
        inserts = [call for call in cur.execute.call_args_list if "INSERT INTO lab_specimen_collection_events" in call.args[0]]
        self.assertEqual(len(inserts), 2)
        self.assertEqual(inserts[1].args[1][2], "NOT_COLLECTED")
        sql = " ".join(insert_call.args[0].split()).lower()
        self.assertNotIn("lab_orders set", sql)
        self.assertNotIn("lab_results", sql)
        self.assertEqual(conn.commit.call_count, 2)

    def test_non_laboratory_write_denied_by_writer_dependency(self):
        self.app.dependency_overrides.pop(clinical.require_laboratory_collection_writer)
        with patch.object(clinical, "decode_token", return_value={
            "user_id": 7, "auth_method": "password", "username": "doctor"
        }), patch.object(clinical.db_connector, "get_connection") as get_connection:
            conn = MagicMock()
            cur = MagicMock()
            cur.fetchone.return_value = {"user_id": 7, "is_active": True, "role": "Doctor", "name": "Doctor"}
            patch.object(clinical.db_connector, "get_dict_cursor", lambda _conn: cur).start()
            get_connection.return_value = conn
            with self.assertRaises(HTTPException) as raised:
                clinical.require_laboratory_collection_writer(MagicMock(credentials="valid"))
        self.assertEqual(raised.exception.status_code, 403)

    def test_authentication_required(self):
        with self.assertRaises(HTTPException) as raised:
            clinical.require_laboratory_collection_writer(None)
        self.assertEqual(raised.exception.status_code, 401)

    def test_valid_order_required(self):
        conn, _ = self.db_mock([None])
        response = self.client.post("/api/v1/clinical-ops/labs/999/collection-events", json={
            "collection_state": "COLLECTED",
        })
        self.assertEqual(response.status_code, 404)
        conn.rollback.assert_called_once()

    def test_batch_read_includes_empty_and_latest_event_and_requires_reader_dependency(self):
        event_time = datetime(2026, 10, 9, 9, tzinfo=timezone.utc)
        _, cur = self.db_mock([], [
            {"lab_order_id": 73, "patient_id": 19, "event_id": 3, "collection_state": "COLLECTED",
             "recorded_at": event_time, "actor_user_id": 44, "actor_role": "Laboratory",
             "actor_name": "Lab User", "source_type": "MANUAL_LAB_ENTRY"},
            {"lab_order_id": 74, "patient_id": 20, "event_id": None, "collection_state": None,
             "recorded_at": None, "actor_user_id": None, "actor_role": None,
             "actor_name": None, "source_type": None},
        ])
        response = self.client.get("/api/v1/clinical-ops/labs/collection-events/latest?lab_order_ids=73&lab_order_ids=74")
        self.assertEqual(response.status_code, 200)
        payload = response.json()["data"]
        self.assertEqual(payload[0]["latest_event"]["collection_state"], "COLLECTED")
        self.assertIsNone(payload[1]["latest_event"])
        sql = " ".join(cur.execute.call_args.args[0].split()).lower()
        self.assertIn("order by recorded_at desc, event_id desc", sql)

    def test_batch_read_rejects_missing_order_and_duplicate_ids(self):
        _, _ = self.db_mock([], [{"lab_order_id": 73, "patient_id": 19, "event_id": None,
                                 "collection_state": None, "recorded_at": None, "actor_user_id": None,
                                 "actor_role": None, "actor_name": None, "source_type": None}])
        response = self.client.get("/api/v1/clinical-ops/labs/collection-events/latest?lab_order_ids=73&lab_order_ids=74")
        self.assertEqual(response.status_code, 404)
        response = self.client.get("/api/v1/clinical-ops/labs/collection-events/latest?lab_order_ids=73&lab_order_ids=73")
        self.assertEqual(response.status_code, 422)

    def test_batch_read_uses_authorized_lab_reader_policy(self):
        self.app.dependency_overrides[clinical.require_authenticated_lab_reader] = lambda: (_ for _ in ()).throw(
            HTTPException(status_code=403, detail="Not authorized")
        )
        response = self.client.get("/api/v1/clinical-ops/labs/collection-events/latest?lab_order_ids=73")
        self.assertEqual(response.status_code, 403)

    def test_single_latest_read_and_no_event(self):
        self.db_mock([{"lab_order_id": 73, "patient_id": 19}, None])
        response = self.client.get("/api/v1/clinical-ops/labs/73/collection-events/latest")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["latest_event"])

    def test_no_update_or_delete_routes_and_migration_enforces_append_only(self):
        paths = [route.path for route in clinical.router.routes]
        self.assertNotIn("/api/v1/clinical-ops/labs/{lab_order_id}/collection-events/{event_id}", paths)
        migration = Path(__file__).resolve().parents[1] / "migrations" / "038_ag10_lab_collection_events.sql"
        sql = migration.read_text(encoding="utf-8").lower()
        self.assertIn("before update or delete", sql)
        self.assertIn("before truncate", sql)
        self.assertIn("on lab_specimen_collection_events(lab_order_id, recorded_at desc, event_id desc)", sql)

    def test_single_latest_query_is_deterministic_and_read_only(self):
        _, cur = self.db_mock([{"lab_order_id": 73, "patient_id": 19}, {
            "event_id": 5, "lab_order_id": 73, "collection_state": "COLLECTED",
            "recorded_at": datetime(2026, 10, 9, tzinfo=timezone.utc), "actor_user_id": 44,
            "actor_role": "Laboratory", "actor_name": "Lab User", "source_type": "MANUAL_LAB_ENTRY",
        }])
        response = self.client.get("/api/v1/clinical-ops/labs/73/collection-events/latest")
        self.assertEqual(response.status_code, 200)
        sql = " ".join(cur.execute.call_args_list[-1].args[0].split()).lower()
        self.assertIn("order by recorded_at desc, event_id desc", sql)
        self.assertNotIn("insert", sql)
        self.assertNotIn("update", sql)
        self.assertNotIn("delete", sql)


if __name__ == "__main__":
    unittest.main()
