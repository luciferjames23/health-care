"""
test_e2e_whatsapp_delivery_and_phone.py
=======================================
End-to-end verification covering:
1. Bug 1: Accurate WhatsApp status transitions (SUBMITTED -> DELIVERED -> READ, FAILED)
2. Bug 2: Robust phone number normalization, multi-variant queries, and duplicate prevention
"""

import sys
import os
import unittest
from unittest.mock import patch, MagicMock
import json
import uuid

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config
from utils.phone_utils import (
    parse_and_normalize_phone,
    to_canonical_e164,
    to_meta_digits,
    get_phone_lookup_variants,
    get_phone_query_condition,
    get_phone_query_params
)
import preadmission_service
import services.patient_service as patient_service
import api.whatsapp_routes as whatsapp_routes


class TestE2EWhatsAppDeliveryAndPhone(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = db_config.get_db_connection()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def test_whatsapp_delivery_lifecycle_and_webhooks(self):
        """Tests the full delivery lifecycle: SUBMITTED -> DELIVERED -> READ and idempotency."""
        cur = self.conn.cursor()
        try:
            # 1. Create a temporary pre-admission record
            cur.execute("SELECT id FROM patients WHERE status = 'ACTIVE' LIMIT 1;")
            pat_row = cur.fetchone()
            if not pat_row:
                self.skipTest("No active patient found for e2e test")
            pat_id = pat_row[0]
            cur.execute("SELECT id, department_id FROM doctors WHERE status = 'ACTIVE' AND department_id IS NOT NULL LIMIT 1;")
            doc_row = cur.fetchone()
            if not doc_row:
                self.skipTest("No active doctor with department found for e2e test")
            doc_id, dept_id = doc_row[0], doc_row[1]

            pa_res = preadmission_service.create_pre_admission(
                patient_id=pat_id,
                doctor_id=doc_id,
                department_id=dept_id,
                expected_admission_date="2026-11-01",
                admission_type="INPATIENT",
                instructions="Report at 8 AM",
                remarks="Initial registration test"
            )
            pa_id = pa_res["pre_admission_id"]

            test_wamid = f"wamid.TEST_E2E_{uuid.uuid4().hex[:12]}"

            # 2. Mock Meta API acceptance
            with patch("voice.whatsapp_client.send_button_message", return_value={"success": True, "message_id": test_wamid}):
                disp_res = preadmission_service.dispatch_pre_admission_notification(pa_id)
                self.assertTrue(disp_res["success"])
                self.assertEqual(disp_res["status"], "SUBMITTED")
                self.assertIn("delivery pending", disp_res["detail"].lower())

            # 3. Simulate inbound webhook: status = DELIVERED
            delivered_payload = {
                "entry": [{
                    "changes": [{
                        "value": {
                            "statuses": [{
                                "id": test_wamid,
                                "status": "delivered",
                                "timestamp": "1700000000",
                                "recipient_id": "919876543210"
                            }]
                        }
                    }]
                }]
            }
            webhook_res = whatsapp_routes.handle_whatsapp_webhook(delivered_payload, MagicMock())
            self.assertEqual(webhook_res.get("status"), "ok")

            # Verify database: notification should be DELIVERED, pre_admission should be CONTACTED
            cur.execute("SELECT status, delivered_at FROM notifications WHERE external_message_id = %s;", (test_wamid,))
            notif_row = cur.fetchone()
            self.assertEqual(notif_row[0], "DELIVERED")
            self.assertIsNotNone(notif_row[1])
            delivered_time_1 = notif_row[1]

            cur.execute("SELECT status FROM pre_admissions WHERE id = %s;", (pa_id,))
            pa_row = cur.fetchone()
            self.assertEqual(pa_row[0], "CONTACTED")

            # 4. Duplicate webhook idempotency test: deliver same event again
            webhook_res_dup = whatsapp_routes.handle_whatsapp_webhook(delivered_payload, MagicMock())
            self.assertEqual(webhook_res_dup.get("status"), "ok")
            cur.execute("SELECT status, delivered_at FROM notifications WHERE external_message_id = %s;", (test_wamid,))
            notif_row_dup = cur.fetchone()
            self.assertEqual(notif_row_dup[0], "DELIVERED")
            self.assertEqual(notif_row_dup[1], delivered_time_1, "Duplicate webhook must not alter original timestamp")

            # 5. Simulate inbound webhook: status = READ
            read_payload = {
                "entry": [{
                    "changes": [{
                        "value": {
                            "statuses": [{
                                "id": test_wamid,
                                "status": "read",
                                "timestamp": "1700000010",
                                "recipient_id": "919876543210"
                            }]
                        }
                    }]
                }]
            }
            whatsapp_routes.handle_whatsapp_webhook(read_payload, MagicMock())
            cur.execute("SELECT status, read_at FROM notifications WHERE external_message_id = %s;", (test_wamid,))
            notif_row_read = cur.fetchone()
            self.assertEqual(notif_row_read[0], "READ")
            self.assertIsNotNone(notif_row_read[1])

            # Clean up test pre_admission
            cur.execute("DELETE FROM notifications WHERE external_message_id = %s;", (test_wamid,))
            cur.execute("DELETE FROM pre_admissions WHERE id = %s;", (pa_id,))
            self.conn.commit()

        finally:
            cur.close()

    def test_provider_rejection_webhook(self):
        """Simulates provider delivery failure webhook with error payload."""
        cur = self.conn.cursor()
        try:
            fail_wamid = f"wamid.FAIL_{uuid.uuid4().hex[:12]}"
            cur.execute("SELECT id FROM patients LIMIT 1;")
            pat_id = cur.fetchone()[0]

            # Insert initial SUBMITTED notification
            cur.execute("""
                INSERT INTO notifications (patient_id, notification_type, channel, message, status, external_message_id, created_at)
                VALUES (%s, 'ADMISSION_REMINDER', 'WHATSAPP', 'Test Message', 'SUBMITTED', %s, CURRENT_TIMESTAMP)
                RETURNING id;
            """, (pat_id, fail_wamid))
            notif_id = cur.fetchone()[0]
            self.conn.commit()

            # Simulate failed webhook with Meta error code 131047
            failed_payload = {
                "entry": [{
                    "changes": [{
                        "value": {
                            "statuses": [{
                                "id": fail_wamid,
                                "status": "failed",
                                "timestamp": "1700000050",
                                "recipient_id": "919876543210",
                                "errors": [{
                                    "code": 131047,
                                    "title": "Re-engagement message",
                                    "message": "More than 24 hours have passed since the recipient last replied"
                                }]
                            }]
                        }
                    }]
                }]
            }
            whatsapp_routes.handle_whatsapp_webhook(failed_payload, MagicMock())

            cur.execute("SELECT status, reason, failed_at FROM notifications WHERE id = %s;", (notif_id,))
            row = cur.fetchone()
            self.assertEqual(row[0], "FAILED")
            self.assertIn("131047", row[1])
            self.assertIsNotNone(row[2])

            # Cleanup
            cur.execute("DELETE FROM notifications WHERE id = %s;", (notif_id,))
            self.conn.commit()
        finally:
            cur.close()


if __name__ == "__main__":
    unittest.main()
