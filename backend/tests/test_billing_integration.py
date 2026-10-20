"""
Regression test suite for Billing, Appointment Payments, Hospital Billing, and WhatsApp Billing.
Tests:
  1. Canonical payment and bill linkage for Jacky K (Appointment + Hospital Bill + Radiology).
  2. Prevention of duplicate payments and verified balance slicing.
  3. WhatsApp Billing integration (btn_cat_billing, btn_view_bill, btn_balance, btn_pay_bill, btn_pay_exec).
  4. Hospital bill payment never creating/confirming appointments.
  5. Cross-patient isolation and canonical patient context enforcement.
"""

import os
import sys
import json
import unittest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config
from services.patient_360_service import (
    get_patient_unified_billing_statement,
    pay_patient_outstanding_balance,
    ensure_appointment_bill_and_payment
)
from agent.agent_service import (
    build_billing_response,
    process_agent_message
)


class TestBillingIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.patient_id = 1004299 # Jacky K
        cls.phone = "8072851813"

    def test_01_jacky_k_canonical_billing_statement(self):
        """Test Jacky K's authoritative statement matches database lakehouse."""
        stmt = get_patient_unified_billing_statement(self.patient_id)
        self.assertIsNotNone(stmt)
        summary = stmt.get("summary", {})
        self.assertGreater(summary.get("total_billed", 0), 0)
        self.assertGreater(summary.get("total_paid", 0), 0)
        self.assertEqual(summary.get("total_billed"), 5849.0)
        self.assertEqual(summary.get("total_paid"), 3549.0)
        self.assertEqual(summary.get("outstanding_balance"), 2300.0)

        records = stmt.get("records", [])
        # Must have at least 3 records: Inpatient, Outpatient, Diagnostic
        bill_types = [r.get("bill_type") for r in records]
        self.assertIn("INPATIENT", bill_types)
        self.assertIn("OUTPATIENT", bill_types)
        self.assertIn("RADIOLOGY", bill_types)

        # Check Outpatient Appointment bill
        op_rec = next((r for r in records if r.get("bill_type") == "OUTPATIENT"), None)
        self.assertIsNotNone(op_rec)
        self.assertEqual(op_rec.get("bill_number"), "INV-OPD-100072")
        self.assertEqual(op_rec.get("total_amount"), 499.0)
        self.assertEqual(op_rec.get("paid_amount"), 499.0)
        self.assertEqual(op_rec.get("outstanding_balance"), 0.0)
        self.assertEqual(op_rec.get("status"), "Settled")
        self.assertEqual(op_rec.get("appointment_id"), 1000728)
        self.assertEqual(op_rec.get("payment_reference"), "PAY202609261116376658")

    def test_02_idempotent_appointment_billing_no_duplicates(self):
        """Test ensure_appointment_bill_and_payment is idempotent."""
        # Call again for Jacky K's appointment 1000728
        res = ensure_appointment_bill_and_payment(
            appointment_id=1000728,
            amount=499.0,
            transaction_reference="MOCKTXN672382",
            payment_method="PAYTM"
        )
        self.assertIsNotNone(res)
        self.assertEqual(res.get("bill_number"), "INV-OPD-100072")

        # Verify no duplicate payment was created in database
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT count(*) FROM payments WHERE appointment_id = 1000728;")
            count = cur.fetchone()[0]
            self.assertEqual(count, 1, "Appointment 1000728 must have exactly 1 payment record.")
        finally:
            cur.close()
            conn.close()

    def test_03_whatsapp_billing_response_generation(self):
        """Test WhatsApp billing response shows verified totals and balances."""
        conv_code = f"TEST_{self.phone}"
        state = {
            "selected_patient_id": self.patient_id,
            "patient_id": self.patient_id,
            "patient_name": "Jacky K",
            "phone": self.phone,
            "user_phone": self.phone
        }
        res = build_billing_response(conv_code, state, "ENGLISH")
        self.assertIsNotNone(res)
        text = res.get("response", "")
        self.assertIn("Jacky K", text)
        self.assertIn("5,849", text)
        self.assertIn("3,549", text)
        self.assertIn("2,300", text)
        # Should have interactive action buttons
        buttons = res.get("interactive_buttons", [])
        button_ids = [b.get("id") for b in buttons]
        self.assertIn("btn_view_bill", button_ids)
        self.assertIn("btn_pay_bill", button_ids)

    def test_04_whatsapp_button_callbacks(self):
        """Test btn_view_bill and btn_balance callback flows."""
        from agent.state_manager import save_conversation_state
        conv_code = f"TEST_{self.phone}"
        state = {
            "selected_patient_id": self.patient_id,
            "patient_id": self.patient_id,
            "patient_name": "Jacky K",
            "phone": self.phone,
            "user_phone": self.phone,
            "language": "ENGLISH"
        }
        save_conversation_state(conv_code, state)
        
        # Test btn_view_bill
        view_res = process_agent_message(conv_code, "P1000064", message_text="", interactive_id="btn_view_bill")
        self.assertIsNotNone(view_res)
        view_text = view_res.get("response", "")
        self.assertIn("INV-2026-8841", view_text)
        self.assertIn("INV-OPD-100072", view_text)
        self.assertIn("CHG-1", view_text)

        # Test btn_balance
        bal_res = process_agent_message(conv_code, "P1000064", message_text="", interactive_id="btn_balance")
        self.assertIsNotNone(bal_res)
        bal_text = bal_res.get("response", "")
        self.assertIn("Outstanding Balance", bal_text)
        self.assertIn("2,300", bal_text)

    def test_05_whatsapp_pay_bill_prompt_and_amount_verification(self):
        """Test btn_pay_bill prompts for verified amount."""
        from agent.state_manager import save_conversation_state, get_conversation_state
        conv_code = f"TEST_{self.phone}"
        state = {
            "selected_patient_id": self.patient_id,
            "patient_id": self.patient_id,
            "patient_name": "Jacky K",
            "phone": self.phone,
            "user_phone": self.phone,
            "language": "ENGLISH"
        }
        save_conversation_state(conv_code, state)
        pay_res = process_agent_message(conv_code, "P1000064", message_text="", interactive_id="btn_pay_bill")
        self.assertIsNotNone(pay_res)
        pay_text = pay_res.get("response", "")
        self.assertIn("2,300", pay_text)
        updated_state = get_conversation_state(conv_code)
        self.assertEqual(updated_state.get("pending_bill_amount"), 2300.0)

    def test_06_hospital_bill_payment_does_not_create_appointment(self):
        """Test hospital bill payment settles dues without creating appointments."""
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT count(*) FROM appointments WHERE patient_id = %s;", (self.patient_id,))
            initial_appt_count = cur.fetchone()[0]
        finally:
            cur.close()
            conn.close()

        # Execute mock payment for radiology charge of ₹500
        pay_res = pay_patient_outstanding_balance(
            patient_id=self.patient_id,
            charge_id=1,
            amount=500.0,
            payment_method="UPI",
            transaction_reference="TEST_TXN_RAD_500"
        )
        self.assertTrue(pay_res.get("success"))
        self.assertEqual(pay_res.get("paid_amount"), 500.0)

        # Verify charge is now SETTLED
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT billing_status FROM patient_charges WHERE id = 1;")
            status = cur.fetchone()[0]
            self.assertEqual(status, "SETTLED")

            # Verify appointment count remained exactly the same
            cur.execute("SELECT count(*) FROM appointments WHERE patient_id = %s;", (self.patient_id,))
            new_appt_count = cur.fetchone()[0]
            self.assertEqual(new_appt_count, initial_appt_count, "No appointment should be created when paying hospital bill.")

            # Roll back payment record and charge status to keep test reproducible
            cur.execute("DELETE FROM payments WHERE transaction_reference = 'TEST_TXN_RAD_500';")
            cur.execute("UPDATE patient_charges SET billing_status = 'PENDING' WHERE id = 1;")
            conn.commit()
        finally:
            cur.close()
            conn.close()

    def test_07_cross_patient_isolation(self):
        """Test patient data cannot be accessed across different patient contexts."""
        # Query for non-existent or other patient
        fake_pid = 9999999
        fake_stmt = get_patient_unified_billing_statement(fake_pid)
        self.assertEqual(fake_stmt.get("summary", {}).get("total_billed", 0), 0.0)
        self.assertEqual(len(fake_stmt.get("records", [])), 0)


if __name__ == "__main__":
    unittest.main()
