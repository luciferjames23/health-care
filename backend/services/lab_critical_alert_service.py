"""Isolated alert projection for immutable AG-10 critical evaluation events."""

def create_alert_for_evaluation_event(cur, evaluation_event_id: int) -> bool:
    """Create an alert once for a CRITICAL_MATCH event; caller owns transaction."""
    cur.execute("""
        SELECT ev.evaluation_event_id, ev.outcome, ev.lab_result_id, ev.rule_id,
               ev.rule_version, ev.parameter_name, ev.result_value_text, ev.unit,
               ev.normalized_result_instant, lr.lab_order_id AS result_order_id,
               lr.patient_id AS result_patient_id, p.id AS patient_row_id,
               lo.patient_id AS order_patient_id,
               lo.doctor_id, d.user_id AS doctor_user_id, d.status AS doctor_status,
               u.is_active AS doctor_user_active, r.name AS doctor_user_role
          FROM lab_critical_evaluation_events ev
          JOIN lab_results lr ON lr.lab_result_id=ev.lab_result_id
          LEFT JOIN lab_orders lo ON lo.lab_order_id=lr.lab_order_id
          LEFT JOIN patients p ON p.id=lr.patient_id
          LEFT JOIN doctors d ON d.id=lo.doctor_id
          LEFT JOIN users u ON u.id=d.user_id
          LEFT JOIN roles r ON r.id=u.role_id
         WHERE ev.evaluation_event_id=%s
    """, (evaluation_event_id,))
    row = cur.fetchone()
    if not row or row.get("outcome") != "CRITICAL_MATCH":
        return False
    if (not row.get("rule_id") or not row.get("rule_version") or
            not row.get("result_order_id") or not row.get("result_patient_id") or
            row.get("patient_row_id") != row.get("result_patient_id") or
            row.get("order_patient_id") != row.get("result_patient_id") or
            not row.get("normalized_result_instant")):
        raise ValueError("Critical alert linkage is missing or inconsistent")

    doctor_status = str(row.get("doctor_status") or "").strip().upper()
    resolved = bool(
        row.get("doctor_user_id") and doctor_status == "ACTIVE" and
        row.get("doctor_user_active") and str(row.get("doctor_user_role") or "").strip().lower() == "doctor"
    )
    cur.execute("""
        INSERT INTO lab_critical_alerts (
            evaluation_event_id, lab_result_id, lab_order_id, patient_id, rule_id, rule_version,
            parameter_snapshot, result_value_snapshot, unit_snapshot,
            normalized_verified_result_time, recipient_resolution_status
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (evaluation_event_id) DO NOTHING RETURNING alert_id
    """, (
        row["evaluation_event_id"], row["lab_result_id"], row["result_order_id"],
        row["result_patient_id"], row["rule_id"], row["rule_version"],
        row.get("parameter_name"), row.get("result_value_text"), row.get("unit"),
        row["normalized_result_instant"], "RESOLVED" if resolved else "UNRESOLVED",
    ))
    alert = cur.fetchone()
    if not alert:
        return False
    alert_id = alert["alert_id"]
    if resolved:
        cur.execute("""
            INSERT INTO lab_critical_alert_recipients
                (alert_id,recipient_user_id,role_snapshot,recipient_type,assignment_source)
            VALUES (%s,%s,%s,'ORDERING_DOCTOR','LAB_ORDER_DOCTOR_MAPPING')
            ON CONFLICT DO NOTHING
        """, (alert_id, row["doctor_user_id"], row["doctor_user_role"]))
    cur.execute("""
        INSERT INTO lab_critical_alert_lifecycle_events (alert_id,event_type,actor_id,actor_role)
        VALUES (%s,'OPENED',NULL,'EVALUATOR_WORKER')
    """, (alert_id,))
    return True
