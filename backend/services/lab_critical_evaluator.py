"""Deterministic, isolated Lab critical-rule evaluation service."""
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from db.postgres_connector import PostgresConnector
from services.lab_critical_alert_service import create_alert_for_evaluation_event

HOSPITAL_TIMEZONE = "Asia/Calcutta"
EVALUATOR_VERSION = "ag10-lab-critical-evaluator/1.0"
RECONCILE_INTERVAL_SECONDS = int(os.getenv("AG10_CRITICAL_RECONCILE_INTERVAL_SECONDS", "21600"))
HOSPITAL_ZONE = ZoneInfo(HOSPITAL_TIMEZONE)
db_connector = PostgresConnector()


def _json_value(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _fingerprint(value) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=_json_value).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def normalize_result_timestamp(value):
    """Interpret a naive result timestamp as Asia/Calcutta local wall time."""
    if value is None:
        return None, "MISSING_RESULT_TIMESTAMP"
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except (TypeError, ValueError):
            return None, "INVALID_RESULT_TIMESTAMP"
    if not isinstance(value, datetime) or value.tzinfo is not None:
        return None, "INVALID_RESULT_TIMESTAMP"

    valid = []
    for fold in (0, 1):
        local = value.replace(tzinfo=HOSPITAL_ZONE, fold=fold)
        instant = local.astimezone(timezone.utc)
        if instant.astimezone(HOSPITAL_ZONE).replace(tzinfo=None) == value:
            valid.append((local.utcoffset(), instant))
    offsets = {offset for offset, _ in valid}
    if not valid:
        return None, "NONEXISTENT_LOCAL_TIME"
    if len(offsets) > 1:
        return None, "AMBIGUOUS_LOCAL_TIME"
    return valid[0][1], None


def _as_decimal(value):
    if value is None:
        return None
    try:
        number = Decimal(str(value).strip())
    except (InvalidOperation, ValueError, TypeError):
        return None
    return number if number.is_finite() else None


def _aware_utc(value):
    if not isinstance(value, datetime) or value.tzinfo is None:
        return None
    return value.astimezone(timezone.utc)


def rule_is_effective(rule, instant):
    start = _aware_utc(rule.get("effective_from"))
    end_value = rule.get("effective_to")
    end = _aware_utc(end_value) if end_value is not None else None
    return bool(start and instant >= start and (end is None or instant < end))


def _rule_ref(rule):
    return {
        "rule_id": int(rule["rule_id"]), "rule_version": int(rule["rule_version"]),
        "parameter_name": rule["parameter_name"], "test_identifier": rule.get("test_identifier"),
        "unit": rule["unit"], "operator": rule["operator"],
        "threshold_value": rule.get("threshold_value"),
        "lower_critical_bound": rule.get("lower_critical_bound"),
        "upper_critical_bound": rule.get("upper_critical_bound"),
        "approval_status": rule["approval_status"], "is_active": bool(rule["is_active"]),
        "effective_from": rule.get("effective_from"), "effective_to": rule.get("effective_to"),
        "source_provenance": rule.get("source_provenance"),
    }


def _applicable_rules(rules, result, instant):
    return [rule for rule in rules
            if rule.get("parameter_name") == result.get("test_parameter")
            and rule.get("unit") == result.get("unit")
            and (rule.get("test_identifier") is None or rule.get("test_identifier") == result.get("test_identifier"))
            and rule.get("approval_status") == "APPROVED"
            and bool(rule.get("is_active"))
            and rule_is_effective(rule, instant)]


def _matches(rule, value):
    op = rule.get("operator")
    threshold = _as_decimal(rule.get("threshold_value"))
    lower = _as_decimal(rule.get("lower_critical_bound"))
    upper = _as_decimal(rule.get("upper_critical_bound"))
    if op == "LT" and threshold is not None:
        return value < threshold
    if op == "LTE" and threshold is not None:
        return value <= threshold
    if op == "GT" and threshold is not None:
        return value > threshold
    if op == "GTE" and threshold is not None:
        return value >= threshold
    if op == "EQ" and threshold is not None:
        return value == threshold
    if op == "INSIDE_RANGE" and lower is not None and upper is not None:
        return lower <= value <= upper
    if op == "OUTSIDE_RANGE" and lower is not None and upper is not None:
        return value <= lower or value >= upper
    return None


def evaluate_snapshot(result, rules):
    """Return one event payload for a result snapshot; ineligible rows return None."""
    result, rules = dict(result), [dict(rule) for rule in rules]
    if result.get("verification_status") != "Verified" or result.get("result_source") == "DEMO_GENERATED":
        return None

    original_timestamp = result.get("result_date")
    instant, time_error = normalize_result_timestamp(original_timestamp)
    refs = [_rule_ref(rule) for rule in rules]
    rule_set_fingerprint = _fingerprint(refs)
    snapshot = {
        "lab_result_id": result.get("lab_result_id"),
        "parameter_name": result.get("test_parameter"),
        "test_identifier": result.get("test_identifier"),
        "result_value_text": result.get("result_value"), "unit": result.get("unit"),
        "verification_status": result.get("verification_status"),
        "result_source": result.get("result_source"), "result_date": original_timestamp,
        "verified_by": result.get("verified_by"),
    }
    result_fingerprint = _fingerprint(snapshot)
    idempotency_key = _fingerprint({
        "lab_result_id": result.get("lab_result_id"), "result_fingerprint": result_fingerprint,
        "rule_set_fingerprint": rule_set_fingerprint, "evaluator_version": EVALUATOR_VERSION,
    })
    event = {
        "lab_result_id": result.get("lab_result_id"), "rule_id": None, "rule_version": None,
        "candidate_rules": refs, "parameter_name": result.get("test_parameter"),
        "test_identifier": result.get("test_identifier"), "result_value_text": result.get("result_value"),
        "unit": result.get("unit"), "numeric_value": None, "outcome": None, "reason_code": None,
        "original_result_timestamp": original_timestamp, "normalized_result_instant": instant,
        "timezone_used": HOSPITAL_TIMEZONE, "result_fingerprint": result_fingerprint,
        "rule_set_fingerprint": rule_set_fingerprint, "evaluator_version": EVALUATOR_VERSION,
        "idempotency_key": idempotency_key,
        "provenance": {"source": "POLLING_RECONCILIATION",
                       "verification_status": result.get("verification_status"),
                       "result_source": result.get("result_source"), "verified_by": result.get("verified_by"),
                       "timezone_interpretation": "naive result_date is Asia/Calcutta local wall time"},
    }
    if time_error:
        event["outcome"], event["reason_code"] = "NOT_EVALUABLE", time_error
        return event

    applicable = _applicable_rules(rules, result, instant)
    if not applicable:
        event["outcome"] = "NO_CONFIGURED_RULE"
        event["reason_code"] = "NO_EXACT_ACTIVE_EFFECTIVE_RULE"
        return event
    event["candidate_rules"] = [_rule_ref(rule) for rule in applicable]
    if len(applicable) > 1:
        event["outcome"] = "AMBIGUOUS_RULE"
        event["reason_code"] = "MULTIPLE_APPLICABLE_RULES"
        return event

    rule = applicable[0]
    event["rule_id"], event["rule_version"] = rule["rule_id"], rule["rule_version"]
    event["provenance"]["rule_source_provenance"] = rule.get("source_provenance")
    if rule.get("operator") not in {"LT", "LTE", "GT", "GTE", "EQ", "INSIDE_RANGE", "OUTSIDE_RANGE"}:
        event["outcome"], event["reason_code"] = "NOT_EVALUABLE", "UNSUPPORTED_LEGACY_OPERATOR"
        return event
    numeric_value = _as_decimal(result.get("result_value"))
    if numeric_value is None:
        event["outcome"], event["reason_code"] = "NOT_EVALUABLE", "NON_NUMERIC_OR_NON_FINITE_RESULT"
        return event
    matched = _matches(rule, numeric_value)
    if matched is None:
        event["outcome"], event["reason_code"] = "NOT_EVALUABLE", "INVALID_RULE_CONFIGURATION"
    else:
        event["numeric_value"] = numeric_value
        event["outcome"] = "CRITICAL_MATCH" if matched else "NOT_CRITICAL"
        event["reason_code"] = "CONFIGURED_RULE_MATCHED" if matched else "CONFIGURED_RULE_NOT_BREACHED"
    return event


def _fetch_rules(cur, result, result_instant):
    parameter, unit = result.get("test_parameter"), result.get("unit")
    if parameter is None or unit is None:
        return []
    cur.execute("""
        SELECT rule_id, parameter_name, test_identifier, unit, operator,
               threshold_value, lower_critical_bound, upper_critical_bound,
               is_active, effective_from, effective_to, rule_version,
               approval_status, source_provenance
         FROM lab_critical_rules
         WHERE parameter_name=%s AND unit=%s
           AND (test_identifier IS NULL OR test_identifier=%s)
           AND approval_status IN ('APPROVED','RETIRED')
           AND (%s::TIMESTAMPTZ IS NULL OR
                (effective_from <= %s AND (effective_to IS NULL OR %s < effective_to)))
         ORDER BY rule_id
    """, (parameter, unit, result.get("test_identifier"), result_instant,
          result_instant, result_instant))
    return cur.fetchall()


def _insert_event(cur, event):
    if event is None:
        return False, None
    cur.execute("""
        INSERT INTO lab_critical_evaluation_events (
            lab_result_id, rule_id, rule_version, candidate_rules, parameter_name,
            test_identifier, result_value_text, unit, numeric_value, outcome, reason_code,
            original_result_timestamp, normalized_result_instant, timezone_used,
            result_fingerprint, rule_set_fingerprint, evaluator_version, provenance, idempotency_key
        ) VALUES (
            %(lab_result_id)s, %(rule_id)s, %(rule_version)s, %(candidate_rules)s::jsonb,
            %(parameter_name)s, %(test_identifier)s, %(result_value_text)s, %(unit)s,
            %(numeric_value)s, %(outcome)s, %(reason_code)s, %(original_result_timestamp)s,
            %(normalized_result_instant)s, %(timezone_used)s, %(result_fingerprint)s,
            %(rule_set_fingerprint)s, %(evaluator_version)s, %(provenance)s::jsonb, %(idempotency_key)s
        ) ON CONFLICT (idempotency_key) DO NOTHING RETURNING evaluation_event_id
    """, {**event,
          "candidate_rules": json.dumps(event["candidate_rules"], default=_json_value),
          "provenance": json.dumps(event["provenance"], default=_json_value)})
    inserted = cur.fetchone()
    if inserted:
        return True, inserted["evaluation_event_id"]
    if event["outcome"] == "CRITICAL_MATCH":
        # Reconciliation must also repair an alert missing for a pre-existing
        # evaluation event after an interrupted/older deployment.
        cur.execute("""
            SELECT evaluation_event_id FROM lab_critical_evaluation_events
             WHERE idempotency_key=%s
        """, (event["idempotency_key"],))
        existing = cur.fetchone()
        return False, existing["evaluation_event_id"] if existing else None
    return False, None


def _load_rows(cur, cursor, batch_size):
    cur.execute("""
        SELECT lr.lab_result_id, lr.test_parameter, lr.result_value, lr.unit,
               lr.verification_status, lr.result_source, lr.result_date, lr.verified_by,
               lt.test_code AS test_identifier
          FROM lab_results lr
          LEFT JOIN lab_orders lo ON lo.lab_order_id=lr.lab_order_id
          LEFT JOIN lab_tests lt ON lt.lab_test_id=lo.lab_test_id
         WHERE lr.lab_result_id > %s
         ORDER BY lr.lab_result_id LIMIT %s
    """, (cursor, batch_size))
    return cur.fetchall()


def evaluate_result_id(cur, lab_result_id, provenance_source="LAB_RESULT_EVENT"):
    """Evaluate one result with the same rule and alert path as the worker.

    The caller owns the transaction. This does not move the polling checkpoint,
    and the advisory lock serializes it with the background evaluator.
    """
    cur.execute("SELECT pg_try_advisory_xact_lock(391040, 10) AS locked")
    lock = cur.fetchone()
    if not lock or not lock["locked"]:
        raise RuntimeError("Lab critical evaluator is busy; retry the QA action.")
    cur.execute("""
        SELECT lr.lab_result_id, lr.test_parameter, lr.result_value, lr.unit,
               lr.verification_status, lr.result_source, lr.result_date, lr.verified_by,
               lt.test_code AS test_identifier
          FROM lab_results lr
          LEFT JOIN lab_orders lo ON lo.lab_order_id=lr.lab_order_id
          LEFT JOIN lab_tests lt ON lt.lab_test_id=lo.lab_test_id
         WHERE lr.lab_result_id=%s
    """, (lab_result_id,))
    result = cur.fetchone()
    if not result:
        raise ValueError("Lab result was not found for evaluation.")
    if result.get("verification_status") != "Verified" or result.get("result_source") == "DEMO_GENERATED":
        raise ValueError("Only verified, non-demo results can be evaluated.")
    instant, _ = normalize_result_timestamp(result.get("result_date"))
    rules = _fetch_rules(cur, result, instant)
    event = evaluate_snapshot(result, rules)
    if event:
        event["provenance"]["source"] = provenance_source
    _, event_id = _insert_event(cur, event)
    if event and event.get("outcome") == "CRITICAL_MATCH" and event_id is not None:
        create_alert_for_evaluation_event(cur, event_id)
    cur.execute("""
        SELECT ev.evaluation_event_id, ev.outcome, ev.reason_code, ev.rule_id, ev.rule_version,
               a.alert_id, a.status AS alert_status, a.recipient_resolution_status,
               (SELECT recipient_user_id FROM lab_critical_alert_recipients ar
                 WHERE ar.alert_id=a.alert_id AND ar.recipient_type='ORDERING_DOCTOR'
                 ORDER BY recipient_user_id LIMIT 1) AS recipient_user_id
          FROM lab_critical_evaluation_events ev
          LEFT JOIN lab_critical_alerts a ON a.evaluation_event_id=ev.evaluation_event_id
         WHERE ev.evaluation_event_id=%s
    """, (event_id,))
    persisted = cur.fetchone()
    if not persisted:
        raise RuntimeError("Lab critical evaluation event was not persisted.")
    return persisted


def _state_value(state, name, index):
    return state.get(name) if isinstance(state, dict) else state[index]


def run_batch(batch_size=200, reconcile=False, connection_factory=None, now=None):
    """Process one transactionally checkpointed batch; errors leave cursor unchanged."""
    if batch_size < 1 or batch_size > 2000:
        raise ValueError("batch_size must be between 1 and 2000")
    conn = (connection_factory or db_connector.get_connection)()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT pg_try_advisory_xact_lock(391040, 10) AS locked")
        lock = cur.fetchone()
        if not lock or not lock["locked"]:
            conn.rollback()
            return {"locked": False, "scanned": 0, "eligible": 0, "inserted": 0, "mode": None}

        cur.execute("""
            SELECT poll_cursor, reconcile_cursor, last_reconciled_at
              FROM lab_critical_evaluator_state WHERE state_id=1 FOR UPDATE
        """)
        state = cur.fetchone()
        if not state:
            raise RuntimeError("Lab critical evaluator checkpoint is missing")
        now = now or datetime.now(timezone.utc)
        last_reconciled = _state_value(state, "last_reconciled_at", 2)
        due = last_reconciled is None or now - last_reconciled >= timedelta(seconds=RECONCILE_INTERVAL_SECONDS)
        mode = "reconcile" if reconcile or due else "poll"
        cursor_name = "reconcile_cursor" if mode == "reconcile" else "poll_cursor"
        cursor_index = 1 if mode == "reconcile" else 0
        cursor_value = int(_state_value(state, cursor_name, cursor_index))

        rows = _load_rows(cur, cursor_value, batch_size)
        inserted = eligible = 0
        for row in rows:
            result = dict(row)
            if result.get("verification_status") != "Verified" or result.get("result_source") == "DEMO_GENERATED":
                continue
            eligible += 1
            result_instant, _ = normalize_result_timestamp(result.get("result_date"))
            catalog_rows = _fetch_rules(cur, result, result_instant)
            event = evaluate_snapshot(result, catalog_rows)
            was_inserted, event_id = _insert_event(cur, event)
            inserted += int(was_inserted)
            if event and event.get("outcome") == "CRITICAL_MATCH" and event_id is not None:
                create_alert_for_evaluation_event(cur, event_id)

        new_cursor = int(rows[-1]["lab_result_id"]) if rows else cursor_value
        finished_reconcile = False
        if mode == "reconcile":
            if len(rows) < batch_size:
                cur.execute("SELECT COALESCE(MAX(lab_result_id), 0) AS max_result_id FROM lab_results")
                max_result_id = int(cur.fetchone()["max_result_id"] or 0)
                cur.execute("""
                    UPDATE lab_critical_evaluator_state
                       SET reconcile_cursor=0, poll_cursor=GREATEST(poll_cursor,%s),
                           last_reconciled_at=%s, updated_at=CURRENT_TIMESTAMP
                     WHERE state_id=1
                """, (max_result_id, now))
                finished_reconcile = True
            else:
                cur.execute("""
                    UPDATE lab_critical_evaluator_state
                       SET reconcile_cursor=%s, updated_at=CURRENT_TIMESTAMP WHERE state_id=1
                """, (new_cursor,))
        elif rows:
            cur.execute("""
                UPDATE lab_critical_evaluator_state
                   SET poll_cursor=%s, updated_at=CURRENT_TIMESTAMP WHERE state_id=1
            """, (new_cursor,))
        conn.commit()
        return {"locked": True, "mode": mode, "scanned": len(rows), "eligible": eligible,
                "inserted": inserted, "cursor": new_cursor, "reconcile_complete": finished_reconcile}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
