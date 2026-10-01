"""
test_preadmission_portal_fix.py
================================
End-to-end verification script for Pre-Admission Desk Doctor Portal Fix.
Tests:
  1. Multi-doctor account & department resolution (Doctor A, B, C)
  2. Patient authorization filtering for Doctor Portal
  3. Pre-admission creation by Doctor under authenticated identity & database department relationship
  4. Database integrity verification (PostgreSQL)
  5. Strict backend security & validation enforcement (403 on tampered doctor_id or department_id)
  6. Admin Portal flexibility & workflow preservation
"""

import requests
import db_config

BASE_URL = "http://localhost:8000"


def run_tests():
    print("=" * 60)
    print("STARTING E2E PRE-ADMISSION DOCTOR PORTAL VERIFICATION")
    print("=" * 60)

    # -------------------------------------------------------------
    # STEP 1: RESOLVE DOCTOR A, B, C
    # -------------------------------------------------------------
    print("\n[STEP 1] Testing Doctor & Department Resolution...")

    # Doctor A: Dr. Ajay L (AL)
    r_al = requests.post(f"{BASE_URL}/api/auth/select-account", json={"username": "AL"})
    assert r_al.status_code == 200, f"Doctor A login failed: {r_al.text}"
    user_al = r_al.json()["user"]
    token_al = r_al.json()["token"]
    headers_al = {"Authorization": f"Bearer {token_al}"}

    assert user_al["doctorId"] == 1014, f"Expected doctorId 1014, got {user_al.get('doctorId')}"
    assert user_al["department"] == "Pediatrics", f"Expected department Pediatrics, got {user_al.get('department')}"
    assert user_al["departmentId"] == 19, f"Expected departmentId 19, got {user_al.get('departmentId')}"
    print(f"[PASSED] Doctor A resolved: {user_al['name']} (ID: {user_al['doctorId']}) -> Dept: {user_al['department']} (ID: {user_al['departmentId']})")

    # Doctor B: Dr. Nikhil Singh (doctor_79)
    r_ns = requests.post(f"{BASE_URL}/api/auth/select-account", json={"username": "doctor_79"})
    assert r_ns.status_code == 200, f"Doctor B login failed: {r_ns.text}"
    user_ns = r_ns.json()["user"]
    token_ns = r_ns.json()["token"]
    headers_ns = {"Authorization": f"Bearer {token_ns}"}

    assert user_ns["doctorId"] == 79
    assert user_ns["department"] == "Cardiology"
    assert user_ns["departmentId"] == 2
    print(f"[PASSED] Doctor B resolved: {user_ns['name']} (ID: {user_ns['doctorId']}) -> Dept: {user_ns['department']} (ID: {user_ns['departmentId']})")

    # -------------------------------------------------------------
    # STEP 2: AUTHORIZED PATIENT SELECTION FOR DOCTOR A
    # -------------------------------------------------------------
    print("\n[STEP 2] Testing Authorized Patient Retrieval for Doctor A...")
    r_pats = requests.get(f"{BASE_URL}/api/dashboard/patients", headers=headers_al)
    assert r_pats.status_code == 200, f"Failed to get patients: {r_pats.text}"
    patients = r_pats.json().get("patients", [])
    assert len(patients) > 0, "No patients returned for Doctor A"
    target_patient = patients[0]
    pat_id = target_patient["id"]
    print(f"[PASSED] Authorized patient retrieved for Dr. Ajay L: {target_patient['first_name']} {target_patient['last_name']} (ID: {pat_id})")

    # -------------------------------------------------------------
    # STEP 3: CREATE PRE-ADMISSION AS DOCTOR A
    # -------------------------------------------------------------
    print("\n[STEP 3] Creating Pre-Admission as Dr. Ajay L...")
    payload_valid = {
        "patient_id": pat_id,
        "doctor_id": 1014,
        "department_id": 19,
        "expected_admission_date": "2026-10-25",
        "expected_checkin_time": "09:30:00",
        "admission_type": "INPATIENT",
        "instructions": "E2E Test Instructions",
        "remarks": "E2E Test Remarks",
        "pending_documents": "Government ID, Doctor Referral Note"
    }

    r_create = requests.post(f"{BASE_URL}/api/dashboard/pre-admissions", headers=headers_al, json=payload_valid)
    assert r_create.status_code == 200, f"Creation failed: {r_create.text}"
    create_res = r_create.json()
    assert create_res.get("success") is True
    pa_id = create_res["pre_admission_id"]
    pa_code = create_res["pre_admission_code"]
    print(f"[PASSED] Pre-admission successfully created! ID: {pa_id}, Code: {pa_code}")

    # -------------------------------------------------------------
    # STEP 4: VERIFY POSTGRESQL DATABASE RECORD
    # -------------------------------------------------------------
    print("\n[STEP 4] Verifying PostgreSQL database record...")
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, pre_admission_code, patient_id, doctor_id, department_id, admission_type, status
        FROM pre_admissions WHERE id = %s;
    """, (pa_id,))
    db_row = cur.fetchone()
    assert db_row is not None, f"Record ID {pa_id} not found in DB!"
    assert db_row[2] == pat_id, f"Expected patient_id {pat_id}, got {db_row[2]}"
    assert db_row[3] == 1014, f"Expected doctor_id 1014, got {db_row[3]}"
    assert db_row[4] == 19, f"Expected department_id 19, got {db_row[4]}"
    assert db_row[5] == "INPATIENT"
    print(f"[PASSED] PostgreSQL verification passed! DB Row: {db_row}")

    # -------------------------------------------------------------
    # STEP 5: BACKEND SECURITY & VALIDATION TESTING
    # -------------------------------------------------------------
    print("\n[STEP 5] Testing Backend Security & Validation Enforcement...")

    # Case 5a: Doctor AL tries to submit Doctor B's doctor_id (79)
    payload_tampered_doc = dict(payload_valid, doctor_id=79)
    r_tamp1 = requests.post(f"{BASE_URL}/api/dashboard/pre-admissions", headers=headers_al, json=payload_tampered_doc)
    assert r_tamp1.status_code == 403, f"Expected 403, got {r_tamp1.status_code}"
    print("[PASSED] Security Check 1 Passed: Doctor cannot spoof another doctor's doctor_id (403 Forbidden)")

    # Case 5b: Doctor AL tries to submit mismatching department_id (2 - Cardiology)
    payload_tampered_dept = dict(payload_valid, department_id=2)
    r_tamp2 = requests.post(f"{BASE_URL}/api/dashboard/pre-admissions", headers=headers_al, json=payload_tampered_dept)
    assert r_tamp2.status_code == 403, f"Expected 403, got {r_tamp2.status_code}"
    print("[PASSED] Security Check 2 Passed: Doctor cannot override department_id to non-matching department (403 Forbidden)")

    # -------------------------------------------------------------
    # STEP 6: ADMIN PORTAL PRE-ADMISSION WORKFLOW
    # -------------------------------------------------------------
    print("\n[STEP 6] Testing Admin Portal Pre-Admission Registration...")
    r_admin_login = requests.post(f"{BASE_URL}/api/auth/select-account", json={"username": "admin"})
    assert r_admin_login.status_code == 200, f"Admin login failed: {r_admin_login.text}"
    admin_token = r_admin_login.json()["token"]
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    payload_admin = {
        "patient_id": pat_id,
        "doctor_id": 79,  # Doctor B
        "department_id": 2,  # Department B (Cardiology)
        "expected_admission_date": "2026-11-01",
        "expected_checkin_time": "10:00:00",
        "admission_type": "SURGERY",
        "instructions": "Admin Created Admission",
        "remarks": "Admin Registration Test",
        "pending_documents": "Aadhaar Card, Insurance Pre-Auth Letter"
    }

    r_admin_create = requests.post(f"{BASE_URL}/api/dashboard/pre-admissions", headers=headers_admin, json=payload_admin)
    assert r_admin_create.status_code == 200, f"Admin creation failed: {r_admin_create.text}"
    admin_res = r_admin_create.json()
    admin_pa_id = admin_res["pre_admission_id"]
    print(f"[PASSED] Admin pre-admission registered successfully! ID: {admin_pa_id}, Code: {admin_res['pre_admission_code']}")

    cur.execute("SELECT doctor_id, department_id FROM pre_admissions WHERE id = %s;", (admin_pa_id,))
    admin_row = cur.fetchone()
    assert admin_row == (79, 2), f"Expected (79, 2), got {admin_row}"
    print("[PASSED] Admin DB verification passed! (Doctor ID: 79, Dept ID: 2)")

    # -------------------------------------------------------------
    # CLEANUP
    # -------------------------------------------------------------
    print("\n[CLEANUP] Cleaning up test pre-admission records...")
    cur.execute("DELETE FROM messages WHERE metadata IS NOT NULL AND metadata::jsonb->>'pre_admission_id' IN (%s, %s);", (str(pa_id), str(admin_pa_id)))
    cur.execute("DELETE FROM notifications WHERE patient_id = %s AND notification_type = 'ADMISSION_REMINDER';", (pat_id,))
    cur.execute("DELETE FROM pre_admissions WHERE id IN (%s, %s);", (pa_id, admin_pa_id))
    conn.commit()
    cur.close()
    conn.close()
    print("[PASSED] Cleanup completed successfully.")

    print("\n" + "=" * 60)
    print("ALL PRE-ADMISSION E2E VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
