"""Explicitly gated, deterministic PoC results for supported lab test types."""
import json
import os

import db_config
from fastapi import HTTPException


DEMO_RESULT_SOURCE = "DEMO_GENERATED"
DEMO_RESULT_LABEL = "DEMO / SYNTHETIC RESULT"

_CBC = [
    {"parameter": "Hemoglobin", "value": "12.8", "unit": "g/dL", "reference_range": "11.5–15.5 g/dL"},
    {"parameter": "WBC", "value": "7400", "unit": "/µL", "reference_range": "4000–11000 /µL"},
    {"parameter": "Platelets", "value": "245000", "unit": "/µL", "reference_range": "150000–450000 /µL"},
]

_GLUCOSE = [
    {"parameter": "Glucose", "value": "92", "unit": "mg/dL", "reference_range": "70–99 mg/dL"},
]

_CREATININE = [
    {"parameter": "Creatinine", "value": "0.9", "unit": "mg/dL", "reference_range": "0.6–1.3 mg/dL"},
]

_LIVER_PANEL = [
    {"parameter": "ALT (SGPT)", "value": "22", "unit": "U/L", "reference_range": "7–56 U/L"},
    {"parameter": "AST (SGOT)", "value": "24", "unit": "U/L", "reference_range": "10–40 U/L"},
    {"parameter": "Alkaline phosphatase", "value": "88", "unit": "U/L", "reference_range": "44–147 U/L"},
    {"parameter": "Total bilirubin", "value": "0.8", "unit": "mg/dL", "reference_range": "0.1–1.2 mg/dL"},
]

_TEMPLATES = {
    "cbc": ("cbc", "complete blood count", "complete blood count (cbc)"),
    "glucose": ("glucose", "blood glucose", "blood sugar", "fasting blood sugar", "random blood sugar"),
    "creatinine": ("creatinine", "serum creatinine"),
    "liver_panel": ("liver panel", "liver function test", "liver function tests", "lft", "lfts"),
}


def _demo_template(test_code, test_name):
    code = " ".join(str(test_code or "").casefold().replace("-", " ").split())
    name = " ".join(str(test_name or "").casefold().replace("-", " ").split())
    if code in _TEMPLATES["cbc"] or name in _TEMPLATES["cbc"]:
        return _CBC
    if code in _TEMPLATES["glucose"] or name in _TEMPLATES["glucose"]:
        return _GLUCOSE
    if code in _TEMPLATES["creatinine"] or name in _TEMPLATES["creatinine"]:
        return _CREATININE
    if code in _TEMPLATES["liver_panel"] or name in _TEMPLATES["liver_panel"]:
        return _LIVER_PANEL
    return None


def _row_dict(cur, row):
    if row is None or isinstance(row, dict):
        return row
    return dict(zip([column[0] for column in cur.description], row))


def _require_demo_environment():
    enabled = os.getenv("AG17_LAB_DEMO_RESULTS_ENABLED", "").strip().lower() in {"1", "true", "yes"}
    database = str(getattr(db_config, "DB_NAME", "")).strip().casefold()
    if not enabled or database != "live_test":
        raise HTTPException(404, "Demo result generation is not enabled in this environment.")


def _authorized_lab_user(cur, token_user):
    user_id = token_user.get("user_id")
    if (not user_id or str(token_user.get("auth_method", "")).lower() not in {"password", "account_selection"}
            or str(token_user.get("username", "")).lower() == "dev"):
        raise HTTPException(401, "A verified user session is required to generate demo lab results.")
    cur.execute("""SELECT u.id, u.is_active, r.name AS role
                   FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=%s""", (user_id,))
    user = _row_dict(cur, cur.fetchone())
    if not user or not user.get("is_active"):
        raise HTTPException(401, "Authenticated user is inactive or no longer exists.")
    if str(user.get("role", "")).strip().casefold() not in {
        "laboratory", "pathologist", "admin", "hospital management"
    }:
        raise HTTPException(403, "Laboratory staff or hospital administrator authorization is required.")
    return int(user["id"])


def _next_result_id(cur):
    cur.execute("LOCK TABLE lab_results IN EXCLUSIVE MODE")
    cur.execute("""SELECT setval(pg_get_serial_sequence('lab_results','lab_result_id'),
                       GREATEST(COALESCE(MAX(lab_result_id),1),1), MAX(lab_result_id) IS NOT NULL)
                   FROM lab_results""")
    cur.execute("SELECT nextval(pg_get_serial_sequence('lab_results','lab_result_id'))")
    row = cur.fetchone()
    return int(row[0] if not isinstance(row, dict) else next(iter(row.values())))


def _audit(cur, user_id, action, order, test_name, old_status, new_status, result_ids):
    details = {
        "patient_id": order["patient_id"],
        "visit_id": order.get("visit_id"),
        "admission_id": order.get("admission_id"),
        "lab_order_id": order["lab_order_id"],
        "test_name": test_name,
        "result_source": DEMO_RESULT_SOURCE,
        "result_ids": result_ids,
        "old_status": old_status,
        "new_status": new_status,
    }
    cur.execute("""INSERT INTO audit_logs
                   (user_id, action, entity_type, entity_id, old_values, new_values, reason, created_at)
                   VALUES (%s,%s,'LAB_ORDER',%s,%s,%s,%s,CURRENT_TIMESTAMP)""",
                (user_id, action, order["lab_order_id"],
                 json.dumps({"status": old_status}), json.dumps(details),
                 "PoC synthetic lab result generation"))


def generate_demo_result(order_id, token_user, connection_factory=None):
    """Generate a fixed template result once, and only in the explicitly enabled PoC DB."""
    _require_demo_environment()
    conn = (connection_factory or db_config.get_db_connection)()
    try:
        with conn.cursor() as cur:
            user_id = _authorized_lab_user(cur, token_user)
            cur.execute("""SELECT lo.lab_order_id, lo.patient_id, lo.visit_id, lo.admission_id,
                                  lo.lab_test_id, lo.status, lo.ordered_date,
                                  lt.test_code, lt.test_name
                           FROM lab_orders lo
                           LEFT JOIN lab_tests lt ON lt.lab_test_id=lo.lab_test_id
                           WHERE lo.lab_order_id=%s
                           FOR UPDATE OF lo""", (order_id,))
            order = _row_dict(cur, cur.fetchone())
            if not order:
                raise HTTPException(404, "Laboratory order not found.")

            cur.execute("""SELECT lab_result_id, test_parameter, result_value, unit,
                                  reference_range, abnormal_flag, verification_status,
                                  result_date, result_source
                           FROM lab_results WHERE lab_order_id=%s ORDER BY lab_result_id""",
                        (order_id,))
            existing = [_row_dict(cur, row) for row in cur.fetchall()]
            if existing:
                conn.commit()
                return {
                    "lab_order_id": order["lab_order_id"], "status": order["status"],
                    "result_source": existing[0].get("result_source"),
                    "result_label": DEMO_RESULT_LABEL if existing[0].get("result_source") == DEMO_RESULT_SOURCE else None,
                    "results": existing, "idempotent_existing": True,
                }

            if str(order.get("status", "")).casefold() != "pending":
                raise HTTPException(409, "Only Pending laboratory orders without results can be completed.")

            template = _demo_template(order.get("test_code"), order.get("test_name"))
            if template is None:
                raise HTTPException(422, "Demo result template not configured.")

            result_ids = []
            saved_results = []
            for item in template:
                result_id = _next_result_id(cur)
                cur.execute("""INSERT INTO lab_results
                               (lab_result_id, lab_order_id, patient_id, test_parameter, result_value,
                                unit, reference_range, abnormal_flag, verification_status, result_date,
                                result_source, verified_by)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,FALSE,'DEMO_GENERATED',CURRENT_TIMESTAMP,%s,NULL)
                               RETURNING lab_result_id, result_date""",
                            (result_id, order_id, order["patient_id"], item["parameter"], item["value"],
                             item["unit"], item["reference_range"], DEMO_RESULT_SOURCE))
                saved = _row_dict(cur, cur.fetchone())
                result_ids.append(int(saved["lab_result_id"]))
                saved_results.append({
                    **item, "lab_result_id": int(saved["lab_result_id"]),
                    "lab_order_id": order_id, "patient_id": order["patient_id"],
                    "is_abnormal": False, "verification_status": "DEMO_GENERATED",
                    "result_source": DEMO_RESULT_SOURCE, "result_label": DEMO_RESULT_LABEL,
                    "result_date": saved.get("result_date"),
                })

            cur.execute("""UPDATE lab_orders SET status='Completed'
                           WHERE lab_order_id=%s AND status='Pending'
                           RETURNING status""", (order_id,))
            status_row = cur.fetchone()
            if not status_row:
                raise HTTPException(409, "Laboratory order status changed before the result could be saved.")
            if isinstance(status_row, dict):
                new_status = status_row["status"]
            else:
                new_status = status_row[0]

            order["lab_order_id"] = int(order["lab_order_id"])
            _audit(cur, user_id, "LAB_DEMO_RESULT_GENERATED", order, order.get("test_name"),
                   "Pending", "Pending", result_ids)
            _audit(cur, user_id, "LAB_ORDER_COMPLETED", order, order.get("test_name"),
                   "Pending", new_status, result_ids)
            conn.commit()
            return {
                "lab_order_id": order_id, "status": new_status,
                "result_source": DEMO_RESULT_SOURCE, "result_label": DEMO_RESULT_LABEL,
                "results": saved_results, "idempotent_existing": False,
            }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
