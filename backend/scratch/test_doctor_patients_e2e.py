import requests
import json
import psycopg2
from psycopg2.extras import RealDictCursor
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

BASE_URL = "http://localhost:8000"

def test_e2e_doctor_patients():
    print("============================================================")
    print("TC01 & TC02 & TC03: Testing Doctor Identity Resolution & Patient List")
    print("============================================================")
    
    from api.auth_helper import encode_token
    token = encode_token({"user_id": 1022, "username": "EJ", "role": "DOCTOR", "doctor_id": 1017})
    doctor_id = 1017
    print(f"Auth Token Generated for Dr. Edwin Stephano J (doctor_id: {doctor_id})")

    headers = {"Authorization": f"Bearer {token}"}

    # Endpoint 1: GET /api/dashboard/patients (Used by MyPatients / PatientRecords / Backend Dashboard)
    print("\n[Endpoint 1] Querying GET /api/dashboard/patients...")
    resp_pats = requests.get(f"{BASE_URL}/api/dashboard/patients", headers=headers)
    print("Status:", resp_pats.status_code)
    assert resp_pats.status_code == 200
    pats_data = resp_pats.json()
    patients_list = pats_data.get("patients", [])
    total_pats = pats_data.get("total", 0)
    print(f"Total Patients returned: {total_pats}")
    for p in patients_list:
        print(f"  - ID: {p['id']}, Code: {p['patient_code']}, Name: {p['first_name']} {p['last_name']}, Status: {p['status']}")

    assert total_pats >= 3, f"Expected at least 3 patients for Dr. Edwin, got {total_pats}"

    # Endpoint 2: GET /api/v1/clinical-ops/all-patients?category=OP (Used by PatientsView)
    print("\n[Endpoint 2] Querying GET /api/v1/clinical-ops/all-patients?category=OP&doctor_id=1017...")
    resp_op = requests.get(f"{BASE_URL}/api/v1/clinical-ops/all-patients", params={"category": "OP", "doctor_id": doctor_id})
    print("Status:", resp_op.status_code)
    assert resp_op.status_code == 200
    op_data = resp_op.json()
    op_patients = op_data if isinstance(op_data, list) else op_data.get("data", [])
    print(f"Total OP Directory Patients returned: {len(op_patients)}")
    for p in op_patients:
        print(f"  - ID: {p['patient_id']}, Code: {p['patient_code']}, Name: {p['patient_name']}, Doctor: {p['doctor']}, Status: {p['status']}")

    assert len(op_patients) >= 3, f"Expected at least 3 OP directory patients for Dr. Edwin, got {len(op_patients)}"

    print("\n============================================================")
    print("TC04 & TC20: WhatsApp Appointment -> Doctor Patient E2E Workflow")
    print("============================================================")
    
    # Create an appointment via WhatsApp AI / Service for Dr. Edwin Stephano J with a test patient
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Pick patient 2666 (Gilbert) or create a fresh patient record for testing WhatsApp flow
    cur.execute("SELECT id, first_name, last_name FROM patients WHERE phone = '+91 99999 88888' OR patient_code = 'P_WA_TEST_01' LIMIT 1;")
    wa_patient = cur.fetchone()
    if not wa_patient:
        cur.execute("""
            INSERT INTO patients (patient_code, first_name, last_name, gender, date_of_birth, phone, whatsapp_number, status)
            VALUES ('P_WA_TEST_01', 'WhatsAppTest', 'Patient', 'Male', '1990-01-01', '+91 99999 88888', '+919999988888', 'ACTIVE')
            RETURNING id, first_name, last_name;
        """)
        wa_patient = cur.fetchone()
        conn.commit()

    wa_pid = wa_patient['id']
    print(f"Test WhatsApp Patient: ID {wa_pid}, Name: {wa_patient['first_name']} {wa_patient['last_name']}")

    # Insert a WhatsApp appointment for Dr. Edwin Stephano J (doctor_id 1017)
    cur.execute("SELECT id FROM appointments WHERE patient_id = %s AND doctor_id = 1017 LIMIT 1;", (wa_pid,))
    existing_apt = cur.fetchone()
    if not existing_apt:
        cur.execute("""
            INSERT INTO appointments (booking_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, status, booking_source, reason_for_visit)
            VALUES ('APT_WA_E2E_01', %s, 1017, 3, CURRENT_DATE, '10:00:00', 'CONFIRMED', 'WHATSAPP_TEXT', 'WhatsApp AI Consultation')
            RETURNING id, booking_id;
        """, (wa_pid,))
        apt_row = cur.fetchone()
        conn.commit()
        print(f"Created WhatsApp Appointment: {apt_row['booking_id']} for Doctor 1017")
    else:
        print("WhatsApp Appointment already exists.")

    conn.close()

    # Re-verify Endpoint 1
    resp_pats_2 = requests.get(f"{BASE_URL}/api/dashboard/patients", headers=headers)
    pats_list_2 = resp_pats_2.json().get("patients", [])
    wa_found_1 = any(p['id'] == wa_pid for p in pats_list_2)
    print(f"WhatsApp Patient {wa_pid} present in GET /api/dashboard/patients? {wa_found_1}")
    assert wa_found_1, "WhatsApp patient not found in GET /api/dashboard/patients!"

    # Re-verify Endpoint 2
    resp_op_2 = requests.get(f"{BASE_URL}/api/v1/clinical-ops/all-patients", params={"category": "OP", "doctor_id": 1017})
    res2 = resp_op_2.json()
    op_list_2 = res2 if isinstance(res2, list) else res2.get("data", [])
    wa_found_2 = any(p.get('patient_id') == wa_pid for p in op_list_2)
    print(f"WhatsApp Patient {wa_pid} present in GET /api/v1/clinical-ops/all-patients? {wa_found_2}")
    assert wa_found_2, "WhatsApp patient not found in GET /api/v1/clinical-ops/all-patients!"

    print("\nSUCCESS: All E2E Doctor Patient test cases PASSED perfectly!")

if __name__ == "__main__":
    test_e2e_doctor_patients()
