"""
test_ag11_followup_agent.py
============================
Automated integration tests for AG-11 — Follow-up Agent.
"""

import sys
import os
import uuid
import datetime
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import services.ag11_followup_service as ag11_service
import routers.ag11_followup_routes as ag11_routes


def create_test_patient_and_discharge():
    """Helper to create test patient and approved discharge summary."""
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    
    unique_suffix = uuid.uuid4().hex[:6].upper()
    patient_code = f"TEST_AG11_{unique_suffix}"
    phone = f"+9199{uuid.uuid4().hex[:8]}"

    cur.execute("""
        INSERT INTO patients (
            patient_code, first_name, last_name, date_of_birth, gender, phone, whatsapp_number, status
        ) VALUES (
            %s, 'TestAG11', 'Patient', '1990-01-01', 'FEMALE', %s, %s, 'ACTIVE'
        ) RETURNING id;
    """, (patient_code, phone, phone))
    patient_id = cur.fetchone()[0]

    cur.execute("""
        INSERT INTO dim_generated_discharge_summaries (
            patient_id, diagnoses, discharge_advice, approval_status, generated_at, discharge_date
        ) VALUES (
            %s, 'Total Knee Arthroplasty', 'Rest, elevate leg, follow exercise routine', 'Approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING summary_id;
    """, (patient_id,))
    summary_id = cur.fetchone()[0]

    conn.commit()
    cur.close()
    conn.close()

    return patient_id, summary_id, phone


def test_scan_and_create_followup_plans():
    patient_id, summary_id, phone = create_test_patient_and_discharge()

    res = ag11_service.scan_and_create_followup_plans()
    assert res.get("success") is True
    assert res.get("plans_created") >= 1

    # Verify database
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, status FROM ag11_followup_plans WHERE patient_id = %s AND discharge_summary_id = %s;", (patient_id, summary_id))
    plan_row = cur.fetchone()
    assert plan_row is not None
    plan_id, status = plan_row
    assert status == "ACTIVE"

    cur.execute("SELECT followup_day, status FROM ag11_followup_tasks WHERE plan_id = %s ORDER BY followup_day ASC;", (plan_id,))
    tasks = cur.fetchall()
    assert len(tasks) == 3
    days = [t[0] for t in tasks]
    assert days == [3, 7, 14]

    cur.close()
    conn.close()


def test_plan_creation_idempotency():
    patient_id, summary_id, phone = create_test_patient_and_discharge()

    res1 = ag11_service.scan_and_create_followup_plans()
    assert res1.get("success") is True

    # Scan again
    res2 = ag11_service.scan_and_create_followup_plans()
    assert res2.get("success") is True

    # Check database counts
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM ag11_followup_plans WHERE patient_id = %s AND discharge_summary_id = %s;", (patient_id, summary_id))
    count = cur.fetchone()[0]
    assert count == 1

    cur.close()
    conn.close()


def test_process_due_followup_tasks():
    patient_id, summary_id, phone = create_test_patient_and_discharge()
    ag11_service.scan_and_create_followup_plans()

    # Force task due dates to past
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute("UPDATE ag11_followup_tasks SET due_date = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE patient_id = %s;", (patient_id,))
    conn.commit()
    cur.close()
    conn.close()

    process_res = ag11_service.process_due_followup_tasks()
    assert process_res.get("success") is True
    assert process_res.get("processed_count") >= 1


def test_routine_response_evaluation():
    patient_id, summary_id, phone = create_test_patient_and_discharge()
    ag11_service.scan_and_create_followup_plans()

    eval_res = ag11_service.evaluate_patient_response(
        patient_id=patient_id,
        raw_text="I am doing great and pain is manageable",
        button_id="ag11_d3_well"
    )

    assert eval_res.get("handled") is True
    assert eval_res.get("response_type") == "ROUTINE_OK"
    assert "progressing smoothly" in eval_res.get("reply_message")


def test_concerning_symptoms_escalation():
    patient_id, summary_id, phone = create_test_patient_and_discharge()
    ag11_service.scan_and_create_followup_plans()

    eval_res = ag11_service.evaluate_patient_response(
        patient_id=patient_id,
        raw_text="My surgical wound is bleeding and red with fever",
        button_id="ag11_d3_symptoms"
    )

    assert eval_res.get("handled") is True
    assert eval_res.get("response_type") == "CONCERNING_SYMPTOMS"
    assert "Clinical Alert Logged" in eval_res.get("reply_message")

    # Verify clinical escalation record
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT status, severity FROM ag11_clinical_escalations WHERE patient_id = %s ORDER BY created_at DESC LIMIT 1;", (patient_id,))
    esc_row = cur.fetchone()
    assert esc_row is not None
    assert esc_row[0] == "OPEN"
    assert esc_row[1] == "HIGH"

    cur.close()
    conn.close()


def test_callback_request():
    patient_id, summary_id, phone = create_test_patient_and_discharge()
    ag11_service.scan_and_create_followup_plans()

    eval_res = ag11_service.evaluate_patient_response(
        patient_id=patient_id,
        raw_text="I need a nurse to call me back please",
        button_id="ag11_d3_callback"
    )

    assert eval_res.get("handled") is True
    assert eval_res.get("response_type") == "CALLBACK_REQUESTED"
    assert "Callback Request Confirmed" in eval_res.get("reply_message")

    # Verify callback record
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT status, priority FROM ag11_callbacks WHERE patient_id = %s ORDER BY created_at DESC LIMIT 1;", (patient_id,))
    cb_row = cur.fetchone()
    assert cb_row is not None
    assert cb_row[0] == "PENDING"

    cur.close()
    conn.close()


def test_overview_metrics_api():
    data = ag11_routes.get_overview_metrics()
    assert data.get("success") is True
    metrics = data.get("metrics", {})
    assert "active_plans" in metrics
    assert "open_escalations" in metrics
    assert "pending_callbacks" in metrics


def test_resolve_patient_for_whatsapp_ambiguous():
    """Test multi-patient resolution when 2 patients share the same phone number."""
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    shared_phone = f"+9198{uuid.uuid4().hex[:8]}"

    # Insert two patients sharing phone
    cur.execute("INSERT INTO patients (patient_code, first_name, last_name, phone, whatsapp_number) VALUES (%s, 'Pat1', 'Shared', %s, %s) RETURNING id;", (f"P1_{uuid.uuid4().hex[:4]}", shared_phone, shared_phone))
    p1_id = cur.fetchone()[0]
    cur.execute("INSERT INTO patients (patient_code, first_name, last_name, phone, whatsapp_number) VALUES (%s, 'Pat2', 'Shared', %s, %s) RETURNING id;", (f"P2_{uuid.uuid4().hex[:4]}", shared_phone, shared_phone))
    p2_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    res = ag11_service.resolve_patient_for_whatsapp(shared_phone)
    assert res.get("status") == "AMBIGUOUS"
    assert len(res.get("patients", [])) >= 2


def test_idempotent_webhook_deduplication():
    """Test duplicate webhook delivery returns already handled response without duplicating records."""
    patient_id, summary_id, phone = create_test_patient_and_discharge()
    ag11_service.scan_and_create_followup_plans()
    wamid = f"wamid.test.{uuid.uuid4().hex[:8]}"

    res1 = ag11_service.evaluate_patient_response(
        patient_id=patient_id,
        raw_text="Feeling well",
        button_id="ag11_d3_well",
        inbound_wamid=wamid
    )
    assert res1.get("handled") is True
    assert res1.get("duplicate") is not True

    # Duplicate call
    res2 = ag11_service.evaluate_patient_response(
        patient_id=patient_id,
        raw_text="Feeling well",
        button_id="ag11_d3_well",
        inbound_wamid=wamid
    )
    assert res2.get("handled") is True
    assert res2.get("duplicate") is True


def test_complete_callback_endpoint():
    patient_id, summary_id, phone = create_test_patient_and_discharge()
    ag11_service.scan_and_create_followup_plans()
    ag11_service.evaluate_patient_response(
        patient_id=patient_id,
        raw_text="Call me back please",
        button_id="ag11_d3_callback"
    )

    # Fetch created callback ID
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM ag11_callbacks WHERE patient_id = %s AND status = 'PENDING' LIMIT 1;", (patient_id,))
    cb_id = cur.fetchone()[0]
    cur.close()
    conn.close()

    # Complete callback with invalid user_id to verify FK fallback safety
    res1 = ag11_routes.complete_callback(cb_id, ag11_routes.CallbackActionRequest(user_id=999999, outcome_notes="Spoke to patient."))
    assert res1.get("success") is True

    # Retry completion (idempotency check)
    res2 = ag11_routes.complete_callback(cb_id, ag11_routes.CallbackActionRequest(user_id=999999, outcome_notes="Spoke to patient."))
    assert res2.get("success") is True
    assert res2.get("already_completed") is True


def test_resolve_escalation_endpoint():
    patient_id, summary_id, phone = create_test_patient_and_discharge()
    ag11_service.scan_and_create_followup_plans()
    ag11_service.evaluate_patient_response(
        patient_id=patient_id,
        raw_text="Severe wound bleeding and high fever",
        button_id="ag11_d3_symptoms"
    )

    # Fetch created escalation ID
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM ag11_clinical_escalations WHERE patient_id = %s AND status = 'OPEN' LIMIT 1;", (patient_id,))
    esc_id = cur.fetchone()[0]
    cur.close()
    conn.close()

    # Resolve escalation
    res1 = ag11_routes.resolve_clinical_escalation(esc_id, ag11_routes.EscalationActionRequest(user_id=999999, disposition_notes="Wound reviewed."))
    assert res1.get("success") is True

    # Retry resolution (idempotency check)
    res2 = ag11_routes.resolve_clinical_escalation(esc_id, ag11_routes.EscalationActionRequest(user_id=999999, disposition_notes="Wound reviewed."))
    assert res2.get("success") is True
    assert res2.get("already_resolved") is True


if __name__ == "__main__":
    print("=== Running Follow-up Agent Tests ===")
    test_scan_and_create_followup_plans()
    print("[PASS] test_scan_and_create_followup_plans passed")
    test_plan_creation_idempotency()
    print("[PASS] test_plan_creation_idempotency passed")
    test_process_due_followup_tasks()
    print("[PASS] test_process_due_followup_tasks passed")
    test_routine_response_evaluation()
    print("[PASS] test_routine_response_evaluation passed")
    test_concerning_symptoms_escalation()
    print("[PASS] test_concerning_symptoms_escalation passed")
    test_callback_request()
    print("[PASS] test_callback_request passed")
    test_overview_metrics_api()
    print("[PASS] test_overview_metrics_api passed")
    test_resolve_patient_for_whatsapp_ambiguous()
    print("[PASS] test_resolve_patient_for_whatsapp_ambiguous passed")
    test_idempotent_webhook_deduplication()
    print("[PASS] test_idempotent_webhook_deduplication passed")
    test_complete_callback_endpoint()
    print("[PASS] test_complete_callback_endpoint passed")
    test_resolve_escalation_endpoint()
    print("[PASS] test_resolve_escalation_endpoint passed")
    print("=== ALL FOLLOW-UP AGENT TESTS PASSED SUCCESSFULLY ===")



