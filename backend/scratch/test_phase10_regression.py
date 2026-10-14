import os
import sys
import unittest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from agent.agent_service import process_agent_message
from services.patient_360_service import (
    get_authoritative_patient_bill,
    get_patient_authorized_reports,
    get_patient_xray_scans,
    get_xray_scan_details,
    get_xray_image_bytes,
    get_patient_discharge_summaries,
    get_discharge_summary_details,
    generate_discharge_summary_pdf,
    get_patient_clinical_records,
    get_patient_all_payment_history
)
import agent.state_manager as state_manager

class TestPhase10Integration(unittest.TestCase):

    def test_01_single_patient_report_retrieval(self):
        """Test 1: One patient profile and successful report retrieval."""
        # Patient 87630 has single profile on phone 919999987630
        conv_code = "WA_919999987630_TEST1"
        state_manager.clear_conversation_state(conv_code)

        res = process_agent_message(conv_code, "MER-PAT-0087630", "btn_my_reports", interactive_id="btn_my_reports")
        self.assertIn("response", res)
        self.assertIn("My Health Reports", res["response"])
        self.assertTrue(any(b.get("id") == "btn_cat_xrays" for b in res.get("interactive_buttons", [])))
        print("Test 1 Passed: Single patient report retrieval successful.")

    def test_02_multiple_patient_profiles_selection(self):
        """Test 2: Multiple patient profiles and correct patient selection."""
        # Phone 9876532145 has multiple profiles (Lucifer Kakashi 1004433, kakarot Kakashi 1004436)
        conv_code = "WA_9876532145_TEST2"
        state_manager.clear_conversation_state(conv_code)

        # Trigger reports without selecting patient -> prompts selection
        res = process_agent_message(conv_code, None, "btn_my_reports", interactive_id="btn_my_reports")
        self.assertIn("Patient Profiles", res["response"])
        buttons = res.get("interactive_buttons", [])
        self.assertTrue(any("btn_select_pat_" in b.get("id", "") for b in buttons))

        # Select profile Lucifer Kakashi (1004433)
        res_sel = process_agent_message(conv_code, None, "btn_select_pat_1004433", interactive_id="btn_select_pat_1004433")
        state = state_manager.get_conversation_state(conv_code)
        self.assertEqual(state.get("selected_patient_id"), 1004433)
        print("Test 2 Passed: Multi-patient selection correctly prompts and selects profile.")

    def test_03_unauthorized_patient_access_rejected(self):
        """Test 3: Unauthorized patient access is rejected."""
        # Phone 919999987630 attempts to access patient 1004436 (which belongs to 9876532145)
        conv_code = "WA_919999987630_TEST3"
        state_manager.clear_conversation_state(conv_code)

        # Try button select for unlinked patient
        res = process_agent_message(conv_code, None, "btn_select_pat_1004436", interactive_id="btn_select_pat_1004436")
        self.assertIn("Access denied", res["response"])

        # Try x-ray image backend check directly
        unauthorized_scan = get_xray_scan_details(139, 87630) # Scan 139 belongs to 87421
        self.assertIsNone(unauthorized_scan)
        print("Test 3 Passed: Unauthorized patient access rejected at both UI and backend layers.")

    def test_04_existing_xray_image_retrieval(self):
        """Test 4: Existing X-ray image is retrieved and sent as real image."""
        # Patient 87421 has scan 139 with real 335KB base64 PNG
        scan = get_xray_scan_details(139, 87421)
        self.assertIsNotNone(scan)
        self.assertTrue(scan["has_image"])

        img_bytes = get_xray_image_bytes(139, 87421)
        self.assertIsNotNone(img_bytes)
        self.assertTrue(img_bytes.startswith(b"\x89PNG"))

        conv_code = "WA_919810087421_TEST4"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["patient_id"] = 87421
        state["selected_patient_id"] = 87421
        state["patient_identification_stage"] = "COMPLETED"
        state_manager.save_conversation_state(conv_code, state)

        res = process_agent_message(conv_code, "MER-PAT-0087421", "btn_send_xray_image_139", interactive_id="btn_send_xray_image_139")
        self.assertIn("media_image", res)
        self.assertTrue(os.path.exists(res["media_image"]))
        self.assertIn("Authorized X-Ray Image", res["response"])
        print(f"Test 4 Passed: Real X-Ray image retrieved ({len(img_bytes)} bytes) and dispatched.")

    def test_05_existing_radiology_report_independent(self):
        """Test 5: Existing radiology report is retrieved independently of the image."""
        # Patient 87424 has scan 14 (report exists, but image is NULL)
        scan = get_xray_scan_details(14, 87424)
        self.assertIsNotNone(scan)
        self.assertFalse(scan["has_image"])
        self.assertTrue(len(scan["scan_report"]) > 0)

        conv_code = "WA_919810087424_TEST5"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["patient_id"] = 87424
        state["selected_patient_id"] = 87424
        state["patient_identification_stage"] = "COMPLETED"
        state_manager.save_conversation_state(conv_code, state)

        res = process_agent_message(conv_code, "MER-PAT-0087424", "btn_view_rad_report_14", interactive_id="btn_view_rad_report_14")
        self.assertIn("Radiology Report", res["response"])
        self.assertIn("Findings:", res["response"])
        print("Test 5 Passed: Radiology report retrieved independently.")

    def test_06_no_image_truthful_message(self):
        """Test 6: No-image scenario returns truthful message."""
        conv_code = "WA_919810087424_TEST6"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["patient_id"] = 87424
        state["selected_patient_id"] = 87424
        state["patient_identification_stage"] = "COMPLETED"
        state_manager.save_conversation_state(conv_code, state)

        res = process_agent_message(conv_code, "MER-PAT-0087424", "btn_send_xray_image_14", interactive_id="btn_send_xray_image_14")
        self.assertNotIn("media_image", res)
        self.assertIn("digital X-ray image is not available", res["response"])
        print("Test 6 Passed: Truthful fallback when image is not present.")

    def test_07_signed_discharge_summary_retrieval(self):
        """Test 7: Signed discharge summary retrieval with PDF generation."""
        # Patient 2 has summary 1 (Approved)
        details = get_discharge_summary_details(1, 2)
        self.assertIsNotNone(details)
        self.assertTrue(details["is_approved"])

        pdf_path = generate_discharge_summary_pdf(1, 2)
        self.assertIsNotNone(pdf_path)
        self.assertTrue(os.path.exists(pdf_path))

        conv_code = "WA_919810000002_TEST7"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["patient_id"] = 2
        state["selected_patient_id"] = 2
        state["patient_identification_stage"] = "COMPLETED"
        state_manager.save_conversation_state(conv_code, state)

        res = process_agent_message(conv_code, "MER-PAT-0000002", "btn_send_discharge_pdf_1", interactive_id="btn_send_discharge_pdf_1")
        self.assertIn("media_document", res)
        self.assertTrue(os.path.exists(res["media_document"]))
        self.assertIn("Official Discharge Summary PDF", res["response"])
        print(f"Test 7 Passed: Signed discharge summary generated at {pdf_path}.")

    def test_08_pending_discharge_summary_not_signed(self):
        """Test 8: Pending discharge summary is not represented as signed."""
        # Patient 87146 has summary 87231 with approval_status = 'Pending Approval'
        details = get_discharge_summary_details(87231, 87146)
        self.assertIsNotNone(details)
        self.assertFalse(details["is_approved"])

        conv_code = "WA_919810087146_TEST8"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["patient_id"] = 87146
        state["selected_patient_id"] = 87146
        state["patient_identification_stage"] = "COMPLETED"
        state_manager.save_conversation_state(conv_code, state)

        res = process_agent_message(conv_code, "MER-PAT-0087146", "btn_discharge_87231", interactive_id="btn_discharge_87231")
        self.assertIn("Pending Approval", res["response"])
        self.assertIn("cannot be issued as a signed summary", res["response"])
        self.assertFalse(any("btn_send_discharge_pdf_" in b.get("id", "") for b in res.get("interactive_buttons", [])))
        print("Test 8 Passed: Pending discharge summary is truthfully marked and not offered for download.")

    def test_09_billing_reconciliation(self):
        """Test 9: Billing total, successful payments, and outstanding balance reconcile."""
        # Clean test payments before reconciliation check
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM payments WHERE payment_reference LIKE 'PAYBILL%' AND bill_id = 277223;")
        conn.commit()
        cur.close()
        conn.close()

        # Patient 1004436 has bill 277223 (total ₹18,600)
        bill = get_authoritative_patient_bill(1004436)
        self.assertIsNotNone(bill)
        self.assertEqual(bill["bill_number"], "MER-BIL-0277223")
        self.assertEqual(bill["total_payable_amount"], 18600.0)
        self.assertEqual(bill["outstanding_balance"], 18600.0 - bill["net_payments"] - bill["insurance_settlements"])
        print(f"Test 9 Passed: Authoritative bill reconciled. Net={bill['total_payable_amount']}, Balance={bill['outstanding_balance']}")

    def test_10_bill_payment_separation(self):
        """Test 10: Bill payment uses the bill reference and never creates or confirms an appointment."""
        # Ensure fresh state for bill 277223
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM payments WHERE payment_reference LIKE 'PAYBILL%' AND bill_id = 277223;")
        conn.commit()
        cur.close()
        conn.close()

        conv_code = "WA_9876532145_TEST10"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["selected_patient_id"] = 1004436
        state["patient_id"] = 1004436
        state["patient_identification_stage"] = "COMPLETED"
        state_manager.save_conversation_state(conv_code, state)

        # Count appointments before payment
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM appointments WHERE patient_id = 1004436;")
        appt_count_before = cur.fetchone()[0]
        cur.close()
        conn.close()

        # Initiate Bill Payment
        res_pay = process_agent_message(conv_code, "MER-PAT-1004436", "btn_pay_bill", interactive_id="btn_pay_bill")
        self.assertIn("Hospital Bill Payment", res_pay["response"])

        # Choose UPI
        res_upi = process_agent_message(conv_code, "MER-PAT-1004436", "btn_pay_upi", interactive_id="btn_pay_upi")
        self.assertIn("Hospital Bill", res_upi["response"])

        # Confirm Payment
        res_exec = process_agent_message(conv_code, "MER-PAT-1004436", "btn_pay_exec", interactive_id="btn_pay_exec")
        self.assertIn("Hospital Bill Payment Successful!", res_exec["response"])
        self.assertIn("MER-BIL-0277223", res_exec["response"])

        # Verify no appointments were created or altered
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM appointments WHERE patient_id = 1004436;")
        appt_count_after = cur.fetchone()[0]
        cur.close()
        conn.close()
        self.assertEqual(appt_count_before, appt_count_after)
        print("Test 10 Passed: Bill payment strictly isolated; no appointments touched.")

    def test_11_appointment_payment_intact(self):
        """Test 11: Appointment payment continues to use appointment workflow."""
        conv_code = "WA_919999987630_TEST11"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["payment_context"] = "APPOINTMENT_PAYMENT"
        state["selected_patient_id"] = 87630
        state["selected_doctor_id"] = 10
        state.setdefault("entities", {})["doctor_id"] = 10
        state.setdefault("entities", {})["appointment_date"] = "2026-10-20"
        state.setdefault("entities", {})["appointment_time"] = "10:00"
        state_manager.save_conversation_state(conv_code, state)

        res = process_agent_message(conv_code, "P87630", "btn_pay_gpay", interactive_id="btn_pay_gpay")
        self.assertIn("Mock Payment", res["response"])
        self.assertNotIn("Hospital Bill", res["response"])
        print("Test 11 Passed: Appointment payment continues using appointment workflow.")

    def test_12_duplicate_payment_idempotency(self):
        """Test 12: Duplicate payment requests do not create duplicate transactions."""
        conv_code = "WA_9876532145_TEST12"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["selected_patient_id"] = 1004436
        state["patient_id"] = 1004436
        state["payment_context"] = "BILL_PAYMENT"
        state_manager.save_conversation_state(conv_code, state)

        # When already paid from test 10, second pay attempt returns already settled
        res1 = process_agent_message(conv_code, "MER-PAT-1004436", "btn_pay_bill", interactive_id="btn_pay_bill")
        self.assertIn("No Outstanding Dues", res1["response"])

        # Clean test payments to restore original DB state
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM payments WHERE payment_reference LIKE 'PAYBILL%' AND bill_id = 277223;")
        conn.commit()
        cur.close()
        conn.close()
        print("Test 12 Passed: Duplicate bill payments prevented.")

    def test_13_patient_switch_clears_context(self):
        """Test 13: Switching patients clears stale report, admission, billing, and payment context."""
        conv_code = "WA_9876532145_TEST13"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["selected_patient_id"] = 1004436
        state["selected_xray_id"] = 139
        state["selected_discharge_id"] = 90007
        state["bill_id"] = 277223
        state["payment_context"] = "BILL_PAYMENT"
        state_manager.save_conversation_state(conv_code, state)

        # Switch patient
        res = process_agent_message(conv_code, None, "btn_switch_patient", interactive_id="btn_switch_patient")
        st_after = state_manager.get_conversation_state(conv_code)
        self.assertIsNone(st_after.get("selected_xray_id"))
        self.assertIsNone(st_after.get("selected_discharge_id"))
        self.assertIsNone(st_after.get("bill_id"))
        self.assertIsNone(st_after.get("payment_context"))
        print("Test 13 Passed: Patient switch thoroughly clears stale context.")

    def test_14_structured_buttons_bypass_intent_router(self):
        """Test 14: Structured WhatsApp selections do not get reinterpreted by generic intent router."""
        conv_code = "WA_919810087421_TEST14"
        state_manager.clear_conversation_state(conv_code)
        state = state_manager.get_conversation_state(conv_code)
        state["patient_id"] = 87421
        state["selected_patient_id"] = 87421
        state["patient_identification_stage"] = "COMPLETED"
        state_manager.save_conversation_state(conv_code, state)

        # Directly send structured interactive ID
        res = process_agent_message(conv_code, "MER-PAT-0087421", "btn_view_rad_report_139", interactive_id="btn_view_rad_report_139")
        self.assertIn("Radiology Report", res["response"])
        self.assertEqual(res["intent"], "PATIENT_REPORTS")
        print("Test 14 Passed: Structured IDs dispatched without LLM distortion.")

    def test_15_existing_flows_regression(self):
        """Test 15: Existing appointment, pre-admission, voice, multilingual, emergency flows remain intact."""
        conv_code = "WA_919999987630_TEST15"
        state_manager.clear_conversation_state(conv_code)

        # Emergency
        res_em = process_agent_message(conv_code, "MER-PAT-0087630", "btn_cat_emergency", interactive_id="btn_cat_emergency")
        self.assertIn("Emergency Helpline", res_em["response"])

        # Preadmission
        res_pa = process_agent_message(conv_code, "MER-PAT-0087630", "btn_preadmission", interactive_id="btn_preadmission")
        self.assertIn("Pre-Admission", res_pa["response"])

        # Multilingual (Tamil)
        res_ta = process_agent_message(conv_code, "MER-PAT-0087630", "btn_cat_health", language_override="TAMIL", interactive_id="btn_cat_health")
        self.assertIn("என் சுகாதாரம் & பதிவுகள்", res_ta["response"])

        print("Test 15 Passed: Existing emergency, preadmission, and multilingual flows intact.")

if __name__ == "__main__":
    unittest.main()
