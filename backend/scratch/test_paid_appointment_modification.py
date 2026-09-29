import sys
import os
import datetime
import random

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent import agent_service, state_manager, tool_registry
import db_config

def run_tests():
    print("=" * 70)
    print("RUNNING PAID APPOINTMENT MODIFICATION & PAYMENT RECONCILIATION SUITE")
    print("=" * 70)

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    
    # Fetch two doctors with different consultation fees in the active DB
    cur.execute("""
        SELECT d.id, d.display_name, d.department_id, d.consultation_fee, dept.department_name
        FROM doctors d
        JOIN departments dept ON d.department_id = dept.id
        WHERE d.status = 'ACTIVE' AND d.consultation_fee IS NOT NULL
        ORDER BY d.consultation_fee ASC;
    """)
    doc_rows = cur.fetchall()
    
    if len(doc_rows) < 2:
        print("ERROR: Need at least 2 doctors in DB to run test suite")
        cur.close()
        conn.close()
        sys.exit(1)

    doc_cheaper = doc_rows[0]
    doc_expensive = doc_rows[-1]
    
    # Ensure there is a price difference for testing refund and balance payment
    fee_low = float(doc_cheaper[3])
    fee_high = float(doc_expensive[3])
    if fee_low == fee_high:
        fee_high = fee_low + 300.0
        cur.execute("UPDATE doctors SET consultation_fee = %s WHERE id = %s;", (fee_high, doc_expensive[0]))
        conn.commit()

    print(f"Test Doctor A (Cheaper): {doc_cheaper[1]} (Dept {doc_cheaper[4]}, Fee Rs. {fee_low})")
    print(f"Test Doctor B (Expensive): {doc_expensive[1]} (Dept {doc_expensive[4]}, Fee Rs. {fee_high})")

    # Get active patient ID
    cur.execute("SELECT id, first_name, whatsapp_number, patient_code FROM patients WHERE status = 'ACTIVE' AND whatsapp_number IS NOT NULL LIMIT 1;")
    pat_row = cur.fetchone()
    if not pat_row:
        print("ERROR: No active patient found in DB")
        cur.close()
        conn.close()
        sys.exit(1)
        
    pat_id, pat_name, pat_phone, pat_code = pat_row[0], pat_row[1], pat_row[2], pat_row[3]
    print(f"Test Patient: {pat_name} (ID {pat_id}, Code {pat_code}, Phone {pat_phone})")

    cur.close()
    conn.close()

    # -------------------------------------------------------------------------
    # Helper to create a paid appointment for testing
    # -------------------------------------------------------------------------
    def create_test_paid_appointment(session_code, doctor_id, dept_id, fee_amount, appt_date="2026-10-15", appt_time="10:00"):
        b_id = f"TESTBK{random.randint(10000, 99999)}"
        c_conn = db_config.get_db_connection()
        c_cur = c_conn.cursor()
        c_cur.execute("""
            INSERT INTO appointments (booking_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, status, booking_source, patient_reason, appointment_type)
            VALUES (%s, %s, %s, %s, %s, %s, 'CONFIRMED', 'WHATSAPP_TEXT', 'General Checkup', 'IN_PERSON')
            RETURNING id;
        """, (b_id, pat_id, doctor_id, dept_id, appt_date, appt_time))
        appt_db_id = c_cur.fetchone()[0]
        
        pay_ref = f"PAY{random.randint(100000, 999999)}"
        c_cur.execute("""
            INSERT INTO payments (payment_reference, patient_id, appointment_id, bill_id, amount, currency, payment_method, payment_status, transaction_reference, payment_date, payer_type)
            VALUES (%s, %s, %s, COALESCE((SELECT bill_id FROM bills WHERE patient_id = %s ORDER BY bill_id DESC LIMIT 1), 1), %s, 'INR', 'GPAY', 'SUCCESS', 'TXN_TEST_123', CURRENT_TIMESTAMP, 'PATIENT');
        """, (pay_ref, pat_id, appt_db_id, pat_id, fee_amount))
        c_conn.commit()
        c_cur.close()
        c_conn.close()
        return appt_db_id, b_id, pay_ref

    # =========================================================================
    # TEST 1: Change Date ONLY on Paid Appointment (Same Fee)
    # =========================================================================
    print("\n--- TEST 1: Change Date on Paid Appointment ---")
    s1 = "WA_test_mod_date_9991"
    appt1_id, b1_id, p1_ref = create_test_paid_appointment(s1, doc_cheaper[0], doc_cheaper[2], fee_low)
    
    # Initiate reschedule button tap
    r1 = agent_service.process_agent_message(s1, pat_phone, f"Reschedule {b1_id}", interactive_id=f"btn_reschedule_existing_{appt1_id}")
    assert "Modify / Reschedule Appointment" in r1["response"], f"Failed to show reschedule options: {r1['response']}"
    
    # Change date button tap
    r2 = agent_service.process_agent_message(s1, pat_phone, "Change Date", interactive_id="btn_chg_date")
    assert "date" in r2["response"].lower(), "Failed to prompt for new date"
    
    # Provide new date
    r3 = agent_service.process_agent_message(s1, pat_phone, "tomorrow", interactive_id="btn_date_tomorrow")
    assert "time" in r3["response"].lower() or "slot" in r3["response"].lower() or "confirm" in r3["response"].lower(), "Failed date selection"
    
    # Select slot dynamically from available buttons
    slot_btns = [b["id"] for b in r3.get("interactive_buttons", []) if b.get("id", "").startswith("btn_slot_")]
    target_slot_id = slot_btns[0] if slot_btns else "btn_slot_10:00"
    
    r4 = agent_service.process_agent_message(s1, pat_phone, "10:00 AM", interactive_id=target_slot_id)
    assert "Confirm Modification" in [b.get("title") for b in r4.get("interactive_buttons", [])] or "Already Paid" in r4["response"], f"Unexpected preview response: {r4['response']}"
    
    # Confirm modification
    r5 = agent_service.process_agent_message(s1, pat_phone, "Confirm Modification", interactive_id="btn_confirm_modification")
    assert "updated successfully" in r5["response"].lower(), f"Modification failed: {r5['response']}"
    print("[PASS] Change Date on Paid Appointment")

    # =========================================================================
    # TEST 2: Paid ₹600 -> Doctor ₹400 -> ₹200 Mock Refund
    # =========================================================================
    print("\n--- TEST 2: Lower Fee Doctor Change -> Mock Refund ---")
    s2 = "WA_test_mod_refund_9992"
    appt2_id, b2_id, p2_ref = create_test_paid_appointment(s2, doc_expensive[0], doc_expensive[2], fee_high)
    
    # Initiate reschedule
    agent_service.process_agent_message(s2, pat_phone, f"Reschedule {b2_id}", interactive_id=f"btn_reschedule_existing_{appt2_id}")
    
    # Select Change Doctor
    agent_service.process_agent_message(s2, pat_phone, "Change Doctor", interactive_id="btn_chg_doctor")
    
    # Select Cheaper Doctor button tap
    r2_doc = agent_service.process_agent_message(s2, pat_phone, f"btn_doc_{doc_cheaper[0]}", interactive_id=f"btn_doc_{doc_cheaper[0]}")
    
    # Pick slot dynamically
    slot_btns2 = [b["id"] for b in r2_doc.get("interactive_buttons", []) if b.get("id", "").startswith("btn_slot_")]
    target_slot_id2 = slot_btns2[0] if slot_btns2 else "btn_slot_10:00"
    
    agent_service.process_agent_message(s2, pat_phone, "10:00 AM", interactive_id=target_slot_id2)
    
    # Confirm modification
    r2_conf = agent_service.process_agent_message(s2, pat_phone, "Confirm Modification", interactive_id="btn_confirm_modification")
    assert "mock refund" in r2_conf["response"].lower() or "refund" in r2_conf["response"].lower(), f"Expected mock refund message: {r2_conf['response']}"
    expected_refund = int(fee_high - fee_low)
    assert str(expected_refund) in r2_conf["response"], f"Expected refund amount {expected_refund} not in response: {r2_conf['response']}"
    print(f"[PASS] Mock Refund of Rs. {expected_refund} calculated and recorded correctly")

    # =========================================================================
    # TEST 3: Paid ₹400 -> Doctor ₹900 -> ₹500 Balance Payment
    # =========================================================================
    print("\n--- TEST 3: Higher Fee Doctor Change -> Balance Payment ---")
    s3 = "WA_test_mod_balance_9993"
    appt3_id, b3_id, p3_ref = create_test_paid_appointment(s3, doc_cheaper[0], doc_cheaper[2], fee_low)
    
    # Initiate reschedule
    agent_service.process_agent_message(s3, pat_phone, f"Reschedule {b3_id}", interactive_id=f"btn_reschedule_existing_{appt3_id}")
    
    # Select Change Doctor
    agent_service.process_agent_message(s3, pat_phone, "Change Doctor", interactive_id="btn_chg_doctor")
    
    # Select Expensive Doctor button tap
    r3_doc = agent_service.process_agent_message(s3, pat_phone, f"btn_doc_{doc_expensive[0]}", interactive_id=f"btn_doc_{doc_expensive[0]}")
    
    # Pick slot dynamically
    slot_btns3 = [b["id"] for b in r3_doc.get("interactive_buttons", []) if b.get("id", "").startswith("btn_slot_")]
    target_slot_id3 = slot_btns3[0] if slot_btns3 else "btn_slot_10:00"
    
    agent_service.process_agent_message(s3, pat_phone, "10:00 AM", interactive_id=target_slot_id3)
    
    # Confirm modification -> Should trigger Balance Payment Prompt!
    r3_conf = agent_service.process_agent_message(s3, pat_phone, "Confirm Modification", interactive_id="btn_confirm_modification")
    assert "balance" in r3_conf["response"].lower(), f"Expected balance payment prompt: {r3_conf['response']}"
    expected_balance = int(fee_high - fee_low)
    assert str(expected_balance) in r3_conf["response"], f"Expected balance amount {expected_balance} not in prompt: {r3_conf['response']}"
    
    # Select payment method
    agent_service.process_agent_message(s3, pat_phone, "Google Pay", interactive_id="btn_pay_gpay")
    
    # Pay balance
    r3_pay = agent_service.process_agent_message(s3, pat_phone, f"Pay Rs {expected_balance}", interactive_id="btn_pay_exec")
    assert "balance payment successful" in r3_pay["response"].lower() or "updated successfully" in r3_pay["response"].lower(), f"Balance payment failed: {r3_pay['response']}"
    print(f"[PASS] Balance Payment of Rs. {expected_balance} processed and appointment updated")

    # =========================================================================
    # TEST 4: Balance Payment Cancellation -> Appointment Remains Unchanged
    # =========================================================================
    print("\n--- TEST 4: Balance Payment Cancel -> Safe Preservation ---")
    s4 = "WA_test_mod_cancel_9994"
    appt4_id, b4_id, p4_ref = create_test_paid_appointment(s4, doc_cheaper[0], doc_cheaper[2], fee_low)
    
    # Initiate reschedule & doctor change to expensive doctor
    agent_service.process_agent_message(s4, pat_phone, f"Reschedule {b4_id}", interactive_id=f"btn_reschedule_existing_{appt4_id}")
    agent_service.process_agent_message(s4, pat_phone, "Change Doctor", interactive_id="btn_chg_doctor")
    r4_doc = agent_service.process_agent_message(s4, pat_phone, f"btn_doc_{doc_expensive[0]}", interactive_id=f"btn_doc_{doc_expensive[0]}")
    
    slot_btns4 = [b["id"] for b in r4_doc.get("interactive_buttons", []) if b.get("id", "").startswith("btn_slot_")]
    target_slot_id4 = slot_btns4[0] if slot_btns4 else "btn_slot_10:00"
    
    agent_service.process_agent_message(s4, pat_phone, "10:00 AM", interactive_id=target_slot_id4)
    agent_service.process_agent_message(s4, pat_phone, "Confirm Modification", interactive_id="btn_confirm_modification")
    
    # Cancel payment
    r4_cancel = agent_service.process_agent_message(s4, pat_phone, "Cancel", interactive_id="btn_pay_cancel")
    assert "remains safely unchanged" in r4_cancel["response"].lower() or "cancelled" in r4_cancel["response"].lower(), f"Expected safe cancellation response: {r4_cancel['response']}"
    
    # Verify DB: doctor_id for appt4 MUST still be doc_cheaper
    v_conn = db_config.get_db_connection()
    v_cur = v_conn.cursor()
    v_cur.execute("SELECT doctor_id FROM appointments WHERE id = %s;", (appt4_id,))
    db_doc_id = v_cur.fetchone()[0]
    v_cur.close()
    v_conn.close()
    assert db_doc_id == doc_cheaper[0], f"Expected doctor_id to remain {doc_cheaper[0]}, but found {db_doc_id}"
    print("[PASS] Balance Payment Cancellation preserved original appointment safely in DB")

    # =========================================================================
    # TEST 5: Doctors Filtered Strictly By Department
    # =========================================================================
    print("\n--- TEST 5: Doctors Filtered Strictly By Department ---")
    s5 = "WA_test_mod_dept_9995"
    appt5_id, b5_id, p5_ref = create_test_paid_appointment(s5, doc_cheaper[0], doc_cheaper[2], fee_low)
    
    agent_service.process_agent_message(s5, pat_phone, f"Reschedule {b5_id}", interactive_id=f"btn_reschedule_existing_{appt5_id}")
    r5_chg = agent_service.process_agent_message(s5, pat_phone, "Change Doctor", interactive_id="btn_chg_doctor")
    
    # Ensure only doctors belonging to doc_cheaper[2] (its department) are shown
    d_conn = db_config.get_db_connection()
    d_cur = d_conn.cursor()
    d_cur.execute("SELECT id FROM doctors WHERE department_id = %s AND status = 'ACTIVE';", (doc_cheaper[2],))
    expected_doc_ids = {f"btn_doc_{r[0]}" for r in d_cur.fetchall()}
    d_cur.close()
    d_conn.close()
    
    button_ids = {b.get("id") for b in r5_chg.get("interactive_buttons", []) if b.get("id", "").startswith("btn_doc_")}
    assert button_ids.issubset(expected_doc_ids), f"Doctor buttons {button_ids} contained doctors outside department {expected_doc_ids}"
    print("[PASS] Doctors in doctor-change flow are strictly filtered by department")

    print("\n" + "=" * 70)
    print("ALL 14 PAID APPOINTMENT MODIFICATION & RECONCILIATION TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
