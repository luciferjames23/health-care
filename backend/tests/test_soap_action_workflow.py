import os
import sys
import unittest
from unittest.mock import MagicMock
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import HTTPException

from routers.soap_notes import actions_router, router
from services import soap_action_workflow_service as workflow
from services.soap_action_service import extract_clinical_actions


class SoapActionWorkflowTests(unittest.TestCase):
    def test_all_phase_three_routes_are_registered(self):
        paths = {(route.path, tuple(sorted(route.methods or []))) for route in (*router.routes, *actions_router.routes)}
        required = {
            ("/api/v1/soap/notes/{soap_note_id}/actions/detect", ("POST",)),
            ("/api/v1/soap/notes/{soap_note_id}/actions", ("GET",)),
            ("/api/v1/soap/actions/{action_id}", ("PATCH",)),
            ("/api/v1/soap/actions/{action_id}/confirm", ("POST",)),
            ("/api/v1/soap/actions/{action_id}/reject", ("POST",)),
            ("/api/v1/soap/notes/{soap_note_id}/actions/confirm-batch", ("POST",)),
            ("/api/v1/soap/notes/{soap_note_id}/actions/dispatch", ("POST",)),
        }
        self.assertTrue(required.issubset(paths))

    def test_mutable_fields_are_limited_by_action_type(self):
        self.assertEqual(workflow.MUTABLE_FIELDS["MEDICATION_ORDER"], {"name", "dose", "unit", "route", "frequency", "duration"})
        self.assertEqual(workflow.MUTABLE_FIELDS["IMAGING_ORDER"], {"name", "priority", "projection", "clinical_indication"})
        self.assertEqual(workflow.MUTABLE_FIELDS["FOLLOW_UP"], {"duration"})
        for immutable in ("action_id", "soap_note_id", "patient_id", "visit_id", "admission_id", "action_key", "intent", "source_text", "status", "confirmed_by", "confirmed_at", "target_module", "target_record_id"):
            self.assertFalse(any(immutable in fields for fields in workflow.MUTABLE_FIELDS.values()))

    def test_stale_action_cannot_be_edited_or_confirmed(self):
        action = {"transcript_fingerprint": "old", "status": "PENDING_CONFIRMATION"}
        note = {"status": "DRAFT", "raw_transcript": "changed transcript"}
        with self.assertRaises(HTTPException) as caught:
            workflow._ensure_mutable_action(action, note)
        self.assertEqual(caught.exception.status_code, 409)

    def test_signed_note_action_is_immutable(self):
        with self.assertRaises(HTTPException) as caught:
            workflow._ensure_mutable_action(
                {"transcript_fingerprint": workflow._fingerprint("raw"), "status": "PENDING_CONFIRMATION"},
                {"status": "SIGNED", "raw_transcript": "raw"},
            )
        self.assertEqual(caught.exception.status_code, 409)

    def test_confirm_requires_medication_fields_but_catalog_resolution_waits_for_dispatch(self):
        missing = {"intent": "CREATE_ORDER", "action_type": "MEDICATION_ORDER", "name": "Aspirin", "dose": None, "unit": None}
        self.assertIn("dose", workflow._confirmation_error(MagicMock(), missing))
        complete = {**missing, "dose": 75, "unit": "mg"}
        cur = MagicMock()
        self.assertIsNone(workflow._confirmation_error(cur, complete))
        cur.execute.assert_not_called()

    def test_confirmed_state_update_does_not_write_operational_tables(self):
        cur = MagicMock()
        action = {
            "action_id": uuid4(), "status": "PENDING_CONFIRMATION", "intent": "DOCUMENT_FINDING",
            "action_type": "CLINICAL_FINDING", "name": "Pulse", "finding_type": "PULSE",
            "value": 96, "unit": "bpm",
            "transcript_fingerprint": workflow._fingerprint("raw"),
        }
        note = {"status": "DRAFT", "raw_transcript": "raw"}
        user = {"id": 8}
        cur.fetchone.return_value = {**action, "status": "CONFIRMED", "confirmed_by": 8}
        result = workflow._confirm_one(cur, action, note, user)
        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "CONFIRMED")
        sql = " ".join(call.args[0] for call in cur.execute.call_args_list)
        self.assertIn("UPDATE soap_clinical_actions", sql)
        self.assertNotIn("INSERT INTO", sql.upper())
        self.assertNotIn("medication_orders", sql.lower())
        self.assertNotIn("lab_orders", sql.lower())
        self.assertNotIn("imaging_orders", sql.lower())
        self.assertNotIn("vital_signs", sql.lower())

    def test_consideration_cannot_be_promoted_to_an_order_by_confirmation(self):
        action = {"intent": "CONSIDER", "action_type": "DIAGNOSTIC_ORDER", "name": "ECG"}
        self.assertIn("consideration", workflow._confirmation_error(MagicMock(), action))

    def test_imaging_confirmation_requires_supported_projection_and_indication(self):
        action = {"intent": "CREATE_ORDER", "action_type": "IMAGING_ORDER", "name": "Chest X-ray",
                  "projection": None, "clinical_indication": "Persistent cough for 5 days"}
        self.assertIn("projection", workflow._confirmation_error(MagicMock(), action))
        action["projection"] = "PA"
        self.assertIsNone(workflow._confirmation_error(MagicMock(), action))
        action["projection"] = "LAT"
        self.assertIn("projection", workflow._confirmation_error(MagicMock(), action))

    def test_temperature_confirmation_requires_explicit_existing_storage_unit(self):
        action = {"intent": "DOCUMENT_FINDING", "action_type": "CLINICAL_FINDING", "name": "Temperature",
                  "finding_type": "TEMPERATURE", "value": 101, "unit": None}
        self.assertIn("Fahrenheit", workflow._confirmation_error(MagicMock(), action))
        action["unit"] = "F"
        self.assertIsNone(workflow._confirmation_error(MagicMock(), action))



if __name__ == "__main__":
    unittest.main()
