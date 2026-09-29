import sys
import os
import datetime
import random

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.append('.')

from db_config import get_db_connection
from agent import agent_service, state_manager

def run_test():
    print("=" * 80)
    print("TESTING MERIDIAN HOSPITAL PATIENT DESK BILL PAYMENT CONTEXT BUG FIX")
    print("=" * 80)

    conn = get_db_connection()
    cur = conn.cursor()

    # Find or use patient John Peter (P1000061)
    cur.execute("SELECT id, first_name, last_name, patient_code, phone FROM patients WHERE patient_code = 'P1000061' OR (first_name ILIKE '%John%' AND last_name ILIKE '%Peter%') LIMIT 1;")
    pat_row = cur.fetchone()
    assert pat_row is not None, "Patient John Peter not found in database!"
    pat_id = pat_row[0]
    f_name = pat_row[1]
    l_name = pat_row[2] or ""
    pat_code = pat_row[3] or f"P{pat_id}"
    pat_phone = pat_row[4] if len(pat_row) > 4 else "918072851813"
    print(f"Testing with Patient: {f_name} {l_name} (ID: {pat_id}, Code: {pat_code}, Phone: {pat_phone})")

    # Clean up previous test payments/bills for clean state
    cur.execute("DELETE FROM payments WHERE patient_id = %s AND (bill_id IN (SELECT bill_id FROM bills WHERE bill_number = 'INV-2026-8841') OR payment_reference LIKE 'PAYBILL%%');", (pat_id,))
    cur.execute("DELETE FROM bills WHERE bill_number = 'INV-2026-8841';")
    conn.commit()
    cur.close()
    conn.close()

    session_code = f"WA_{pat_phone}_TEST_BILL_FIX_{random.randint(1000, 9999)}"
    state = state_manager.get_conversation_state(session_code)
    state["selected_patient_id"] = pat_id
    state["patient_id"] = pat_id
    state_manager.save_conversation_state(session_code, state)

    # -------------------------------------------------------------------------
    # TEST 1: BILL PAYMENT FLOW (THE REPORTED BUG SCENARIO)
    # -------------------------------------------------------------------------
    print("\n--- TEST 1: View Bill & Select Google Pay ---")
    
    # Step 1: Click Billing & Payments -> View Bill
    r1 = agent_service.process_agent_message(session_code, pat_phone, "View Bill", interactive_id="btn_view_bill")
    print("View Bill Response:\n", r1["response"])
    assert "Itemized Hospital Bill" in r1["response"], "View bill title missing!"
    assert "INV-2026-8841" in r1["response"], "Bill reference missing!"
    assert "₹4,850" in r1["response"], "Total amount ₹4,850 missing!"
    assert "Outstanding Balance: ₹4,850" in r1["response"], "Outstanding balance ₹4,850 missing!"

    # Step 2: Select Google Pay
    r2 = agent_service.process_agent_message(session_code, pat_phone, "Google Pay", interactive_id="btn_pay_gpay")
    print("\nGoogle Pay Mock Payment Response:\n", r2["response"])
    
    # VERIFY BILL PAYMENT CONTEXT IN MOCK PAYMENT
    assert "💳 *Mock Payment*" in r2["response"], "Mock Payment header missing!"
    assert "Patient: John Peter" in r2["response"], f"Patient name missing in mock payment: {r2['response']}"
    assert "Patient ID: P1000061" in r2["response"], f"Patient ID missing in mock payment: {r2['response']}"
    assert "INV-2026-8841" in r2["response"], f"Bill reference missing in mock payment: {r2['response']}"
    assert "Hospital Bill" in r2["response"], f"Payment type Hospital Bill missing: {r2['response']}"
    assert "Outstanding Amount:\n₹4,850" in r2["response"] or "Outstanding Amount:" in r2["response"], f"Outstanding amount missing: {r2['response']}"
    assert "Amount:\n₹4,850" in r2["response"], f"Amount ₹4,850 missing: {r2['response']}"
    
    # VERIFY NO UNRELATED DOCTOR DATA IN BILL PAYMENT
    assert "Dr. Moorthy D" not in r2["response"], "CRITICAL BUG: Unrelated doctor Dr. Moorthy D appeared in bill payment!"
    assert "Doctor:" not in r2["response"], "CRITICAL BUG: Doctor field appeared in bill payment!"
    
    print("✅ TEST 1 PASSED: Mock Payment screen shows BILL PAYMENT context with ₹4,850 and no appointment contamination!")

    # Step 3: Execute Payment (Pay ₹4,850)
    print("\n--- TEST 1b: Execute Bill Payment (Pay ₹4,850) ---")
    r3 = agent_service.process_agent_message(session_code, pat_phone, "Pay ₹4,850", interactive_id="btn_pay_exec")
    print("Payment Execution Response:\n", r3["response"])
    assert "Bill Payment Successful!" in r3["response"], "Bill Payment Successful header missing!"
    assert "INV-2026-8841" in r3["response"], "Bill reference missing in success message!"
    assert "Amount Paid: ₹4,850" in r3["response"], "Amount Paid ₹4,850 missing!"
    assert "Remaining Balance: ₹0" in r3["response"], "Remaining balance ₹0 missing!"
    print("✅ TEST 1b PASSED: Bill payment executed successfully!")

    # Verify Database Status
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT bill_status FROM bills WHERE bill_number = 'INV-2026-8841';")
    b_stat = cur.fetchone()[0]
    assert b_stat == 'Settled', f"Expected bill_status Settled, got {b_stat}"
    
    cur.execute("SELECT payment_status, amount, bill_id, appointment_id FROM payments WHERE patient_id = %s ORDER BY id DESC LIMIT 1;", (pat_id,))
    p_stat, p_amt, p_bill_id, p_appt_id = cur.fetchone()
    assert p_stat == 'SUCCESS', f"Expected payment_status SUCCESS, got {p_stat}"
    assert float(p_amt) == 4850.0, f"Expected payment amount 4850.0, got {p_amt}"
    assert p_bill_id is not None, "Bill ID missing in payments record!"
    assert p_appt_id is None, f"Appointment ID should be NULL for bill payment, got {p_appt_id}"
    conn.close()
    print("✅ DATABASE VERIFICATION PASSED: Bill status 'Settled', payment status 'SUCCESS', appointment_id NULL!")

    # -------------------------------------------------------------------------
    # TEST 2: FULLY PAID BILL PREVENTS DUPLICATE PAYMENT
    # -------------------------------------------------------------------------
    print("\n--- TEST 2: View Bill for Fully Paid Bill ---")
    r4 = agent_service.process_agent_message(session_code, pat_phone, "View Bill", interactive_id="btn_view_bill")
    print("Fully Paid Bill Response:\n", r4["response"])
    assert "This bill has already been paid in full" in r4["response"], "Paid in full notification missing!"
    assert "Outstanding Balance: ₹0" in r4["response"], "Outstanding Balance ₹0 missing!"
    print("✅ TEST 2 PASSED: Fully paid bill prevents duplicate payment!")

    # -------------------------------------------------------------------------
    # TEST 3: APPOINTMENT PAYMENT ISOLATION
    # -------------------------------------------------------------------------
    print("\n--- TEST 3: Appointment Booking Payment Flow Isolation ---")
    session_appt = f"WA_{pat_phone}_TEST_APPT_{random.randint(1000, 9999)}"
    st_appt = state_manager.get_conversation_state(session_appt)
    st_appt["selected_patient_id"] = pat_id
    st_appt["patient_id"] = pat_id
    state_manager.save_conversation_state(session_appt, st_appt)
    
    # Start booking appointment
    agent_service.process_agent_message(session_appt, pat_phone, "Book Appointment", interactive_id="btn_book_appt")
    agent_service.process_agent_message(session_appt, pat_phone, "Fever & Cold")
    
    # Get available doctor
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, display_name FROM doctors WHERE status = 'ACTIVE' LIMIT 1;")
    doc_id, doc_name = cur.fetchone()
    conn.close()

    agent_service.process_agent_message(session_appt, pat_phone, f"Select {doc_name}", interactive_id=f"btn_doc_{doc_id}")

    # Pick slot
    r_slots = agent_service.process_agent_message(session_appt, pat_phone, "Tomorrow", interactive_id="btn_date_tomorrow")
    slot_btns = [b for b in r_slots.get("interactive_buttons", []) if b.get("id", "").startswith("btn_slot_")]
    if not slot_btns:
        r_slots = agent_service.process_agent_message(session_appt, pat_phone, "Today", interactive_id="btn_date_today")
        slot_btns = [b for b in r_slots.get("interactive_buttons", []) if b.get("id", "").startswith("btn_slot_")]
    if slot_btns:
        slot_id = slot_btns[0]["id"]
        agent_service.process_agent_message(session_appt, pat_phone, slot_btns[0]["title"], interactive_id=slot_id)
    
    r_confirm = agent_service.process_agent_message(session_appt, pat_phone, "Confirm Appointment", interactive_id="btn_confirm_appt")
    print("Appointment Payment Prompt:\n", r_confirm["response"])
    
    # Select payment method for appointment
    r_appt_pay = agent_service.process_agent_message(session_appt, pat_phone, "Google Pay", interactive_id="btn_pay_gpay")
    print("\nAppointment Mock Payment Response:\n", r_appt_pay["response"])
    assert "Doctor:" in r_appt_pay["response"], "Doctor name missing in appointment mock payment!"
    assert "Amount: ₹800" in r_appt_pay["response"] or "Amount:" in r_appt_pay["response"], "Appointment fee missing!"
    assert "INV-2026-8841" not in r_appt_pay["response"], "CRITICAL BUG: Bill reference INV-2026-8841 leaked into appointment payment!"
    assert "Hospital Bill" not in r_appt_pay["response"], "CRITICAL BUG: Hospital Bill payment type leaked into appointment payment!"
    print("✅ TEST 3 PASSED: Appointment Payment flow operates in complete isolation!")

    # -------------------------------------------------------------------------
    # TEST 4: CROSS-WORKFLOW CONTEXT SWITCHING ISOLATION
    # -------------------------------------------------------------------------
    print("\n--- TEST 4: Cross-Workflow Switching (Abandoned Appt -> View Bill) ---")
    session_cross = f"WA_{pat_phone}_TEST_CROSS_{random.randint(1000, 9999)}"
    st_cross = state_manager.get_conversation_state(session_cross)
    st_cross["selected_patient_id"] = pat_id
    st_cross["patient_id"] = pat_id
    state_manager.save_conversation_state(session_cross, st_cross)
    
    # 1. Start appointment
    agent_service.process_agent_message(session_cross, pat_phone, "Book Appointment", interactive_id="btn_book_appt")
    agent_service.process_agent_message(session_cross, pat_phone, "Headache")
    agent_service.process_agent_message(session_cross, pat_phone, f"Select {doc_name}", interactive_id=f"btn_doc_{doc_id}")
    
    # 2. Switch to View Bill without completing appointment (reset bill to unpaid first for test 4)
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM payments WHERE patient_id = %s AND bill_id IN (SELECT bill_id FROM bills WHERE bill_number = 'INV-2026-8841');", (pat_id,))
    cur.execute("UPDATE bills SET bill_status = 'Unpaid' WHERE bill_number = 'INV-2026-8841';")
    conn.commit()
    conn.close()

    r_cross_bill = agent_service.process_agent_message(session_cross, pat_phone, "View Bill", interactive_id="btn_view_bill")
    print("Cross-Workflow View Bill Response:\n", r_cross_bill["response"])
    assert "Itemized Hospital Bill" in r_cross_bill["response"], "Itemized Hospital Bill missing!"
    
    # 3. Select PhonePe for Bill
    r_cross_pay = agent_service.process_agent_message(session_cross, pat_phone, "PhonePe", interactive_id="btn_pay_phonepe")
    print("Cross-Workflow Bill Payment Response:\n", r_cross_pay["response"])
    assert "Hospital Bill" in r_cross_pay["response"], "Hospital Bill payment type missing in cross-workflow test!"
    assert "INV-2026-8841" in r_cross_pay["response"], "Bill reference missing in cross-workflow test!"
    assert "Doctor:" not in r_cross_pay["response"], "CRITICAL BUG: Doctor leaked from abandoned appointment into bill payment!"
    print("✅ TEST 4 PASSED: Cross-workflow context switching correctly isolates payment contexts!")

    print("\n" + "=" * 80)
    print("ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 100% RECONCILED & ISOLATED!")
    print("=" * 80)

if __name__ == "__main__":
    run_test()
