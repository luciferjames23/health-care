import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers import lab_critical_alerts as api
from services import lab_critical_alert_service as service


class CreationCursor:
    def __init__(self, event=None, alert_id=9):
        self.event = event
        self.alert_id = alert_id
        self.sql = []
        self.current = None

    def execute(self, sql, params=None):
        compact = " ".join(sql.split())
        self.sql.append(compact)
        if "FROM lab_critical_evaluation_events ev" in compact:
            self.current = self.event
        elif "INSERT INTO lab_critical_alerts" in compact:
            self.current = {"alert_id": self.alert_id} if self.alert_id else None
        else:
            self.current = None

    def fetchone(self):
        result, self.current = self.current, None
        return result


def event(**updates):
    row = {
        "evaluation_event_id": 80, "outcome": "CRITICAL_MATCH", "lab_result_id": 70,
        "rule_id": 4, "rule_version": 2, "parameter_name": "QA", "result_value_text": "9",
        "unit": "qa-u", "normalized_result_instant": "2026-10-09T10:00:00Z",
        "result_order_id": 60, "result_patient_id": 50, "patient_row_id": 50, "order_patient_id": 50,
        "doctor_user_id": 20, "doctor_status": "ACTIVE", "doctor_user_active": True,
        "doctor_user_role": "Doctor",
    }
    row.update(updates)
    return row


class CriticalAlertCreationTests(unittest.TestCase):
    def test_only_critical_match_creates_alert(self):
        cur = CreationCursor(event=event(outcome="NOT_CRITICAL"))
        self.assertFalse(service.create_alert_for_evaluation_event(cur, 80))
        self.assertFalse(any("INSERT INTO lab_critical_alerts" in sql for sql in cur.sql))

    def test_linkage_mismatch_is_rejected(self):
        cur = CreationCursor(event=event(order_patient_id=999))
        with self.assertRaisesRegex(ValueError, "linkage"):
            service.create_alert_for_evaluation_event(cur, 80)
        self.assertFalse(any("INSERT INTO lab_critical_alerts" in sql for sql in cur.sql))

    def test_alert_snapshot_and_ordering_doctor_recipient_are_inserted(self):
        cur = CreationCursor(event=event())
        self.assertTrue(service.create_alert_for_evaluation_event(cur, 80))
        self.assertTrue(any("INSERT INTO lab_critical_alert_recipients" in sql for sql in cur.sql))
        self.assertTrue(any("'OPENED'" in sql for sql in cur.sql))
        insert = next(sql for sql in cur.sql if "INSERT INTO lab_critical_alerts" in sql)
        self.assertIn("ON CONFLICT (evaluation_event_id) DO NOTHING", insert)

    def test_active_doctor_status_is_case_and_whitespace_insensitive(self):
        for doctor_status in ("ACTIVE", "Active", "active", " Active ", "  aCtIvE  "):
            with self.subTest(doctor_status=doctor_status):
                cur = CreationCursor(event=event(doctor_status=doctor_status))
                self.assertTrue(service.create_alert_for_evaluation_event(cur, 80))
                self.assertTrue(any("INSERT INTO lab_critical_alert_recipients" in sql for sql in cur.sql))

    def test_inactive_doctor_status_never_gets_recipient(self):
        for doctor_status in ("INACTIVE", "Inactive", " inactive ", "DISABLED", ""):
            with self.subTest(doctor_status=doctor_status):
                cur = CreationCursor(event=event(doctor_status=doctor_status))
                self.assertTrue(service.create_alert_for_evaluation_event(cur, 80))
                self.assertFalse(any("INSERT INTO lab_critical_alert_recipients" in sql for sql in cur.sql))

    def test_unresolved_doctor_creates_unresolved_alert_without_fallback(self):
        cur = CreationCursor(event=event(doctor_user_active=False))
        self.assertTrue(service.create_alert_for_evaluation_event(cur, 80))
        self.assertFalse(any("INSERT INTO lab_critical_alert_recipients" in sql for sql in cur.sql))

    def test_duplicate_alert_does_not_append_second_opened_event(self):
        cur = CreationCursor(event=event(), alert_id=None)
        self.assertFalse(service.create_alert_for_evaluation_event(cur, 80))
        self.assertFalse(any("INSERT INTO lab_critical_alert_lifecycle_events" in sql for sql in cur.sql))

    def test_creation_never_writes_lab_source_tables_or_generic_notifications(self):
        cur = CreationCursor(event=event())
        service.create_alert_for_evaluation_event(cur, 80)
        self.assertFalse(any(
            ("UPDATE lab_results" in sql or "UPDATE lab_orders" in sql or
             "INSERT INTO notifications" in sql or "escalations" in sql)
            for sql in cur.sql
        ))


class TransitionCursor:
    def __init__(self, alert=None):
        self.alert = alert
        self.sql = []
        self.current = None

    def execute(self, sql, params=None):
        compact = " ".join(sql.split())
        self.sql.append((compact, params))
        if "SELECT a.alert_id, a.status" in compact:
            self.current = self.alert
        else:
            self.current = None

    def fetchone(self):
        result, self.current = self.current, None
        return result


class CriticalAlertTransitionTests(unittest.TestCase):
    def test_authentication_is_required(self):
        with self.assertRaises(HTTPException) as raised:
            api.require_alert_user(None)
        self.assertEqual(raised.exception.status_code, 401)

    def test_front_office_is_denied_by_database_role(self):
        conn = MagicMock()
        cur = MagicMock()
        cur.fetchone.return_value = {"user_id": 5, "is_active": True, "role": "Front Office", "display_name": "Staff"}
        conn.cursor.return_value = cur
        with patch.object(api, "decode_token", return_value={"user_id": 5}), \
             patch.object(api.db_connector, "get_connection", return_value=conn):
            with self.assertRaises(HTTPException) as raised:
                api.require_alert_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid"))
        self.assertEqual(raised.exception.status_code, 403)

    def test_doctor_list_read_is_scoped_to_assigned_alerts(self):
        cursor = TransitionCursor()
        cursor.fetchall = lambda: []
        conn = MagicMock()
        app = FastAPI()
        app.include_router(api.router)
        app.dependency_overrides[api.require_alert_user] = lambda: {"user_id": 23, "role": "Doctor"}
        with patch.object(api.db_connector, "get_connection", return_value=conn), \
             patch.object(api.db_connector, "get_dict_cursor", return_value=cursor):
            response = TestClient(app).get("/api/v1/clinical-ops/lab-critical-alerts")
        self.assertEqual(response.status_code, 200)
        sql, params = cursor.sql[0]
        self.assertIn("recipient_user_id=%s", sql)
        self.assertEqual(params, (23, 200, 0))

    def test_admin_cannot_acknowledge_by_role_alone(self):
        with self.assertRaises(HTTPException) as raised:
            api._transition(1, {"user_id": 2, "role": "Admin"}, "ACKNOWLEDGED")
        self.assertEqual(raised.exception.status_code, 403)

    def test_nonrecipient_cannot_acknowledge(self):
        cursor = TransitionCursor(alert=None)
        conn = MagicMock()
        with patch.object(api.db_connector, "get_connection", return_value=conn), \
             patch.object(api.db_connector, "get_dict_cursor", return_value=cursor):
            with self.assertRaises(HTTPException) as raised:
                api._transition(1, {"user_id": 2, "role": "Doctor"}, "ACKNOWLEDGED")
        self.assertEqual(raised.exception.status_code, 404)
        conn.rollback.assert_called_once()

    def test_repeated_acknowledgement_is_rejected(self):
        cursor = TransitionCursor(alert={"alert_id": 1, "status": "ACKNOWLEDGED"})
        conn = MagicMock()
        with patch.object(api.db_connector, "get_connection", return_value=conn), \
             patch.object(api.db_connector, "get_dict_cursor", return_value=cursor):
            with self.assertRaises(HTTPException) as raised:
                api._transition(1, {"user_id": 2, "role": "Doctor"}, "ACKNOWLEDGED")
        self.assertEqual(raised.exception.status_code, 409)
        self.assertFalse(any("INSERT INTO lab_critical_alert_lifecycle_events" in sql for sql, _ in cursor.sql))

    def test_open_to_acknowledged_and_acknowledged_to_closed(self):
        for target, current, params in [
            ("ACKNOWLEDGED", "OPEN", {"user_id": 2, "role": "Doctor"}),
            ("CLOSED", "ACKNOWLEDGED", {"user_id": 2, "role": "Doctor"}),
        ]:
            cursor = TransitionCursor(alert={"alert_id": 1, "status": current})
            conn = MagicMock()
            with patch.object(api.db_connector, "get_connection", return_value=conn), \
                 patch.object(api.db_connector, "get_dict_cursor", return_value=cursor):
                response = api._transition(1, params, target, "Reviewed and documented" if target == "CLOSED" else None)
            self.assertEqual(response["status"], target)
            self.assertTrue(any("INSERT INTO lab_critical_alert_lifecycle_events" in sql for sql, _ in cursor.sql))
            conn.commit.assert_called_once()

    def test_close_before_acknowledgement_is_rejected(self):
        cursor = TransitionCursor(alert={"alert_id": 1, "status": "OPEN"})
        conn = MagicMock()
        with patch.object(api.db_connector, "get_connection", return_value=conn), \
             patch.object(api.db_connector, "get_dict_cursor", return_value=cursor):
            with self.assertRaises(HTTPException) as raised:
                api._transition(1, {"user_id": 2, "role": "Doctor"}, "CLOSED", "Reason")
        self.assertEqual(raised.exception.status_code, 409)
        self.assertFalse(any(sql.startswith("UPDATE lab_critical_alerts") for sql, _ in cursor.sql))

    def test_closure_reason_is_required_and_nonblank(self):
        with self.assertRaises(Exception):
            api.CloseBody(reason=" ")
        self.assertEqual(api.CloseBody(reason=" reviewed ").reason, "reviewed")


class AlertMigrationTests(unittest.TestCase):
    def test_migration_has_idempotency_linkage_and_append_only_guards(self):
        migration = Path(__file__).resolve().parents[1] / "migrations" / "041_ag10_lab_critical_alerts.sql"
        sql = migration.read_text(encoding="utf-8").lower()
        self.assertIn("unique references lab_critical_evaluation_events", sql)
        self.assertIn("requires a critical_match evaluation event", sql)
        self.assertIn("before update or delete on lab_critical_alert_lifecycle_events", sql)
        self.assertIn("before truncate on lab_critical_alert_lifecycle_events", sql)
        self.assertIn("open','acknowledged','closed", sql)
        self.assertNotIn("update lab_results set", sql)
        self.assertNotIn("update lab_orders set", sql)
        self.assertNotIn("insert into notifications", sql)


if __name__ == "__main__":
    unittest.main()
