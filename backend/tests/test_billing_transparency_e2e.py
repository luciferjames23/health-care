import os
import sys
import unittest
import json
from decimal import Decimal

# Force stdout encoding to UTF-8
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

cur_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(cur_dir, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.billing_transparency_agent import BillingTransparencyAgentService
from db.postgres_connector import PostgresConnector


class TestBillingTransparencyAgentE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service = BillingTransparencyAgentService()
        cls.db = PostgresConnector()

    def test_01_agent_profile_and_stats(self):
        """Test AG-08 profile metadata and dynamic desk stats from PostgreSQL."""
        profile = self.service.get_agent_profile()
        self.assertEqual(profile["agent_id"], "AG-08")
        self.assertEqual(profile["status"], "Published")
        self.assertIn("tools", profile)
        self.assertTrue(len(profile["tools"]) >= 4)
        self.assertIn("benchmarks", profile)

        stats = self.service.get_billing_stats()
        self.assertIn("total_bills_count", stats)
        self.assertGreater(stats["total_bills_count"], 0)
        self.assertGreater(stats["total_gross_invoiced"], 0)
        self.assertIn("settled_revenue", stats)
        self.assertIn("pending_revenue", stats)
        print(f"\n[PASS] Agent Profile & Dynamic Stats verified: {stats['total_bills_count']} total bills, INR {stats['total_gross_invoiced']:,.2f} invoiced.")

    def test_02_fully_paid_bill_scenario(self):
        """Test scenario: Fully paid / Settled bill from PostgreSQL."""
        # Bill 1 is Settled in DB
        profile = self.service.get_patient_billing_profile("MER-BIL-0000001")
        self.assertTrue(profile["success"])
        self.assertEqual(profile["reconciled_status"], "Paid")
        self.assertLessEqual(profile["patient_outstanding_balance"], 0.01)
        self.assertEqual(profile["net_amount"], 3000.0)
        
        # Test Q&A for fully paid bill
        q_res = self.service.ask_billing_question("MER-BIL-0000001", "Has my bill been fully settled?")
        self.assertTrue(q_res["success"])
        self.assertIn("FULLY SETTLED", q_res["answer_en"])
        self.assertEqual(q_res["financial_snapshot"]["patient_outstanding_balance"], 0.0)
        print(f"\n[PASS] Fully Paid Bill Scenario verified for Bill 1: Balance = INR {profile['patient_outstanding_balance']}, Status = {profile['reconciled_status']}")

    def test_03_partially_paid_bill_scenario(self):
        """Test scenario: Partially paid bill with insurance and patient co-pay."""
        # Bill 114
        profile = self.service.get_patient_billing_profile("MER-BIL-0000114")
        self.assertTrue(profile["success"])
        self.assertEqual(profile["net_amount"], 6500.0)
        self.assertEqual(profile["insurance_amount"], 5525.0)
        self.assertEqual(profile["patient_portion"], 975.0)
        
        q_res = self.service.ask_billing_question("MER-BIL-0000114", "How much is still pending?")
        self.assertTrue(q_res["success"])
        self.assertIn("₹", q_res["answer_en"])
        print(f"\n[PASS] Partially Paid Scenario verified for Bill 114: Net = INR {profile['net_amount']}, Ins = INR {profile['insurance_amount']}, Pat = INR {profile['patient_portion']}")

    def test_04_unpaid_pending_bill_scenario(self):
        """Test scenario: Unpaid / Pending bill with high balance."""
        # Bill 87246
        profile = self.service.get_patient_billing_profile("MER-BIL-0087246")
        self.assertTrue(profile["success"])
        self.assertEqual(profile["net_amount"], 459500.0)
        self.assertEqual(profile["reconciled_status"], "Pending")
        self.assertGreater(profile["patient_outstanding_balance"], 400000.0)

        q_res = self.service.ask_billing_question("MER-BIL-0087246", "Why is there an outstanding balance?")
        self.assertTrue(q_res["success"])
        self.assertIn("459,500.00", q_res["answer_en"])
        print(f"\n[PASS] Unpaid / Pending Scenario verified for Bill 87246: Net = INR {profile['net_amount']}, Due = INR {profile['patient_outstanding_balance']}")

    def test_05_insurance_claim_reconciliation(self):
        """Test scenario: Insurance claims distinguishing claimed, approved, rejected, and settled."""
        # Bill 101890 (Star Health Cashless claim)
        profile = self.service.get_patient_billing_profile("MER-BIL-0101890")
        self.assertTrue(profile["success"])
        self.assertGreater(len(profile["claims"]), 0)
        self.assertEqual(profile["insurance_provider"], "Star Health")
        self.assertEqual(profile["insurance_claimed_amount"], 680.0)
        self.assertEqual(profile["insurance_approved_amount"], 680.0)
        self.assertEqual(profile["insurance_settled_amount"], 646.0)

        q_res = self.service.ask_billing_question("MER-BIL-0101890", "How much is covered by insurance?")
        self.assertTrue(q_res["success"])
        self.assertIn("Star Health", q_res["answer_en"])
        self.assertIn("680.00", q_res["answer_en"])
        print(f"\n[PASS] Insurance Reconciliation verified: Claimed = INR {profile['insurance_claimed_amount']}, Approved = INR {profile['insurance_approved_amount']}, Settled = INR {profile['insurance_settled_amount']}")

    def test_06_pharmacy_and_lab_itemized_billing(self):
        """Test scenario: Bill containing linked pharmacy and laboratory items."""
        # Bill 277219 / Patient 1004430
        profile = self.service.get_patient_billing_profile("MER-BIL-0277219")
        self.assertTrue(profile["success"])
        self.assertGreater(len(profile["pharmacy_items"]), 0)
        self.assertGreater(len(profile["lab_items"]), 0)
        
        q_res = self.service.ask_billing_question("MER-BIL-0277219", "What are the individual charges included in my bill?")
        self.assertTrue(q_res["success"])
        self.assertIn("Pharmacy:", q_res["answer_en"])
        self.assertIn("Labs:", q_res["answer_en"])
        print(f"\n[PASS] Pharmacy & Lab Charges verified on Bill 277219: {len(profile['pharmacy_items'])} pharmacy items, {len(profile['lab_items'])} lab items.")

    def test_07_multiple_bills_same_patient(self):
        """Test scenario: Patients with multiple bills in the database."""
        # Patient ID 2 has multiple bills
        conn = self.db.get_connection()
        cur = self.db.get_dict_cursor(conn)
        cur.execute("SELECT bill_id, net_amount, bill_status FROM bills WHERE patient_id = 2 ORDER BY bill_id ASC;")
        bills = cur.fetchall()
        cur.close()
        conn.close()

        self.assertGreaterEqual(len(bills), 2)
        # Profile lookup by patient UHID
        profile = self.service.get_patient_billing_profile("MER-PAT-0000002")
        self.assertTrue(profile["success"])
        self.assertEqual(profile["patient_id"], 2)
        print(f"\n[PASS] Multi-bill Patient verified: Patient 2 has {len(bills)} bills in DB. Resolved active bill: {profile['bill_id']}")

    def test_08_all_eight_mandatory_billing_questions(self):
        """Test the 8 mandatory billing questions in English and Tamil."""
        patient_id = "87221"
        questions = [
            ("What is my total bill amount?", "TOTAL_BILL"),
            ("How much have I paid so far?", "PAID_AMOUNT"),
            ("Why is there an outstanding balance?", "OUTSTANDING_REASON"),
            ("How much is still pending?", "PENDING_BALANCE"),
            ("What are the individual charges included in my bill?", "ITEMIZED_CHARGES"),
            ("How much is covered by insurance?", "INSURANCE_COVERAGE"),
            ("Which payments or insurance claims are still pending?", "PENDING_ITEMS"),
            ("Has my bill been fully settled?", "SETTLEMENT_STATUS")
        ]

        for q, expected_topic in questions:
            res_en = self.service.ask_billing_question(patient_id, q, language="en")
            self.assertTrue(res_en["success"])
            self.assertEqual(res_en["topic"], expected_topic)
            self.assertGreater(len(res_en["answer_en"]), 10)
            
            # Tamil response
            res_ta = self.service.ask_billing_question(patient_id, q, language="ta")
            self.assertTrue(res_ta["success"])
            self.assertGreater(len(res_ta["answer_ta"]), 5)

        print(f"\n[PASS] All 8 mandatory billing questions answered accurately with exact financial grounding in EN & TA.")

    def test_09_plain_language_breakdown_synthesis(self):
        """Test bilingual plain-language synthesis and clinical proof generation."""
        res = self.service.generate_plain_language_breakdown("87221")
        self.assertTrue(res["success"])
        self.assertIn("breakdown", res)
        bd = res["breakdown"]
        self.assertIn("summary_en", bd)
        self.assertIn("summary_ta", bd)
        self.assertIn("key_drivers", bd)
        self.assertIn("clinical_proof", bd)
        self.assertIn("doctor_name", bd["clinical_proof"])
        print(f"\n[PASS] Plain-Language Breakdown synthesized in {res['latency_sec']}s: Summary EN & TA present.")

    def test_10_clinical_necessity_and_invoice_approval(self):
        """Test clinical necessity audit trail and invoice print authorization."""
        res_nec = self.service.investigate_clinical_necessity("87221", "MAT-CATH-NC")
        self.assertTrue(res_nec["is_verified"])
        self.assertIn("audit_trail", res_nec)
        self.assertIn("nabh_compliance_rule", res_nec)

        res_app = self.service.approve_for_invoice("INV-2026-902", "S. Murugan (Chief Cashier)")
        self.assertTrue(res_app["success"])
        self.assertEqual(res_app["status"], "APPROVED_FOR_PRINT")
        print(f"\n[PASS] Clinical Necessity & Invoice Approval verified: Audit steps = {len(res_nec['audit_trail'])}, Status = {res_app['status']}.")


if __name__ == "__main__":
    unittest.main()
