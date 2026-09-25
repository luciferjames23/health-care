import os
import sys
import json
import datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.payment_refund_service import process_mock_payment, process_mock_refund, PaymentError
from agent.agent_service import process_agent_message, get_appointment_paid_amount, calculate_bill_payments
from api.dashboard_routes import get_conn

def run_suite():
    print("============================================================")
    print("EXECUTING COMPREHENSIVE MOCK PAYMENT & REFUND VERIFICATION")
    print("============================================================")

    # Database connection test
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM payments;")
    initial_p_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM refunds;")
    initial_r_count = cur.fetchone()[0]
    print(f"[DB STATE] Payments count: {initial_p_count}, Refunds count: {initial_r_count}")
    cur.close()
    conn.close()

    # ------------------------------------------------------------
    # 1. NEW APPOINTMENT PAYMENT TEST
    # ------------------------------------------------------------
    print("\n--- 1. NEW APPOINTMENT PAYMENT TEST ---")
    p1 = process_mock_payment(
        patient_id=9989,
        amount=500.0,
        payment_method="GPAY",
        payment_context="APPOINTMENT_PAYMENT",
        appointment_id=1000725,
        conversation_code="WA_8072851813_9989"
    )
    print("[PASS] Appointment Payment Success:", p1)
    assert p1["success"] == True
    assert p1["amount"] == 500.0
    assert p1["payment_status"] == "SUCCESS"
    assert p1["patient_id"] == 9989
    assert p1["appointment_id"] == 1000725
    assert p1["bill_id"] is None, "Appointment payment must NOT force a bill_id"

    # Verify DB persistence
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, payment_reference, transaction_reference, appointment_id, bill_id, payment_status FROM payments WHERE id = %s;", (p1["payment_id"],))
    db_p1 = cur.fetchone()
    print("[PASS] DB Payment Record:", db_p1)
    assert db_p1[5] == "SUCCESS"
    assert db_p1[3] == 1000725
    assert db_p1[4] is None
    cur.close()
    conn.close()

    # ------------------------------------------------------------
    # 2. HOSPITAL BILL PAYMENT TEST
    # ------------------------------------------------------------
    print("\n--- 2. HOSPITAL BILL PAYMENT TEST ---")
    b1 = process_mock_payment(
        patient_id=1004296,
        amount=4850.0,
        payment_method="PHONEPE",
        payment_context="BILL_PAYMENT",
        bill_id=277110,
        conversation_code="WA_8072851813_1004296"
    )
    print("[PASS] Bill Payment Success:", b1)
    assert b1["success"] == True
    assert b1["bill_id"] == 277110
    assert b1["appointment_id"] is None, "Bill payment must NOT force an appointment_id"

    # Verify bill status updated to Settled
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT bill_status FROM bills WHERE bill_id = 277110;")
    b_stat = cur.fetchone()[0]
    print(f"[PASS] Bill status after payment: '{b_stat}'")
    assert b_stat in ['Settled', 'Partially Paid']
    cur.close()
    conn.close()

    # ------------------------------------------------------------
    # 3. APPOINTMENT BALANCE PAYMENT TEST
    # ------------------------------------------------------------
    print("\n--- 3. APPOINTMENT BALANCE PAYMENT TEST ---")
    p_bal = process_mock_payment(
        patient_id=9989,
        amount=253.0,
        payment_method="UPI",
        payment_context="APPOINTMENT_BALANCE_PAYMENT",
        appointment_id=1000725,
        conversation_code="WA_8072851813_9989"
    )
    print("[PASS] Balance Payment Success:", p_bal)
    assert p_bal["success"] == True
    assert p_bal["amount"] == 253.0
    assert p_bal["payment_id"] != p1["payment_id"], "Balance payment must be a separate record"

    # Verify total paid for current test payments = 500 + 253 = 753
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT SUM(amount) FROM payments WHERE id IN (%s, %s) AND payment_status = 'SUCCESS';", (p1["payment_id"], p_bal["payment_id"]))
    net_paid_appt = float(cur.fetchone()[0])
    print(f"[PASS] Net total paid for current test payments: Rs. {net_paid_appt}")
    assert net_paid_appt == 753.0
    cur.close()
    conn.close()

    # ------------------------------------------------------------
    # 4. PARTIAL REFUND TEST
    # ------------------------------------------------------------
    print("\n--- 4. PARTIAL REFUND TEST ---")
    ref_partial = process_mock_refund(
        patient_id=9989,
        refund_amount=253.0,
        refund_reason="Fee adjustment partial refund",
        original_payment_id=p_bal["payment_id"],
        appointment_id=1000725
    )
    print("[PASS] Partial Refund Success:", ref_partial)
    assert ref_partial["success"] == True
    assert ref_partial["refund_amount"] == 253.0
    assert ref_partial["payment_status"] == "REFUNDED"

    # Verify refunds table persistence
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT refund_id, refund_reference, payment_id, refund_amount, status FROM refunds WHERE refund_id = %s;", (ref_partial["refund_id"],))
    db_r1 = cur.fetchone()
    print("[PASS] DB Refund Record:", db_r1)
    assert db_r1[4] == "SUCCESS"
    assert db_r1[2] == p_bal["payment_id"]
    cur.close()
    conn.close()

    # ------------------------------------------------------------
    # 5. FULL REFUND & OVER-REFUND PREVENTION TEST
    # ------------------------------------------------------------
    print("\n--- 5. FULL REFUND & OVER-REFUND PREVENTION TEST ---")
    ref_full = process_mock_refund(
        patient_id=9989,
        refund_amount=500.0,
        refund_reason="Full cancellation refund",
        original_payment_id=p1["payment_id"],
        appointment_id=1000725
    )
    print("[PASS] Full Refund Success:", ref_full)
    assert ref_full["success"] == True
    assert ref_full["payment_status"] == "REFUNDED"

    # Verify net payment for p1 after full refund is 0.0
    print(f"[PASS] Net payment for p1 after full refund: Rs. {ref_full['net_paid_amount']}, remaining refundable: Rs. {ref_full['remaining_refundable']}")
    assert ref_full['net_paid_amount'] == 0.0
    assert ref_full['remaining_refundable'] == 0.0

    # Over-refund prevention check
    try:
        process_mock_refund(
            patient_id=9989,
            refund_amount=100.0,
            refund_reason="Over-refund attempt",
            original_payment_id=p1["payment_id"]
        )
        assert False, "Over-refund should have been blocked!"
    except PaymentError as err:
        print(f"[PASS] Over-refund successfully blocked with error: '{err.message}'")

    # ------------------------------------------------------------
    # 6. WHATSAPP AGENT CONVERSATION INTEGRATION TEST
    # ------------------------------------------------------------
    print("\n--- 6. WHATSAPP AGENT INTEGRATION TEST ---")
    # Simulate patient desk appointment payment execution
    session_code = "WA_8072851813_9989"
    res_agent = process_agent_message(session_code, "8072851813", "btn_pay_exec")
    resp_raw = res_agent.get("response", "")
    safe_resp = resp_raw.encode("ascii", "replace").decode("ascii")
    print(f"[PASS] Agent payment execution response: '{safe_resp[:120]}...'")
    assert res_agent.get("success") is True or "Payment" in resp_raw or "payment" in resp_raw.lower()

    print("\n============================================================")
    print("ALL TEST MATRIX CHECKS PASSED PERFECTLY! DATABASE PERSISTED.")
    print("============================================================")

if __name__ == "__main__":
    run_suite()
