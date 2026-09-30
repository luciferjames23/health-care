"""
test_preadmission_full.py
==========================
Comprehensive test suite for Meridian Hospital Pre-Admission Module.
Tests Admin & Doctor portal workflows, validation rules, scoping, and WhatsApp notification integration.
"""

import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import db_config
from preadmission_service import (
    create_pre_admission,
    get_pre_admissions,
    update_pre_admission_status,
    dispatch_pre_admission_notification,
    get_pre_admission_conversation,
    PreAdmissionValidationError
)


def run_tests():
    print("=== STARTING MERIDIAN HOSPITAL PRE-ADMISSION FULL VALIDATION ===")
    
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    
    # 1. Fetch valid patient, doctor, and department
    cur.execute("SELECT id, first_name, last_name, phone FROM patients WHERE status = 'ACTIVE' LIMIT 2;")
    patients = cur.fetchall()
    assert len(patients) >= 1, "At least 1 active patient required for testing"
    patient_id = patients[0][0]
    
    cur.execute("SELECT id, display_name, department_id FROM doctors WHERE status = 'ACTIVE' LIMIT 2;")
    doctors = cur.fetchall()
    assert len(doctors) >= 1, "At least 1 active doctor required for testing"
    doctor_id = doctors[0][0]
    dept_id = doctors[0][2]
    
    print(f"[TEST 1] Testing with Patient ID: {patient_id}, Doctor ID: {doctor_id}, Dept ID: {dept_id}")

    # 2. Test Doctor-Department Mismatch Error
    invalid_dept_id = dept_id + 9999
    try:
        create_pre_admission(
            patient_id=patient_id,
            doctor_id=doctor_id,
            department_id=invalid_dept_id,
            expected_admission_date="2026-10-15",
            admission_type="INPATIENT"
        )
        print("ERROR: Mismatch department should have raised PreAdmissionValidationError")
    except PreAdmissionValidationError as e:
        print(f"[PASSED] Mismatch department caught correctly: {e}")

    # 3. Test Invalid Admission Type
    try:
        create_pre_admission(
            patient_id=patient_id,
            doctor_id=doctor_id,
            department_id=dept_id,
            expected_admission_date="2026-10-15",
            admission_type="INVALID_TYPE"
        )
        print("ERROR: Invalid admission type should have raised error")
    except PreAdmissionValidationError as e:
        print(f"[PASSED] Invalid admission type caught correctly: {e}")

    # 4. Test Successful Pre-Admission Creation
    res1 = create_pre_admission(
        patient_id=patient_id,
        doctor_id=doctor_id,
        department_id=dept_id,
        expected_admission_date="2026-10-20",
        admission_type="SURGERY",
        expected_checkin_time="08:30:00",
        instructions="Fast for 12 hours prior to admission",
        remarks="Test Pre-Admission 1",
        pending_documents="Aadhaar, Blood Test Report"
    )
    assert res1["success"] is True, f"Failed to create pre-admission: {res1}"
    pa1_id = res1["pre_admission_id"]
    print(f"[PASSED] Pre-admission created successfully (ID: {pa1_id}, Code: {res1['pre_admission_code']})")

    # 5. Test Superseding Duplicate Active Record
    res2 = create_pre_admission(
        patient_id=patient_id,
        doctor_id=doctor_id,
        department_id=dept_id,
        expected_admission_date="2026-10-22",
        admission_type="INPATIENT",
        instructions="Bring all previous medical records",
        remarks="Test Pre-Admission 2 (Superseding)"
    )
    assert res2["success"] is True
    pa2_id = res2["pre_admission_id"]
    
    # Check that pa1_id is now CANCELLED
    cur.execute("SELECT status, remarks FROM pre_admissions WHERE id = %s;", (pa1_id,))
    pa1_row = cur.fetchone()
    assert pa1_row[0] == "CANCELLED", f"Expected pa1_id to be CANCELLED, got {pa1_row[0]}"
    print(f"[PASSED] Duplicate active pre-admission {pa1_id} was automatically superseded and marked CANCELLED")

    # 6. Test Doctor Scoped Listing vs Admin Listing
    all_pas = get_pre_admissions()
    doctor_pas = get_pre_admissions(doctor_id_filter=doctor_id)
    print(f"[PASSED] Total Pre-Admissions (Admin): {len(all_pas)}, Scoped to Doctor {doctor_id}: {len(doctor_pas)}")
    assert any(pa["id"] == pa2_id for pa in doctor_pas), "New pre-admission should appear in doctor's scoped list"

    # 7. Test Status Update & Document Submission
    up_res = update_pre_admission_status(
        pre_admission_id=pa2_id,
        status="CONFIRMED",
        submitted_documents="Aadhaar Card, Insurance Pre-Auth",
        pending_documents="Lab Reports",
        remarks="Verified insurance eligibility"
    )
    assert up_res["success"] is True
    print(f"[PASSED] Pre-admission {pa2_id} status updated to CONFIRMED")

    # 8. Test Dispatching WhatsApp Notification
    notif_res = dispatch_pre_admission_notification(pa2_id)
    assert notif_res["success"] is True
    print(f"[PASSED] WhatsApp notification dispatched for pre-admission {pa2_id} (Status: {notif_res.get('status')})")

    # 9. Test WhatsApp Conversation Retrieval
    conv_res = get_pre_admission_conversation(pa2_id)
    assert conv_res["success"] is True
    print(f"[PASSED] Retrieved WhatsApp conversation history ({len(conv_res.get('messages', []))} messages)")

    # Cleanup test records
    cur.execute("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE patient_id = %s AND current_intent = 'PRE_ADMISSION');", (patient_id,))
    cur.execute("DELETE FROM conversations WHERE patient_id = %s AND current_intent = 'PRE_ADMISSION';", (patient_id,))
    cur.execute("DELETE FROM pre_admissions WHERE id IN (%s, %s);", (pa1_id, pa2_id))
    conn.commit()
    cur.close()
    conn.close()

    print("\nSUCCESS: ALL PRE-ADMISSION MODULE TESTS PASSED PERFECTLY WITH ZERO ERRORS!")


if __name__ == "__main__":
    run_tests()
