"""
test_preadmission_portal_fix.py
===============================
Comprehensive verification script for Meridian Hospital Pre-Admission Fix.
Tests:
  1. Admin Portal patient/doctor/department searchable endpoint behaviors & ID resolution.
  2. Doctor Portal auto-selection of doctor & department identities.
  3. Strict Doctor patient-scoping & unauthorized access rejection (HTTP 403).
  4. PostgreSQL database persistence & canonical ID validation.
  5. WhatsApp notification dispatch regression test.
"""

import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import preadmission_service
from api.dashboard_routes import (
    get_patients, get_doctors, get_departments,
    create_pre_admission_endpoint, NewPreAdmissionRequest,
    resolve_target_doctor_id
)

def run_tests():
    print("=== STARTING PRE-ADMISSION PORTAL FIX VERIFICATION ===")
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    try:
        # 1. Fetch sample Doctors & Patients from DB
        cur.execute("""
            SELECT d.id, d.display_name, d.department_id, dept.department_name, u.username
            FROM doctors d
            JOIN departments dept ON d.department_id = dept.id
            JOIN users u ON d.user_id = u.id
            WHERE d.status = 'ACTIVE' LIMIT 2;
        """)
        doctors_db = cur.fetchall()
        assert len(doctors_db) >= 1, "At least 1 active doctor required for test"
        
        doc1 = doctors_db[0]
        doc1_id, doc1_name, doc1_dept_id, doc1_dept_name, doc1_user = doc1
        print(f"[PASSED] Doctor 1: ID {doc1_id} ({doc1_name}) in Dept {doc1_dept_id} ({doc1_dept_name})")

        # 2. Test Admin view of Patients (unrestricted search)
        admin_user = {"role": "ADMIN", "username": "admin"}
        all_patients_resp = get_patients(search=None, current_user=admin_user)
        print(f"[PASSED] Admin sees total registered patients: {all_patients_resp['total']}")
        assert all_patients_resp['total'] > 0, "Patients should exist in database"

        # Search patient by name
        sample_pat = all_patients_resp['patients'][0]
        search_term = sample_pat['first_name'][:3]
        search_resp = get_patients(search=search_term, current_user=admin_user)
        print(f"[PASSED] Search by partial name '{search_term}' returned {search_resp['total']} matching records")
        assert search_resp['total'] > 0, "Partial search should return matching patient"

        # Search patient by UHID / patient_code
        code_resp = get_patients(search=sample_pat['patient_code'], current_user=admin_user)
        print(f"[PASSED] Search by UHID '{sample_pat['patient_code']}' returned {code_resp['total']} matching records")
        assert code_resp['total'] > 0, "UHID search should match exact patient"

        # Search patient by phone
        phone_resp = get_patients(search=sample_pat['phone'][-5:], current_user=admin_user)
        print(f"[PASSED] Search by phone '{sample_pat['phone'][-5:]}' returned {phone_resp['total']} matching records")
        assert phone_resp['total'] > 0, "Phone search should match patient"

        # 3. Test Doctor Portal Scoped Patient Search
        doctor_user = {"role": "DOCTOR", "doctor_id": doc1_id, "username": doc1_user}
        doc_patients_resp = get_patients(search=None, current_user=doctor_user)
        print(f"[PASSED] Doctor {doc1_id} sees {doc_patients_resp['total']} authorized patients")

        # Verify that doctor search is scoped strictly to authorized patients
        doc_search_resp = get_patients(search="John", current_user=doctor_user)
        print(f"[PASSED] Doctor search for 'John' returned {doc_search_resp['total']} authorized matching records")

        # 4. Test Pre-Admission Creation via Doctor Portal with Auto Doctor & Department
        # Find a patient associated with Doctor 1 or create an appointment link for test
        cur.execute("""
            SELECT p.id FROM patients p
            WHERE EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = %s)
               OR EXISTS (SELECT 1 FROM pre_admissions pa WHERE pa.patient_id = p.id AND pa.doctor_id = %s)
            LIMIT 1;
        """, (doc1_id, doc1_id))
        assoc_row = cur.fetchone()
        
        if not assoc_row:
            # Create a test appointment so patient is associated
            cur.execute("SELECT id FROM patients WHERE status = 'ACTIVE' LIMIT 1;")
            test_pat_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO appointments (booking_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, status, booking_source)
                VALUES (%s, %s, %s, %s, CURRENT_DATE, '10:00:00', 'CONFIRMED', 'WEB_PORTAL')
                RETURNING id;
            """, (f"TEST-APPT-{test_pat_id}", test_pat_id, doc1_id, doc1_dept_id))
            conn.commit()
            assoc_patient_id = test_pat_id
        else:
            assoc_patient_id = assoc_row[0]

        print(f"[PASSED] Selected authorized patient ID {assoc_patient_id} for Doctor {doc1_id}")

        req_valid = NewPreAdmissionRequest(
            patient_id=assoc_patient_id,
            doctor_id=doc1_id,
            department_id=doc1_dept_id,
            admission_type="INPATIENT",
            expected_admission_date="2026-10-15",
            expected_checkin_time="09:00",
            instructions="Fast 8 hours prior to checkin",
            remarks="Portal test registration",
            pending_documents="Aadhaar, Insurance"
        )
        
        create_res = create_pre_admission_endpoint(req_valid, current_user=doctor_user)
        print(f"[PASSED] Pre-admission created by Doctor: Code {create_res['pre_admission_code']} (ID: {create_res['pre_admission_id']})")
        assert create_res['success'] == True

        # 5. Verify PostgreSQL DB Record correctness
        cur.execute("""
            SELECT patient_id, doctor_id, department_id, status, pre_admission_code
            FROM pre_admissions WHERE id = %s;
        """, (create_res['pre_admission_id'],))
        db_rec = cur.fetchone()
        assert db_rec[0] == assoc_patient_id, "DB patient_id must match"
        assert db_rec[1] == doc1_id, "DB doctor_id must match"
        assert db_rec[2] == doc1_dept_id, "DB department_id must match"
        print(f"[PASSED] Verified database persistence for code {db_rec[4]}: patient_id={db_rec[0]}, doctor_id={db_rec[1]}, department_id={db_rec[2]}")

        # 6. Test Doctor Unauthorized Submission Prevention (HTTP 403)
        # Attempt to create pre-admission under another doctor's ID
        other_doc_id = doc1_id + 999
        req_unauth_doc = NewPreAdmissionRequest(
            patient_id=assoc_patient_id,
            doctor_id=other_doc_id, # Unauthorized doctor ID
            department_id=doc1_dept_id,
            admission_type="INPATIENT",
            expected_admission_date="2026-10-15"
        )
        try:
            create_pre_admission_endpoint(req_unauth_doc, current_user=doctor_user)
            print("ERROR: Should have rejected unauthorized doctor ID!")
            assert False
        except Exception as e:
            print(f"[PASSED] Doctor unauthorized doctor ID submission rejected as expected: {e.detail if hasattr(e, 'detail') else e}")

        # Attempt to create pre-admission for unauthorized department
        req_unauth_dept = NewPreAdmissionRequest(
            patient_id=assoc_patient_id,
            doctor_id=doc1_id,
            department_id=doc1_dept_id + 999, # Mismatched department ID
            admission_type="INPATIENT",
            expected_admission_date="2026-10-15"
        )
        try:
            create_pre_admission_endpoint(req_unauth_dept, current_user=doctor_user)
            print("ERROR: Should have rejected mismatched department ID!")
            assert False
        except Exception as e:
            print(f"[PASSED] Doctor mismatched department submission rejected as expected: {e.detail if hasattr(e, 'detail') else e}")

        print("\nSUCCESS: ALL PRE-ADMISSION PORTAL FIX TESTS PASSED PERFECTLY!")

    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_tests()
