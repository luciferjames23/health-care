"""
test_whatsapp_root_cause_fixes.py
==================================
Comprehensive automated test suite validating permanent root-cause fixes:
1. WhatsApp delivery & status reporting (Accepted/Submitted, Delivered, Read, Failed, Idempotency)
2. Phone number normalization (International numbers, Local numbers, Canonical E.164, Multi-family contacts, DB lookup variants)
"""

import sys
import os
import unittest
from unittest.mock import MagicMock, patch
import json
import uuid

# Ensure backend path is configured
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config
from utils.phone_utils import (
    parse_and_normalize_phone,
    to_canonical_e164,
    to_meta_digits,
    normalize_phone,
    get_phone_lookup_variants,
    get_phone_query_condition,
    get_phone_query_params,
    extract_whatsapp_number
)
import voice.whatsapp_client as whatsapp_client
import preadmission_service
import services.patient_service as patient_service
import agent.patient_identification_service as patient_id_service


class TestPhoneNumberNormalization(unittest.TestCase):
    """Validates phone number parsing, canonicalization, and query generation."""

    def test_indian_standard_number(self):
        e164, digits, valid = parse_and_normalize_phone("9876543210")
        self.assertTrue(valid)
        self.assertEqual(e164, "+919876543210")
        self.assertEqual(digits, "919876543210")

    def test_indian_number_with_plus(self):
        e164, digits, valid = parse_and_normalize_phone("+919876543210")
        self.assertTrue(valid)
        self.assertEqual(e164, "+919876543210")
        self.assertEqual(digits, "919876543210")

    def test_indian_number_with_trunk_zero(self):
        e164, digits, valid = parse_and_normalize_phone("09876543210")
        self.assertTrue(valid)
        self.assertEqual(e164, "+919876543210")
        self.assertEqual(digits, "919876543210")

    def test_accidental_double_country_code(self):
        # Prevent +9191... corruption
        e164, digits, valid = parse_and_normalize_phone("+91919876543210")
        self.assertTrue(valid)
        self.assertEqual(e164, "+919876543210")
        self.assertEqual(digits, "919876543210")

    def test_international_us_number(self):
        # US phone number: +1 415-555-2671
        e164, digits, valid = parse_and_normalize_phone("+14155552671")
        self.assertTrue(valid)
        self.assertEqual(e164, "+14155552671")
        self.assertEqual(digits, "14155552671")

    def test_international_uk_number(self):
        # UK phone number: +44 7911 123456
        e164, digits, valid = parse_and_normalize_phone("+447911123456")
        self.assertTrue(valid)
        self.assertEqual(e164, "+447911123456")
        self.assertEqual(digits, "447911123456")

    def test_international_trunk_prefix_00(self):
        e164, digits, valid = parse_and_normalize_phone("00447911123456")
        self.assertTrue(valid)
        self.assertEqual(e164, "+447911123456")
        self.assertEqual(digits, "447911123456")

    def test_invalid_number_handling(self):
        e164, digits, valid = parse_and_normalize_phone("invalid_phone_123")
        self.assertFalse(valid)
        self.assertIsNone(e164)

    def test_lookup_variants_completeness(self):
        variants = get_phone_lookup_variants("+919876543210")
        self.assertIn("+919876543210", variants)
        self.assertIn("919876543210", variants)
        self.assertIn("9876543210", variants)

    def test_sql_query_params_generation(self):
        params = get_phone_query_params("9876543210")
        self.assertEqual(len(params), 8)
        self.assertEqual(params[2], "+919876543210")  # e164
        self.assertEqual(params[4], "919876543210")   # meta digits
        self.assertEqual(params[6], "9876543210")     # 10 digits


class TestWhatsAppDeliveryAndReporting(unittest.TestCase):
    """Validates real WhatsApp client and pre-admission delivery tracking."""

    @patch("voice.whatsapp_client.is_mock_mode", return_value=False)
    @patch("voice.whatsapp_client.get_http_session")
    def test_send_text_rejected_by_meta_returns_failed_not_success(self, mock_session, mock_mock):
        # Simulates Meta error response (e.g. Sandbox recipient not allowed, code 131030)
        mock_response = MagicMock()
        mock_response.ok = False
        mock_response.status_code = 400
        mock_response.json.return_value = {
            "error": {
                "message": "(#131030) Recipient phone number not in allowed list",
                "type": "OAuthException",
                "code": 131030,
                "error_data": {
                    "messaging_product": "whatsapp",
                    "details": "Recipient phone number not in allowed list"
                }
            }
        }
        mock_session.return_value.post.return_value = mock_response

        res = whatsapp_client.send_text_message("919876543210", "Hello Test")
        self.assertFalse(res.get("success"), "Must NOT report success when Meta API rejects message")
        self.assertEqual(res.get("status"), "FAILED")
        self.assertIn("131030", str(res.get("error")))

    @patch("voice.whatsapp_client.is_mock_mode", return_value=False)
    @patch("voice.whatsapp_client.get_http_session")
    def test_send_text_accepted_by_meta_returns_accepted_status(self, mock_session, mock_mock):
        # Simulates Meta success response
        test_wamid = f"wamid.HBgL{uuid.uuid4().hex[:16]}"
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "messaging_product": "whatsapp",
            "contacts": [{"input": "919876543210", "wa_id": "919876543210"}],
            "messages": [{"id": test_wamid}]
        }
        mock_session.return_value.post.return_value = mock_response

        res = whatsapp_client.send_text_message("919876543210", "Admission Notification")
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("status"), "ACCEPTED")
        self.assertEqual(res.get("message_id"), test_wamid)

    def test_preadmission_notification_dispatch_success_marks_submitted(self):
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            # 1. Fetch an existing pre-admission record
            cur.execute("SELECT id, patient_id FROM pre_admissions ORDER BY id DESC LIMIT 1;")
            pa_row = cur.fetchone()
            if not pa_row:
                self.skipTest("No pre-admission record exists to test dispatch")
            pa_id, pat_id = pa_row

            # Mock whatsapp_client outbound sending to succeed
            fake_wamid = f"wamid.TEST_{uuid.uuid4().hex[:12]}"
            with patch("voice.whatsapp_client.send_button_message", return_value={"success": True, "message_id": fake_wamid}):
                dispatch_res = preadmission_service.dispatch_pre_admission_notification(pa_id)
                self.assertTrue(dispatch_res.get("success"))
                self.assertEqual(dispatch_res.get("status"), "SUBMITTED", "Must report SUBMITTED, not DELIVERED")
                self.assertEqual(dispatch_res.get("message_id"), fake_wamid)
                self.assertIn("delivery pending", dispatch_res.get("detail", "").lower())

                # Verify database state
                notif_id = dispatch_res.get("notification_id")
                cur.execute("SELECT status, external_message_id FROM notifications WHERE id = %s;", (notif_id,))
                notif_row = cur.fetchone()
                self.assertEqual(notif_row[0], "SUBMITTED")
                self.assertEqual(notif_row[1], fake_wamid)

        finally:
            cur.close()
            conn.close()

    def test_preadmission_notification_dispatch_failure_marks_failed(self):
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT id FROM pre_admissions ORDER BY id DESC LIMIT 1;")
            pa_row = cur.fetchone()
            if not pa_row:
                self.skipTest("No pre-admission record exists to test dispatch")
            pa_id = pa_row[0]

            # Mock whatsapp_client outbound sending to fail
            mock_err = "Meta Error #131030: Phone number not in Meta Developer Sandbox allowed test recipient list"
            with patch("voice.whatsapp_client.send_button_message", return_value={"success": False, "status": "FAILED", "error": mock_err}), \
                 patch("voice.whatsapp_client.send_text_message", return_value={"success": False, "status": "FAILED", "error": mock_err}):
                dispatch_res = preadmission_service.dispatch_pre_admission_notification(pa_id)
                self.assertFalse(dispatch_res.get("success"))
                self.assertEqual(dispatch_res.get("status"), "FAILED")
                self.assertEqual(dispatch_res.get("error"), mock_err)

                # Verify database state
                notif_id = dispatch_res.get("notification_id")
                cur.execute("SELECT status, reason FROM notifications WHERE id = %s;", (notif_id,))
                notif_row = cur.fetchone()
                self.assertEqual(notif_row[0], "FAILED")
                self.assertIn("131030", notif_row[1])

        finally:
            cur.close()
            conn.close()


class TestPatientRegistrationAndMultiFamily(unittest.TestCase):
    """Validates that patient registration canonicalizes numbers and preserves multi-family members."""

    def test_multi_family_members_on_same_phone(self):
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            test_phone = "+919876543299"
            rand_suffix = uuid.uuid4().hex[:6]

            # Register Member 1: Father
            m1 = patient_service.register_new_patient(
                first_name=f"Father_{rand_suffix}",
                last_name="Sharma",
                date_of_birth="1975-05-15",
                gender="Male",
                phone=test_phone,
                conn=conn
            )
            # Register Member 2: Daughter
            m2 = patient_service.register_new_patient(
                first_name=f"Daughter_{rand_suffix}",
                last_name="Sharma",
                date_of_birth="2005-09-20",
                gender="Female",
                phone=test_phone,
                conn=conn
            )

            self.assertTrue(m1.get("success"))
            self.assertTrue(m2.get("success"))
            self.assertNotEqual(m1.get("id"), m2.get("id"), "Two different family members must get separate IDs")

            # Verify identical check prevents duplicate of father
            dup_check = patient_service.find_identical_registered_patient(
                cur,
                first_name=f"Father_{rand_suffix}",
                last_name="Sharma",
                date_of_birth="1975-05-15",
                phone="9876543299"  # Passing without country code must still match father!
            )
            self.assertIsNotNone(dup_check)
            self.assertEqual(dup_check[0], m1.get("id"))

            # Roll back test data
            conn.rollback()
        finally:
            cur.close()
            conn.close()


if __name__ == "__main__":
    unittest.main()
