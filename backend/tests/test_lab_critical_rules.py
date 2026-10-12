import sys
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers import lab_critical_rules as rules


class LabCriticalRuleTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(rules.router)
        self.user = {"user_id": 17, "role": rules.AUTHOR_ROLE, "display_name": "Rule Author"}
        self.app.dependency_overrides[rules.require_rule_user] = lambda: self.user
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        patch.stopall()

    @staticmethod
    def make_db(fetchone=None, fetchall=None, execute_side_effect=None):
        conn = MagicMock()
        cur = MagicMock()
        cur.fetchone.side_effect = fetchone or []
        cur.fetchall.return_value = fetchall or []
        if execute_side_effect:
            cur.execute.side_effect = execute_side_effect
        conn.cursor.return_value = cur
        patch.object(rules.db_connector, "get_dict_cursor", lambda _conn: cur).start()
        patch.object(rules.db_connector, "get_connection", lambda: conn).start()
        return conn, cur

    @staticmethod
    def body(**overrides):
        result = {
            "parameter_name": "Creatinine",
            "test_identifier": "CREAT",
            "unit": "mg/dL",
            "operator": "GT",
            "threshold_value": "5.0",
            "effective_from": "2026-10-01T00:00:00Z",
            "effective_to": None,
            "is_active": True,
            "source_provenance": "Approved hospital policy reference",
            "change_reason": "Initial governed draft",
        }
        result.update(overrides)
        return result

    def test_draft_creation_assigns_version_and_creator_server_side(self):
        conn, cur = self.make_db(fetchone=[{"next_version": 3}, {"rule_id": 90, "rule_version": 3, "created_by": 17, "approval_status": "DRAFT"}])
        response = self.client.post("/api/v1/admin/lab-critical-rules", json=self.body())
        self.assertEqual(response.status_code, 201, response.text)
        insert = cur.execute.call_args_list[-1]
        self.assertIn("INSERT INTO lab_critical_rules", insert.args[0])
        self.assertEqual(insert.args[1][10:12], (3, 17))
        self.assertEqual(response.json()["rule"]["approval_status"], "DRAFT")
        conn.commit.assert_called_once()

    def test_submit_changes_only_a_draft_into_pending(self):
        conn, cur = self.make_db(fetchone=[{"rule_id": 90, "approval_status": "PENDING_APPROVAL"}])
        response = self.client.post("/api/v1/admin/lab-critical-rules/90/submit")
        self.assertEqual(response.status_code, 200)
        self.assertIn("created_by=%s AND approval_status='DRAFT'", cur.execute.call_args.args[0])
        self.assertEqual(cur.execute.call_args.args[1], (90, 17))
        conn.commit.assert_called_once()

    def test_approval_records_server_actor_and_time(self):
        self.user = {"user_id": 29, "role": rules.APPROVER_ROLE, "display_name": "Approver"}
        conn, cur = self.make_db(fetchone=[{"created_by": 17, "approval_status": "PENDING_APPROVAL"},
                                           {"rule_id": 90, "approval_status": "APPROVED", "approved_by": 29}])
        response = self.client.post("/api/v1/admin/lab-critical-rules/90/approve")
        self.assertEqual(response.status_code, 200, response.text)
        update = cur.execute.call_args_list[-1]
        self.assertIn("approved_by=%s, approved_at=%s", update.args[0])
        self.assertEqual(update.args[1][0], 29)
        self.assertIsInstance(update.args[1][1], datetime)
        self.assertEqual(update.args[1][1].tzinfo, timezone.utc)
        self.assertEqual(response.json()["rule"]["approval_status"], "APPROVED")
        conn.commit.assert_called_once()

    def test_author_cannot_approve_own_rule(self):
        _, cur = self.make_db(fetchone=[{"created_by": 17, "approval_status": "PENDING_APPROVAL"}])
        self.user = {"user_id": 17, "role": rules.APPROVER_ROLE, "display_name": "Same Person"}
        response = self.client.post("/api/v1/admin/lab-critical-rules/90/approve")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(cur.execute.call_count, 1)

    def test_reject_persists_reason_and_state(self):
        self.user = {"user_id": 29, "role": rules.APPROVER_ROLE, "display_name": "Approver"}
        conn, cur = self.make_db(fetchone=[{"created_by": 17, "approval_status": "PENDING_APPROVAL"},
                                           {"rule_id": 90, "approval_status": "REJECTED", "decision_reason": "Need review"}])
        response = self.client.post("/api/v1/admin/lab-critical-rules/90/reject", json={"reason": "Need review"})
        self.assertEqual(response.status_code, 200)
        update = cur.execute.call_args_list[-1]
        self.assertIn("approval_status='REJECTED'", update.args[0])
        self.assertEqual(update.args[1], ("Need review", 90))
        conn.commit.assert_called_once()

    def test_retire_only_changes_lifecycle_and_active_flag(self):
        self.user = {"user_id": 29, "role": rules.APPROVER_ROLE, "display_name": "Approver"}
        conn, cur = self.make_db(fetchone=[{"rule_id": 90, "approval_status": "RETIRED", "is_active": False}])
        response = self.client.post("/api/v1/admin/lab-critical-rules/90/retire")
        self.assertEqual(response.status_code, 200)
        sql = cur.execute.call_args.args[0]
        self.assertIn("SET approval_status='RETIRED', is_active=FALSE", sql)
        self.assertIn("approval_status='APPROVED'", sql)
        conn.commit.assert_called_once()

    def test_invalid_operator_bounds_and_effective_range_rejected(self):
        invalid = [
            self.body(operator="MAGIC"),
            self.body(operator="BETWEEN", threshold_value=None, lower_critical_bound="8", upper_critical_bound="2"),
            self.body(operator="GT", threshold_value=None, lower_critical_bound="1", upper_critical_bound="2"),
            self.body(effective_to="2026-09-30T00:00:00Z"),
            self.body(threshold_value="NaN"),
            self.body(effective_from="2026-10-01T00:00:00"),
        ]
        for payload in invalid:
            with self.subTest(payload=payload):
                response = self.client.post("/api/v1/admin/lab-critical-rules", json=payload)
                self.assertEqual(response.status_code, 422)

    def test_overlapping_approved_rule_is_rejected(self):
        self.user = {"user_id": 29, "role": rules.APPROVER_ROLE, "display_name": "Approver"}
        def execute(sql, params=None):
            if "UPDATE lab_critical_rules" in sql and "APPROVED" in sql:
                raise RuntimeError("An approved Lab critical rule already overlaps this parameter/unit interval")
        conn, _ = self.make_db(fetchone=[{"created_by": 17, "approval_status": "PENDING_APPROVAL"}], execute_side_effect=execute)
        response = self.client.post("/api/v1/admin/lab-critical-rules/90/approve")
        self.assertEqual(response.status_code, 409)
        conn.rollback.assert_called_once()

    def test_unauthorized_roles_and_broad_admin_cannot_approve(self):
        for role in ("admin", "system admin", "doctor", "laboratory"):
            with self.subTest(role=role):
                self.user = {"user_id": 8, "role": role, "display_name": "User"}
                response = self.client.post("/api/v1/admin/lab-critical-rules", json=self.body())
                self.assertEqual(response.status_code, 403)
                response = self.client.post("/api/v1/admin/lab-critical-rules/90/approve")
                self.assertEqual(response.status_code, 403)

    def test_authentication_required(self):
        from fastapi import HTTPException
        with self.assertRaises(HTTPException) as raised:
            rules.require_rule_user(None)
        self.assertEqual(raised.exception.status_code, 401)

    def test_submitted_versions_are_immutable_and_no_generic_edit_route_exists(self):
        migration = Path(__file__).resolve().parents[1] / "migrations" / "039_ag10_lab_critical_rules.sql"
        sql = migration.read_text(encoding="utf-8").lower()
        self.assertIn("submitted lab critical rule content is immutable", sql)
        self.assertIn("approved lab critical rule content is immutable", sql)
        self.assertIn("versions cannot be deleted", sql)
        paths = [(method, route.path) for route in rules.router.routes for method in route.methods]
        self.assertFalse(any(method in {"PUT", "PATCH", "DELETE"} for method, _ in paths))

    def test_overlap_trigger_and_approved_rule_interval_are_guarded_in_database(self):
        migration = Path(__file__).resolve().parents[1] / "migrations" / "039_ag10_lab_critical_rules.sql"
        sql = migration.read_text(encoding="utf-8").lower()
        self.assertIn("pg_advisory_xact_lock", sql)
        self.assertIn("existing.approval_status = 'approved'", sql)
        self.assertIn("new.effective_from < coalesce(existing.effective_to", sql)
        self.assertIn("existing.effective_from < coalesce(new.effective_to", sql)

    def test_rule_reads_and_detail(self):
        _, cur = self.make_db(fetchall=[{"rule_id": 90, "approval_status": "DRAFT"}])
        response = self.client.get("/api/v1/admin/lab-critical-rules")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rules"][0]["rule_id"], 90)
        self.assertIn("FROM lab_critical_rules", cur.execute.call_args.args[0])


if __name__ == "__main__":
    unittest.main()
