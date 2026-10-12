import sys
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers import lab_critical_rules as catalog
from services import lab_critical_evaluator as evaluator


NOW = datetime(2026, 10, 9, 10, tzinfo=timezone.utc)
RESULT_DATE = datetime(2026, 10, 9, 15, 30)  # local Asia/Calcutta wall time


def result(**updates):
    value = {
        "lab_result_id": 71, "test_parameter": "QA_ANALYTE", "test_identifier": "QA-T1",
        "result_value": "5", "unit": "qa-unit", "verification_status": "Verified",
        "result_source": None, "result_date": RESULT_DATE, "verified_by": 88,
    }
    value.update(updates)
    return value


def rule(**updates):
    value = {
        "rule_id": 12, "rule_version": 1, "parameter_name": "QA_ANALYTE",
        "test_identifier": "QA-T1", "unit": "qa-unit", "operator": "GT",
        "threshold_value": Decimal("4"), "lower_critical_bound": None,
        "upper_critical_bound": None, "approval_status": "APPROVED", "is_active": True,
        "effective_from": datetime(2026, 1, 1, tzinfo=timezone.utc), "effective_to": None,
        "source_provenance": "synthetic QA only",
    }
    value.update(updates)
    return value


class LabCriticalEvaluatorUnitTests(unittest.TestCase):
    def test_only_canonical_verified_non_demo_results_are_eligible(self):
        self.assertIsNone(evaluator.evaluate_snapshot(result(verification_status="Pending"), [rule()]))
        self.assertIsNone(evaluator.evaluate_snapshot(result(verification_status="verified"), [rule()]))
        self.assertIsNone(evaluator.evaluate_snapshot(result(result_source="DEMO_GENERATED"), [rule()]))
        self.assertEqual(evaluator.evaluate_snapshot(result(), [rule()])["outcome"], "CRITICAL_MATCH")

    def test_exact_parameter_unit_and_optional_exact_test_identifier(self):
        self.assertEqual(evaluator.evaluate_snapshot(result(), [rule()])["outcome"], "CRITICAL_MATCH")
        self.assertEqual(evaluator.evaluate_snapshot(result(test_parameter="qa_analyte"), [rule()])["outcome"], "NO_CONFIGURED_RULE")
        self.assertEqual(evaluator.evaluate_snapshot(result(unit="QA-UNIT"), [rule()])["outcome"], "NO_CONFIGURED_RULE")
        self.assertEqual(evaluator.evaluate_snapshot(result(test_identifier="OTHER"), [rule()])["outcome"], "NO_CONFIGURED_RULE")
        generic = rule(test_identifier=None)
        self.assertEqual(evaluator.evaluate_snapshot(result(test_identifier=None), [generic])["outcome"], "CRITICAL_MATCH")

    def test_lt_lte_gt_gte_eq_comparisons(self):
        cases = [
            ("LT", "6", True), ("LT", "5", False),
            ("LTE", "5", True), ("GT", "4", True), ("GT", "5", False),
            ("GTE", "5", True), ("EQ", "5.0", True), ("EQ", "5.1", False),
        ]
        for op, threshold, critical in cases:
            with self.subTest(op=op, threshold=threshold):
                outcome = evaluator.evaluate_snapshot(result(), [rule(operator=op, threshold_value=Decimal(threshold))])["outcome"]
                self.assertEqual(outcome, "CRITICAL_MATCH" if critical else "NOT_CRITICAL")

    def test_inside_and_outside_ranges_include_both_boundaries(self):
        bounds = rule(operator="INSIDE_RANGE", threshold_value=None,
                      lower_critical_bound=Decimal("2"), upper_critical_bound=Decimal("8"))
        for value in ("2", "5", "8"):
            self.assertEqual(evaluator.evaluate_snapshot(result(result_value=value), [bounds])["outcome"], "CRITICAL_MATCH")
        outside = {**bounds, "operator": "OUTSIDE_RANGE"}
        for value in ("2", "8"):
            self.assertEqual(evaluator.evaluate_snapshot(result(result_value=value), [outside])["outcome"], "CRITICAL_MATCH")
        for value in ("2.01", "5", "7.99"):
            self.assertEqual(evaluator.evaluate_snapshot(result(result_value=value), [outside])["outcome"], "NOT_CRITICAL")

    def test_no_configured_ambiguous_and_not_evaluable_outcomes(self):
        self.assertEqual(evaluator.evaluate_snapshot(result(), [])["outcome"], "NO_CONFIGURED_RULE")
        ambiguous = evaluator.evaluate_snapshot(result(), [rule(), rule(rule_id=13, rule_version=2, threshold_value=Decimal("7"))])
        self.assertEqual(ambiguous["outcome"], "AMBIGUOUS_RULE")
        non_numeric = evaluator.evaluate_snapshot(result(result_value="<5"), [rule()])
        self.assertEqual(non_numeric["outcome"], "NOT_EVALUABLE")
        self.assertEqual(non_numeric["reason_code"], "NON_NUMERIC_OR_NON_FINITE_RESULT")

    def test_naive_local_timestamp_normalization_and_effective_boundaries(self):
        instant, error = evaluator.normalize_result_timestamp(RESULT_DATE)
        self.assertIsNone(error)
        self.assertEqual(instant, datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc))
        r = rule(operator="GTE", threshold_value=Decimal("5"),
                 effective_from=instant, effective_to=instant + timedelta(seconds=1))
        self.assertEqual(evaluator.evaluate_snapshot(result(), [r])["outcome"], "CRITICAL_MATCH")
        self.assertEqual(evaluator.evaluate_snapshot(result(), [dict(r, effective_to=instant)])["outcome"], "NO_CONFIGURED_RULE")

    def test_missing_invalid_ambiguous_and_nonexistent_timestamps(self):
        missing = evaluator.evaluate_snapshot(result(result_date=None), [rule()])
        self.assertEqual((missing["outcome"], missing["reason_code"]), ("NOT_EVALUABLE", "MISSING_RESULT_TIMESTAMP"))
        invalid = evaluator.evaluate_snapshot(result(result_date="not-a-time"), [rule()])
        self.assertEqual(invalid["reason_code"], "INVALID_RESULT_TIMESTAMP")
        with patch.object(evaluator, "HOSPITAL_ZONE", ZoneInfo("America/New_York")):
            ambiguous, ambiguous_reason = evaluator.normalize_result_timestamp(datetime(2026, 11, 1, 1, 30))
            nonexistent, nonexistent_reason = evaluator.normalize_result_timestamp(datetime(2026, 3, 8, 2, 30))
        self.assertIsNone(ambiguous); self.assertEqual(ambiguous_reason, "AMBIGUOUS_LOCAL_TIME")
        self.assertIsNone(nonexistent); self.assertEqual(nonexistent_reason, "NONEXISTENT_LOCAL_TIME")

    def test_catalog_model_rejects_between_and_accepts_explicit_range(self):
        body = {"parameter_name": "QA", "unit": "u", "operator": "BETWEEN",
                "lower_critical_bound": "1", "upper_critical_bound": "2",
                "effective_from": "2026-01-01T00:00:00Z", "source_provenance": "qa", "change_reason": "qa"}
        app = FastAPI(); app.include_router(catalog.router)
        app.dependency_overrides[catalog.require_author] = lambda: {"user_id": 1, "role": catalog.AUTHOR_ROLE}
        client = TestClient(app)
        try:
            response = client.post("/api/v1/admin/lab-critical-rules", json=body)
            self.assertEqual(response.status_code, 422)
        finally:
            client.close()
        valid = {**body, "operator": "INSIDE_RANGE", "threshold_value": None}
        parsed = catalog.RuleDraft(**valid)
        self.assertEqual(parsed.operator, "INSIDE_RANGE")
        self.assertEqual(parsed.lower_critical_bound, Decimal("1"))


class FakeCursor:
    def __init__(self, state=None, rows=None, rules=None, insert_failure=False, locked=True):
        self.state = state or {"poll_cursor": 0, "reconcile_cursor": 0, "last_reconciled_at": NOW}
        self.rows, self.rules = rows or [], rules or []
        self.insert_failure, self.locked = insert_failure, locked
        self.sql = []
        self.current = None
        self.last_fetchall = []
        self.inserted = []

    def execute(self, sql, params=None):
        compact = " ".join(sql.split())
        self.sql.append((compact, params))
        if "pg_try_advisory_xact_lock" in compact:
            self.current = {"locked": self.locked}
        elif "FROM lab_critical_evaluator_state" in compact and "FOR UPDATE" in compact:
            self.current = self.state
        elif "FROM lab_results lr" in compact:
            self.last_fetchall = [r for r in self.rows if r["lab_result_id"] > params[0]][:params[1]]
        elif "FROM lab_critical_rules" in compact:
            self.last_fetchall = self.rules
        elif "INSERT INTO lab_critical_evaluation_events" in compact:
            if self.insert_failure:
                raise RuntimeError("synthetic insert failure")
            self.inserted.append(params)
            self.current = {"evaluation_event_id": len(self.inserted)}
        elif "MAX(lab_result_id)" in compact:
            self.current = {"max_result_id": max([r["lab_result_id"] for r in self.rows] or [0])}
        else:
            self.current = None

    def fetchone(self):
        current, self.current = self.current, None
        return current

    def fetchall(self):
        rows, self.last_fetchall = self.last_fetchall, []
        return rows


class LabCriticalEvaluatorWorkerTests(unittest.TestCase):
    def setup_worker(self, **kwargs):
        cur = FakeCursor(**kwargs)
        conn = MagicMock(); conn.cursor.return_value = cur
        with patch.object(evaluator.db_connector, "get_dict_cursor", lambda _conn: cur):
            return cur, conn

    def test_worker_skips_nonverified_and_demo_and_never_updates_lab_tables(self):
        rows = [result(lab_result_id=1), result(lab_result_id=2, result_source="DEMO_GENERATED"),
                result(lab_result_id=3, verification_status="Pending")]
        cur, conn = self.setup_worker(rows=rows, rules=[])
        result_row = evaluator.run_batch(batch_size=10, connection_factory=lambda: conn, now=NOW)
        self.assertEqual(result_row["eligible"], 1)
        self.assertEqual(result_row["inserted"], 1)
        insert_sql = [sql for sql, _ in cur.sql if "INSERT INTO" in sql]
        self.assertEqual(len(insert_sql), 1)
        self.assertIn("lab_critical_evaluation_events", insert_sql[0])
        self.assertFalse(any("UPDATE lab_results" in sql or "UPDATE lab_orders" in sql for sql, _ in cur.sql))
        self.assertTrue(any("verification_status" in sql for sql, _ in cur.sql))

    def test_worker_failure_rolls_back_and_does_not_advance_checkpoint(self):
        cur, conn = self.setup_worker(rows=[result()], rules=[], insert_failure=True)
        with self.assertRaises(RuntimeError):
            evaluator.run_batch(batch_size=10, connection_factory=lambda: conn, now=NOW)
        conn.rollback.assert_called_once()
        self.assertFalse(any("UPDATE lab_critical_evaluator_state" in sql for sql, _ in cur.sql))
        conn.commit.assert_not_called()

    def test_worker_lock_skips_concurrent_scanner(self):
        cur, conn = self.setup_worker(locked=False)
        result_row = evaluator.run_batch(connection_factory=lambda: conn, now=NOW)
        self.assertFalse(result_row["locked"])
        self.assertEqual(len(cur.sql), 1)
        conn.rollback.assert_called_once()

    def test_worker_runs_bounded_reconciliation_and_then_polls(self):
        cur, conn = self.setup_worker(state={"poll_cursor": 0, "reconcile_cursor": 0, "last_reconciled_at": None},
                                      rows=[result()], rules=[])
        result_row = evaluator.run_batch(batch_size=10, connection_factory=lambda: conn, now=NOW)
        self.assertEqual(result_row["mode"], "reconcile")
        self.assertTrue(result_row["reconcile_complete"])
        self.assertTrue(any("SET reconcile_cursor=0" in sql and "poll_cursor=GREATEST" in sql for sql, _ in cur.sql))
        conn.commit.assert_called_once()

    def test_idempotency_changes_when_result_or_rule_snapshot_changes(self):
        first = evaluator.evaluate_snapshot(result(), [rule()])
        same = evaluator.evaluate_snapshot(result(), [rule()])
        changed_result = evaluator.evaluate_snapshot(result(result_value="6"), [rule()])
        changed_rule = evaluator.evaluate_snapshot(result(), [rule(rule_version=2, threshold_value=Decimal("8"))])
        self.assertEqual(first["idempotency_key"], same["idempotency_key"])
        self.assertNotEqual(first["idempotency_key"], changed_result["idempotency_key"])
        self.assertNotEqual(first["idempotency_key"], changed_rule["idempotency_key"])

    def test_event_schema_is_append_only_and_source_workflows_are_not_written(self):
        migration = Path(__file__).resolve().parents[1] / "migrations" / "040_ag10_lab_critical_evaluation_events.sql"
        sql = migration.read_text(encoding="utf-8").lower()
        self.assertIn("before update or delete", sql)
        self.assertIn("before truncate", sql)
        self.assertNotIn("update lab_results set", sql)
        self.assertNotIn("update lab_orders set", sql)
        self.assertNotIn("insert into notifications", sql)

    def test_alert_projection_runs_only_for_critical_matches(self):
        critical_rule = rule()
        cur, conn = self.setup_worker(rows=[result()], rules=[critical_rule])
        with patch.object(evaluator, "create_alert_for_evaluation_event", return_value=True) as create_alert:
            result_row = evaluator.run_batch(batch_size=10, connection_factory=lambda: conn, now=NOW)
        self.assertEqual(result_row["inserted"], 1)
        create_alert.assert_called_once_with(cur, 1)
        self.assertFalse(any("UPDATE lab_results" in sql or "UPDATE lab_orders" in sql for sql, _ in cur.sql))


if __name__ == "__main__":
    unittest.main()
