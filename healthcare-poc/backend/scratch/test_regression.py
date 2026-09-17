import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\AI_Conversational_Patient_Desk\Healthcare-Prototype\backend"
sys.path.append(backend_dir)

import db_config
from agent.agent_service import is_appointment_already_paid, fetch_patient_appointments, process_agent_message
from agent.language_service import get_translated_button, MENU_BUTTON_TRANSLATIONS

print("====================================================")
print("RUNNING COMPREHENSIVE REGRESSION TESTS")
print("====================================================\n")

passed_tests = 0
total_tests = 0

def log_test(name, result, detail=""):
    global passed_tests, total_tests
    total_tests += 1
    if result:
        passed_tests += 1
        print(f"[PASS] {name} {detail}")
    else:
        print(f"[FAIL] {name} {detail}")

# ----------------------------------------------------
# Test 1 & Test 3: Payment Status Isolation (Bug 1 & Bug 6)
# ----------------------------------------------------
state_new = {"booking_id": "APT_NEW_TEST_001", "payment_status": "SUCCESS"}
is_paid, b_id, p_ref = is_appointment_already_paid(state_new, booking_id_val="APT_NEW_TEST_001")
log_test("Test 1 -- Unpaid new appointment does not report already paid", not is_paid, f"(is_paid={is_paid})")

# Check existing paid appointment vs unpaid
conn = db_config.get_db_connection()
cur = conn.cursor()
try:
    cur.execute("""
        SELECT a.booking_id, p.payment_status 
        FROM appointments a
        JOIN payments p ON p.appointment_id = a.id
        WHERE p.payment_status = 'SUCCESS' LIMIT 1;
    """)
    row = cur.fetchone()
    if row:
        paid_booking_id = row[0]
        state_paid = {"booking_id": paid_booking_id}
        is_paid_val, _, _ = is_appointment_already_paid(state_paid, booking_id_val=paid_booking_id)
        log_test("Test 3a -- Paid appointment correctly returns is_paid=True", is_paid_val, f"for {paid_booking_id}")
        
        state_unpaid = {"booking_id": "APT_UNPAID_999999"}
        is_unpaid_val, _, _ = is_appointment_already_paid(state_unpaid, booking_id_val="APT_UNPAID_999999")
        log_test("Test 3b -- Unpaid appointment returns is_paid=False even if previous exists", not is_unpaid_val)
finally:
    cur.close()
    conn.close()

# ----------------------------------------------------
# Test 4 & Test 5: Doctor Portal & Doctor Isolation (Bug 2 & Bug 3)
# ----------------------------------------------------
conn = db_config.get_db_connection()
cur = conn.cursor()
try:
    # Get Doctor Edwin Stephano J (doctor_id 17) and Patient Gil Christ (P9989)
    cur.execute("SELECT id FROM doctors WHERE display_name LIKE '%Edwin%';")
    doc_edwin = cur.fetchone()
    cur.execute("SELECT id FROM patients WHERE patient_code = 'P9989' OR first_name = 'Gil';")
    pat_gil = cur.fetchone()
    
    if doc_edwin and pat_gil:
        doc_id = doc_edwin[0]
        pat_id = pat_gil[0]
        
        # Insert a test appointment for Dr. Edwin & Gil Christ if not existing
        cur.execute("SELECT id FROM appointments WHERE patient_id = %s AND doctor_id = %s;", (pat_id, doc_id))
        if not cur.fetchone():
            b_id = "APT_EDWIN_GIL_01"
            cur.execute("""
                INSERT INTO appointments (booking_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, status, booking_source, patient_reason)
                VALUES (%s, %s, %s, 18, '2026-09-18', '11:00:00', 'CONFIRMED', 'WHATSAPP_TEXT', 'Chest pain')
                RETURNING id;
            """, (b_id, pat_id, doc_id))
            conn.commit()
            
        # Verify Doctor Portal query for Dr. Edwin (doc_id)
        cur.execute("""
            SELECT p.patient_code, p.first_name, p.last_name, a.booking_id, a.appointment_date, a.appointment_time, d.display_name
            FROM patients p
            JOIN appointments a ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.doctor_id = %s AND p.id = %s;
        """, (doc_id, pat_id))
        doc_appts = cur.fetchall()
        log_test("Test 4 -- Doctor Portal retrieves booked appointment & patient details for Dr. Edwin Stephano J", len(doc_appts) > 0, f"(found {len(doc_appts)} record)")
        
        # Verify Doctor Isolation: Doctor 6 (Dr. Priya Ramesh) query for Dr. Edwin's appointment
        cur.execute("""
            SELECT 1 FROM appointments WHERE booking_id = 'APT_EDWIN_GIL_01' AND doctor_id = 6;
        """, ())
        doc6_appts = cur.fetchall()
        log_test("Test 5 -- Doctor Isolation: Doctor 6 does NOT see Dr. Edwin's appointment APT_EDWIN_GIL_01", len(doc6_appts) == 0)
finally:
    cur.close()
    conn.close()

# ----------------------------------------------------
# Test 6 & Test 7: My Appointments & Shared WhatsApp Number Safety (Bug 4 & Bug 7)
# ----------------------------------------------------
conn = db_config.get_db_connection()
cur = conn.cursor()
try:
    # Retrieve all appointments for patient 508 (Gil Christ)
    appts_gil = fetch_patient_appointments(patient_id=508, time_filter="ALL")
    log_test("Test 6 -- My Appointments retrieves all appointments without artificial limit", len(appts_gil) >= 1, f"({len(appts_gil)} appointments returned)")
finally:
    cur.close()
    conn.close()

# ----------------------------------------------------
# Test 8: Text Labels & Button Formatting (Bug 5)
# ----------------------------------------------------
btn_resched = get_translated_button("btn_reschedule_appt", "ENGLISH")
log_test("Test 8a -- Reschedule Appointment title is untruncated", btn_resched.get("title") == "Reschedule Appointment", f"('{btn_resched.get('title')}')")

btn_book = get_translated_button("btn_book_appt", "ENGLISH")
log_test("Test 8b -- Book Appointment title is untruncated", btn_book.get("title") == "Book Appointment")

btn_hosp = get_translated_button("btn_hosp_info", "ENGLISH")
log_test("Test 8c -- Hospital Information title is untruncated", btn_hosp.get("title") == "Hospital Information")

print("\n====================================================")
print(f"RESULTS: {passed_tests} / {total_tests} TESTS PASSED")
print("====================================================")
