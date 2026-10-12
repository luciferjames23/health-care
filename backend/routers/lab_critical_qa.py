"""Laboratory-only synthetic QA action for AG-10 critical alert validation."""
import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from api.auth_helper import decode_token, security
from db.postgres_connector import PostgresConnector
from services.lab_critical_evaluator import evaluate_result_id

router = APIRouter(prefix="/api/v1/clinical-ops/labs", tags=["AG-10 Lab Critical QA"])
db_connector = PostgresConnector()
QA_RESULT_SOURCE = "AG10_CRITICAL_QA"
logger = logging.getLogger(__name__)


def require_laboratory_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials if credentials else None
    payload = decode_token(token) if token else None
    if (not payload or not payload.get("user_id") or
            str(payload.get("auth_method", "")).lower() not in {"password", "account_selection"}):
        raise HTTPException(status_code=401, detail="A verified Laboratory user session is required.")
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT u.id AS user_id, u.is_active, r.name AS role, u.username
              FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=%s
        """, (payload["user_id"],))
        user = cur.fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Unable to verify Laboratory access.") from exc
    finally:
        conn.close()
    if (not user or not user.get("is_active") or
            str(user.get("role") or "").strip().casefold() != "laboratory" or
            str(user.get("username") or "").casefold() == "dev"):
        raise HTTPException(status_code=403, detail="Laboratory role authorization is required.")
    return {"user_id": int(user["user_id"]), "role": user["role"]}


def _critical_synthetic_value(rule):
    """Choose a deterministic synthetic numeric value that matches this QA rule."""
    op = rule["operator"]
    threshold = Decimal(str(rule["threshold_value"])) if rule.get("threshold_value") is not None else None
    lower = Decimal(str(rule["lower_critical_bound"])) if rule.get("lower_critical_bound") is not None else None
    upper = Decimal(str(rule["upper_critical_bound"])) if rule.get("upper_critical_bound") is not None else None
    if op == "GT" and threshold is not None:
        value = threshold + Decimal("1")
    elif op == "GTE" and threshold is not None:
        value = threshold
    elif op == "LT" and threshold is not None:
        value = threshold - Decimal("1")
    elif op == "LTE" and threshold is not None:
        value = threshold
    elif op == "EQ" and threshold is not None:
        value = threshold
    elif op == "OUTSIDE_RANGE" and lower is not None:
        value = lower - Decimal("1")
    elif op == "INSIDE_RANGE" and lower is not None:
        value = lower
    else:
        raise HTTPException(status_code=409, detail="The approved synthetic QA rule cannot generate a numeric value.")
    return format(value, "f")


@router.post("/{order_id}/generate-critical-qa-result", summary="Generate a synthetic AG-10 critical QA result")
def generate_critical_qa_result(order_id: int, user=Depends(require_laboratory_user)):
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT lo.lab_order_id, lo.patient_id, lo.status, lt.test_code
              FROM lab_orders lo
              JOIN lab_tests lt ON lt.lab_test_id=lo.lab_test_id
             WHERE lo.lab_order_id=%s FOR UPDATE OF lo
        """, (order_id,))
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Laboratory order not found.")

        cur.execute("""
            SELECT rule_id, parameter_name, test_identifier, unit, operator,
                   threshold_value, lower_critical_bound, upper_critical_bound,
                   rule_version, source_provenance
              FROM lab_critical_rules
             WHERE test_identifier=%s AND approval_status='APPROVED' AND is_active
               AND effective_from <= CURRENT_TIMESTAMP
               AND (effective_to IS NULL OR CURRENT_TIMESTAMP < effective_to)
               AND source_provenance ILIKE '%%synthetic QA%%'
             ORDER BY rule_id
        """, (order["test_code"],))
        rules = cur.fetchall()
        if len(rules) != 1:
            raise HTTPException(status_code=409, detail="Exactly one active approved synthetic QA rule must match this test.")
        rule = rules[0]
        if (not str(rule["parameter_name"]).startswith("AG10_") or
                not str(rule["test_identifier"]).startswith("AG10-") or
                not rule.get("source_provenance") or
                "synthetic qa" not in str(rule["source_provenance"]).casefold()):
            raise HTTPException(status_code=409, detail="The matching rule is not isolated synthetic AG-10 QA configuration.")

        cur.execute("""
            SELECT lr.lab_result_id, lr.result_value, lr.unit, lr.verification_status, lr.result_source
              FROM lab_results lr
              JOIN lab_critical_evaluation_events ev ON ev.lab_result_id=lr.lab_result_id
              JOIN lab_critical_alerts a ON a.evaluation_event_id=ev.evaluation_event_id
             WHERE lr.lab_order_id=%s AND lr.test_parameter=%s AND lr.unit=%s
               AND lr.result_source=%s AND a.status='OPEN'
             ORDER BY lr.lab_result_id DESC LIMIT 1
        """, (order_id, rule["parameter_name"], rule["unit"], QA_RESULT_SOURCE))
        result = cur.fetchone()
        idempotent_existing = result is not None
        if result is None:
            value = _critical_synthetic_value(rule)
            # lab_result_id has no database default in the current schema.
            # Serialize the max+1 assignment with other QA and demo writers.
            cur.execute("LOCK TABLE lab_results IN EXCLUSIVE MODE")
            cur.execute("SELECT COALESCE(MAX(lab_result_id),0)+1 AS next_id FROM lab_results")
            result_id = int(cur.fetchone()["next_id"])
            cur.execute("""
                INSERT INTO lab_results (
                    lab_result_id, lab_order_id, patient_id, test_parameter, result_value, unit,
                    reference_range, abnormal_flag, verification_status, result_date,
                    result_source, verified_by
                ) VALUES (%s,%s,%s,%s,%s,%s,'Synthetic QA rule match',FALSE,'Verified',
                          CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Calcutta',%s,%s)
                RETURNING lab_result_id, result_value, unit, verification_status, result_source
            """, (result_id, order_id, order["patient_id"], rule["parameter_name"], value,
                  rule["unit"], QA_RESULT_SOURCE, user["user_id"]))
            result = cur.fetchone()
        if result["result_source"] == "DEMO_GENERATED":
            raise HTTPException(status_code=409, detail="Demo results cannot be used for critical QA evaluation.")

        event = evaluate_result_id(cur, int(result["lab_result_id"]), provenance_source="AG10_CRITICAL_QA_ACTION")
        conn.commit()
        return {
            "lab_order_id": int(order_id), "lab_result_id": int(result["lab_result_id"]),
            "parameter": rule["parameter_name"], "unit": rule["unit"],
            "generated_value": str(result["result_value"]),
            "result_source": result["result_source"], "verification_status": result["verification_status"],
            "rule_id": int(rule["rule_id"]), "rule_version": int(rule["rule_version"]),
            "evaluation_event_id": int(event["evaluation_event_id"]), "evaluation_outcome": event["outcome"],
            "reason_code": event["reason_code"], "alert_id": int(event["alert_id"]) if event.get("alert_id") else None,
            "alert_status": event.get("alert_status"),
            "recipient_resolution_status": event.get("recipient_resolution_status"),
            "recipient_user_id": int(event["recipient_user_id"]) if event.get("recipient_user_id") else None,
            "idempotent_existing": idempotent_existing,
            "lab_order_status": order["status"],
        }
    except HTTPException:
        conn.rollback()
        raise
    except RuntimeError as exc:
        conn.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        conn.rollback()
        logger.exception("Synthetic AG-10 critical QA result failed for Lab order %s", order_id)
        raise HTTPException(status_code=503, detail="Unable to generate and evaluate the synthetic critical QA result.") from exc
    finally:
        conn.close()
