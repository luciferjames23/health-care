import sys
import os
import datetime
import random

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent import agent_service, state_manager
import db_config

def run_tests():
    print("=" * 80)
    print("VERIFYING BALANCE PAYMENT CALCULATION & PAYMENT METHOD TEXT FIX")
    print("=" * 80)

    conn = db_config.get_db_connection()
    cur = conn.cursor()

    # Find active patient
    cur.execute("SELECT id, first_name, whatsapp_number, patient_code FROM patients WHERE status = 'ACTIVE' AND whatsapp_number IS NOT NULL LIMIT 1;")
    pat_row = cur.fetchone()
    if not pat_row:
        print("ERROR: No active patient found in database.")
        sys.exit(1)

    pat_id, pat_name, pat_phone, pat_code = pat_row[0], pat_row[1], pat_row[2], pat_row[3]
    print(f"Patient: {pat_name} (ID: {pat_id}, Code: {pat_code}, Phone: {pat_phone})")

    # Find or set up Doctor A (Fee 246) and Doctor B (Fee 499)
    cur.execute("SELECT id, display_name, department_id, consultation_fee FROM doctors WHERE status = 'ACTIVE' ORDER BY consultation_fee ASC;")
    doc_rows = cur.fetchall()
    
    if len(doc_rows) < 2:
        print("ERROR: At least 2 active doctors required.")
        sys.exit(1)

    doc_a = list(doc_rows[0])
    doc_b = list(doc_rows[1])

    # Set exact fees to match user problem: Doctor A = 246, Doctor B = 499
    doc_a_id, doc_a_fee = doc_a[0], 246.0
    doc_b_id, doc_b_fee = doc_b[0], 499.0

    cur.execute("UPDATE doctors SET consultation_fee = %s WHERE id = %s;", (doc_a_fee, doc_a_id))
    cur.execute("UPDATE doctors SET consultation_fee = %s WHERE id = %s;", (doc_b_fee, doc_b_id))
    conn.commit()

    print(f"Doctor A: ID {doc_a_id} ({doc_a[1]}), Fee: Rs. {int(doc_a_fee)}")
    print(f"Doctor B: ID {doc_b_id} ({doc_b[1]}), Fee: Rs. {int(doc_b_fee)}")

    # 1. Create paid appointment for Doctor A (Fee = 246)
    booking_id = f"TESTBK{random.randint(10000, 99999)}"
    cur.execute("""
        INSERT INTO appointments (booking_id, patient_id, doctor_id, department_id, appointment_date, appointment_time, status, booking_source, patient_reason, appointment_type)
        VALUES (%s, %s, %s, %s, CURRENT_DATE + INTERVAL '5 days', '15:30', 'CONFIRMED', 'WHATSAPP_TEXT', 'General Checkup', 'IN_PERSON')
        RETURNING id;
    """, (booking_id, pat_id, doc_a_id, doc_a[2]))
    appt_db_id = cur.fetchone()[0]

    pay_ref_orig = f"PAYORIG{random.randint(10000, 99999)}"
    cur.execute("""
        INSERT INTO payments (payment_reference, patient_id, appointment_id, bill_id, amount, currency, payment_method, payment_status, transaction_reference, payment_date, payer_type)
        VALUES (%s, %s, %s, COALESCE((SELECT bill_id FROM bills WHERE patient_id = %s ORDER BY bill_id DESC LIMIT 1), 1), %s, 'INR', 'GPAY', 'SUCCESS', 'TXN_ORIG_246', CURRENT_TIMESTAMP, 'PATIENT');
    """, (pay_ref_orig, pat_id, appt_db_id, pat_id, doc_a_fee))
    conn.commit()
    cur.close()
    conn.close()

    print(f"\nCreated Initial Appointment {booking_id} (DB ID: {appt_db_id}) with Paid Amount: Rs. {int(doc_a_fee)}")

    session_code = f"WA_test_balance_{random.randint(1000, 9999)}"

    # Step 1: Start Reschedule / Modification
    print("\n--- Step 1: Request Reschedule ---")
    r1 = agent_service.process_agent_message(session_code, pat_phone, f"Reschedule {booking_id}", interactive_id=f"btn_reschedule_existing_{appt_db_id}")
    print(f"Response 1:\n{r1['response']}\n")

    # Step 2: Change Doctor
    print("--- Step 2: Change Doctor ---")
    r2 = agent_service.process_agent_message(session_code, pat_phone, "Change Doctor", interactive_id="btn_chg_doctor")
    print(f"Response 2:\n{r2['response']}\n")

    # Step 3: Select Doctor B (Fee 499)
    print("--- Step 3: Select Doctor B (Fee ₹499) ---")
    r3 = agent_service.process_agent_message(session_code, pat_phone, f"btn_doc_{doc_b_id}", interactive_id=f"btn_doc_{doc_b_id}")
    print(f"Response 3:\n{r3['response']}\n")

    # Pick slot
    slot_btns = [b["id"] for b in r3.get("interactive_buttons", []) if b.get("id", "").startswith("btn_slot_")]
    target_slot_id = slot_btns[0] if slot_btns else "btn_slot_15:30"
    r3_slot = agent_service.process_agent_message(session_code, pat_phone, "03:30 PM", interactive_id=target_slot_id)
    print(f"Response Slot:\n{r3_slot['response']}\n")

    # Step 4: Confirm Modification -> Shows Balance Prompt
    print("--- Step 4: Confirm Modification ---")
    r4 = agent_service.process_agent_message(session_code, pat_phone, "Confirm Modification", interactive_id="btn_confirm_modification")
    print(f"Response 4:\n{r4['response']}\n")
    assert "Balance Due: ₹253" in r4["response"] or "253" in r4["response"], f"Balance Due ₹253 not found in prompt: {r4['response']}"

    # Step 5: Select Payment Method: PhonePe
    print("--- Step 5: Select PhonePe Payment Method ---")
    r5 = agent_service.process_agent_message(session_code, pat_phone, "PhonePe", interactive_id="btn_pay_phonepe")
    print(f"Response 5 (Mock Payment Screen):\n{r5['response']}\n")
    assert "Amount: ₹253" in r5["response"], f"CRITICAL BUG: Mock Payment screen displayed WRONG amount! Response was: {r5['response']}"
    assert "Payment Method: PhonePe" in r5["response"], f"Payment Method display missing: {r5['response']}"
    
    pay_btn_title = [b["title"] for b in r5.get("interactive_buttons", []) if b.get("id") == "btn_pay_exec"][0]
    assert pay_btn_title == "Pay ₹253", f"Expected button 'Pay ₹253', got '{pay_btn_title}'"

    # Step 6: Test Change Payment Method to GPay
    print("--- Step 6: Change Payment Method -> GPay ---")
    r6_change = agent_service.process_agent_message(session_code, pat_phone, "Change Payment Method", interactive_id="btn_pay_change")
    print(f"Response 6 Change:\n{r6_change['response']}\n")
    assert "₹253" in r6_change["response"], f"Change payment method reset amount! Response: {r6_change['response']}"

    r6_gpay = agent_service.process_agent_message(session_code, pat_phone, "GPay", interactive_id="btn_pay_gpay")
    print(f"Response 6 GPay:\n{r6_gpay['response']}\n")
    assert "Amount: ₹253" in r6_gpay["response"], f"GPay screen displayed wrong amount! Response: {r6_gpay['response']}"

    # Step 7: Change Payment Method back to PhonePe and execute payment
    print("--- Step 7: Change Payment Method -> PhonePe & Pay ₹253 ---")
    agent_service.process_agent_message(session_code, pat_phone, "Change Payment Method", interactive_id="btn_pay_change")
    agent_service.process_agent_message(session_code, pat_phone, "PhonePe", interactive_id="btn_pay_phonepe")

    r7_pay = agent_service.process_agent_message(session_code, pat_phone, "Pay ₹253", interactive_id="btn_pay_exec")
    print(f"Response 7 Pay:\n{r7_pay['response']}\n")
    assert "Balance Payment Successful" in r7_pay["response"] or "updated successfully" in r7_pay["response"], f"Payment failed: {r7_pay['response']}"

    # Step 8: DATABASE VERIFICATION
    print("--- Step 8: Database Verification ---")
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT p.amount, p.payment_status, p.payment_method
        FROM payments p
        JOIN appointments a ON p.appointment_id = a.id
        WHERE a.booking_id = %s
        ORDER BY p.id ASC;
    """, (booking_id,))
    pay_records = cur.fetchall()

    print("Payments recorded in Database:")
    total_paid = 0.0
    for idx, prec in enumerate(pay_records, 1):
        print(f"  Record {idx}: Amount = Rs. {prec[0]}, Status = {prec[1]}, Method = {prec[2]}")
        if prec[1] == 'SUCCESS':
            total_paid += float(prec[0])

    assert len(pay_records) >= 2, f"Expected 2 payment records, found {len(pay_records)}"
    assert float(pay_records[0][0]) == 246.0, f"Original payment amount should be 246, found {pay_records[0][0]}"
    assert float(pay_records[1][0]) == 253.0, f"Balance payment amount should be 253, found {pay_records[1][0]}"
    assert total_paid == 499.0, f"Total paid in DB should be 499.0, found {total_paid}"

    cur.close()
    conn.close()

    print(f"\n[SUCCESS] Total Paid in DB: Rs. {total_paid} (Original Rs. 246 + Balance Rs. 253 = New Doctor Fee Rs. 499)")
    print("[SUCCESS] Remaining Balance: Rs. 0.0")

    # Step 9: Duplicate Payment Prevention Test
    print("\n--- Step 9: Duplicate Payment Prevention Test ---")
    new_fee, orig_paid, balance_due = agent_service.calculate_appointment_balance(booking_id=booking_id, doctor_id=doc_b_id)
    print(f"Recalculated Balance Due for {booking_id}: Rs. {balance_due}")
    assert balance_due == 0.0, f"Expected remaining balance due to be 0.0, got {balance_due}"

    print("\n" + "=" * 80)
    print("ALL REGRESSION & DATABASE VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)

if __name__ == "__main__":
    run_tests()
