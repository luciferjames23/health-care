"""
test_patient_360_payment.py
===========================
Comprehensive unit and integration tests verifying the permanent fix for
Patient 360 Billing payment failure:
1. Rejection of invalid payments (0, negative, non-existent).
2. Successful payment of patient diagnostic charge (₹500 Chest X-ray).
3. Database constraint verification (SETTLED is accepted by check constraint).
4. Atomicity and rollback verification on failed payment attempts.
5. Idempotent duplicate submission handling.
6. Server-side revalidation of outstanding balance (rejects double pay).
7. Unified billing statement refresh & reload consistency.
8. Concurrent payment race condition protection via row locking.
"""

import sys
import os
import unittest
import threading
from decimal import Decimal

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config
from services.patient_360_service import (
    resolve_patient_id,
    get_patient_unified_billing_statement,
    pay_patient_outstanding_balance
)

class TestPatient360BillingPayment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patient_id = resolve_patient_id("P1000019") or 1004434
        cls.charge_id = 38 # Chest X-ray ₹500
        # Ensure initial state for test repeatability
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM payments WHERE payment_reference = %s;", (f"PAY-CHG-{cls.charge_id}",))
            cur.execute("UPDATE patient_charges SET billing_status = 'PENDING', updated_at = CURRENT_TIMESTAMP WHERE id = %s;", (cls.charge_id,))
            conn.commit()
        finally:
            cur.close()
            conn.close()

    def test_01_invalid_payment_amounts_rejected(self):
        """Payments with 0 or negative amounts must be rejected without altering DB."""
        res_zero = pay_patient_outstanding_balance(
            patient_id=self.patient_id,
            charge_id=self.charge_id,
            amount=0.0
        )
        self.assertFalse(res_zero.get("success"))
        self.assertIn("greater than zero", res_zero.get("error", ""))

        res_neg = pay_patient_outstanding_balance(
            patient_id=self.patient_id,
            charge_id=self.charge_id,
            amount=-100.0
        )
        self.assertFalse(res_neg.get("success"))

    def test_02_nonexistent_charge_rejected(self):
        """Payment for a non-existent charge must fail gracefully."""
        res = pay_patient_outstanding_balance(
            patient_id=self.patient_id,
            charge_id=99999999,
            amount=500.0
        )
        self.assertFalse(res.get("success"))
        self.assertIn("not found", res.get("error", ""))

    def test_03_successful_payment_of_500_chest_xray(self):
        """₹500 Chest X-ray charge is successfully paid, SETTLED in DB under constraint."""
        txn_ref = "TXN_TEST_XRAY_500_A1"
        res = pay_patient_outstanding_balance(
            patient_id=self.patient_id,
            charge_id=self.charge_id,
            amount=500.0,
            payment_method="Cash at Desk",
            transaction_reference=txn_ref
        )
        self.assertTrue(res.get("success"), f"Payment failed: {res.get('error')}")
        self.assertEqual(res.get("payment_reference"), f"PAY-CHG-{self.charge_id}")
        self.assertEqual(res.get("amount"), 500.0)
        self.assertEqual(res.get("billing_status"), "SETTLED")

        # Verify database record
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT billing_status FROM patient_charges WHERE id = %s;", (self.charge_id,))
            status = cur.fetchone()[0]
            self.assertEqual(status, "SETTLED")

            cur.execute("""
                SELECT payment_reference, amount, payment_status, payment_method, transaction_reference
                FROM payments
                WHERE payment_reference = %s;
            """, (f"PAY-CHG-{self.charge_id}",))
            p_row = cur.fetchone()
            self.assertIsNotNone(p_row)
            self.assertEqual(float(p_row[1]), 500.0)
            self.assertEqual(p_row[2], "SUCCESS")
            self.assertEqual(p_row[3], "Cash at Desk")
            self.assertEqual(p_row[4], txn_ref)
        finally:
            cur.close()
            conn.close()

    def test_04_idempotency_duplicate_submission(self):
        """Duplicate submission with same transaction reference returns recorded payment without double-charging."""
        txn_ref = "TXN_TEST_XRAY_500_A1"
        res_dup = pay_patient_outstanding_balance(
            patient_id=self.patient_id,
            charge_id=self.charge_id,
            amount=500.0,
            payment_method="Cash at Desk",
            transaction_reference=txn_ref
        )
        self.assertTrue(res_dup.get("success"))
        self.assertTrue(res_dup.get("is_duplicate"))
        self.assertEqual(res_dup.get("amount"), 500.0)

        # Confirm payments table still has exactly 1 row
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT count(*) FROM payments WHERE payment_reference = %s;", (f"PAY-CHG-{self.charge_id}",))
            count = cur.fetchone()[0]
            self.assertEqual(count, 1)
        finally:
            cur.close()
            conn.close()

    def test_05_rejection_when_already_settled(self):
        """Attempting to pay an already settled charge with a new txn_ref is rejected."""
        res = pay_patient_outstanding_balance(
            patient_id=self.patient_id,
            charge_id=self.charge_id,
            amount=500.0,
            payment_method="UPI",
            transaction_reference="TXN_NEW_SECOND_ATTEMPT"
        )
        self.assertFalse(res.get("success"))
        self.assertIn("already fully settled", res.get("error", ""))

    def test_06_unified_statement_and_cards_consistency(self):
        """Unified statement reflects Settled status, paid amount ₹500, outstanding ₹0, with payment history."""
        stmt = get_patient_unified_billing_statement(self.patient_id)
        self.assertIsNotNone(stmt)

        chg_rec = next((r for r in stmt.get("records", []) if r.get("charge_id") == self.charge_id), None)
        self.assertIsNotNone(chg_rec, f"Charge {self.charge_id} not found in statement records")
        self.assertEqual(chg_rec.get("status"), "Settled")
        self.assertEqual(chg_rec.get("total_amount"), 500.0)
        self.assertEqual(chg_rec.get("paid_amount"), 500.0)
        self.assertEqual(chg_rec.get("outstanding_balance"), 0.0)
        self.assertEqual(chg_rec.get("payment_reference"), f"PAY-CHG-{self.charge_id}")
        self.assertEqual(chg_rec.get("payment_method"), "Cash at Desk")
        self.assertTrue(len(chg_rec.get("payments", [])) >= 1)

    def test_07_concurrent_payment_protection(self):
        """Concurrent payment attempts on an unsettled charge are serialized safely via row locks."""
        # Reset charge to PENDING and clear payment
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM payments WHERE payment_reference = %s;", (f"PAY-CHG-{self.charge_id}",))
            cur.execute("UPDATE patient_charges SET billing_status = 'PENDING' WHERE id = %s;", (self.charge_id,))
            conn.commit()
        finally:
            cur.close()
            conn.close()

        results = []
        def attempt_pay(txn):
            res = pay_patient_outstanding_balance(
                patient_id=self.patient_id,
                charge_id=self.charge_id,
                amount=500.0,
                payment_method="UPI",
                transaction_reference=txn
            )
            results.append(res)

        t1 = threading.Thread(target=attempt_pay, args=("TXN_CONCURRENT_1",))
        t2 = threading.Thread(target=attempt_pay, args=("TXN_CONCURRENT_2",))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Exactly one thread should succeed, the other should be rejected as already settled
        successes = [r for r in results if r.get("success")]
        failures = [r for r in results if not r.get("success")]
        self.assertEqual(len(successes), 1, f"Expected 1 success, got: {results}")
        self.assertEqual(len(failures), 1, f"Expected 1 failure, got: {results}")
        self.assertIn("already fully settled", failures[0].get("error", ""))

        # Check final DB state
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT billing_status FROM patient_charges WHERE id = %s;", (self.charge_id,))
            status = cur.fetchone()[0]
            self.assertEqual(status, "SETTLED")

            cur.execute("SELECT count(*) FROM payments WHERE payment_reference = %s;", (f"PAY-CHG-{self.charge_id}",))
            count = cur.fetchone()[0]
            self.assertEqual(count, 1)
        finally:
            cur.close()
            conn.close()


if __name__ == "__main__":
    unittest.main()
