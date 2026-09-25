import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from services.payment_refund_service import process_mock_payment, process_mock_refund, PaymentError
from api.dashboard_routes import get_conn

def test_service():
    print("============================================================")
    print("TESTING PAYMENT AND REFUND SERVICE DATABASE PERSISTENCE")
    print("============================================================")

    # 1. New Appointment Payment
    pay1 = process_mock_payment(
        patient_id=9989,
        amount=500.0,
        payment_method="GPAY",
        payment_context="APPOINTMENT_PAYMENT",
        appointment_id=1000726
    )
    print("1. Appointment Payment Result:", pay1)
    assert pay1["success"] == True
    assert pay1["amount"] == 500.0
    assert pay1["payment_status"] == "SUCCESS"

    # Verify DB for pay1
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, payment_reference, transaction_reference, payment_status FROM payments WHERE id = %s;", (pay1["payment_id"],))
    db_p1 = cur.fetchone()
    print("  -> Verified in DB payments table:", db_p1)
    assert db_p1[3] == "SUCCESS"
    cur.close()
    conn.close()

    # 2. Appointment Balance Payment
    pay_bal = process_mock_payment(
        patient_id=9989,
        amount=253.0,
        payment_method="UPI",
        payment_context="APPOINTMENT_BALANCE_PAYMENT",
        appointment_id=1000726
    )
    print("\n2. Appointment Balance Payment Result:", pay_bal)
    assert pay_bal["success"] == True
    assert pay_bal["amount"] == 253.0
    assert pay_bal["payment_id"] != pay1["payment_id"]  # Separate transaction record!

    # Verify original payment pay1 remains ₹500
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT amount, payment_status FROM payments WHERE id = %s;", (pay1["payment_id"],))
    p1_check = cur.fetchone()
    print("  -> Original payment p1 amount check:", p1_check)
    assert p1_check[0] == 500.0
    cur.close()
    conn.close()

    # 3. Partial Refund on pay1 (₹200 refund out of ₹500)
    ref1 = process_mock_refund(
        patient_id=9989,
        refund_amount=200.0,
        refund_reason="Rescheduled to lower fee doctor",
        original_payment_id=pay1["payment_id"]
    )
    print("\n3. Partial Refund Result:", ref1)
    assert ref1["success"] == True
    assert ref1["refund_amount"] == 200.0
    assert ref1["payment_status"] == "PARTIALLY_REFUNDED"

    # Verify refunds table row created
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT refund_id, refund_reference, refund_amount, status FROM refunds WHERE refund_id = %s;", (ref1["refund_id"],))
    db_r1 = cur.fetchone()
    print("  -> Verified in DB refunds table:", db_r1)
    assert db_r1[3] == "SUCCESS"
    cur.close()
    conn.close()

    # 4. Remaining Refund (₹300) to make it full refund
    ref2 = process_mock_refund(
        patient_id=9989,
        refund_amount=300.0,
        refund_reason="Full cancellation remaining refund",
        original_payment_id=pay1["payment_id"]
    )
    print("\n4. Remaining Refund Result:", ref2)
    assert ref2["success"] == True
    assert ref2["payment_status"] == "REFUNDED"

    # 5. Duplicate / Over-refund Attempt (attempt another ₹100 refund on fully refunded pay1)
    print("\n5. Testing Duplicate/Over-Refund Prevention...")
    try:
        process_mock_refund(
            patient_id=9989,
            refund_amount=100.0,
            refund_reason="Duplicate refund test",
            original_payment_id=pay1["payment_id"]
        )
        print("❌ FAILED: Over-refund was NOT prevented!")
        assert False, "Expected PaymentError for duplicate/over-refund"
    except PaymentError as err:
        print(f"[PASS] Duplicate/Over-refund successfully prevented with error: '{err.message}' (code: {err.error_code})")

    print("\n============================================================")
    print("ALL SERVICE TESTS PASSED PERFECTLY!")
    print("============================================================")

if __name__ == "__main__":
    test_service()
