import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import soap_action_dispatch_service as dispatch
from services import soap_lab_order_service as lab_service
from services import soap_note_service as notes
from services import soap_prescription_service as prescription_service
from services.soap_action_service import extract_clinical_actions


class SoapActionDispatchTests(unittest.TestCase):
    def setUp(self):
        self.note = {"soap_note_id": 91, "patient_id": 20, "visit_id": 700, "admission_id": None}
        self.action = {"action_id": uuid4(), "soap_note_id": 91, "name": "Aspirin", "dose": 75, "unit": "mg",
                       "route": None, "frequency": None, "duration": None, "priority": "ROUTINE"}

    def test_medication_creation_resolves_exact_catalog_and_creates_only_order_records(self):
        cur = MagicMock()
        cur.fetchone.side_effect = [None, (501,), (501,), (901,)]
        cur.fetchall.return_value = [{"medication_id": 7, "medication_name": "Aspirin", "generic_name": "Aspirin",
                                      "brand_name": None, "strength": "75 mg"}]
        target, existing = prescription_service.create_prescription(cur, self.note, self.action, doctor_id=3)
        self.assertFalse(existing)
        self.assertEqual(target["prescription_id"], 501)
        statements = [call.args[0] for call in cur.execute.call_args_list]
        self.assertTrue(any("INSERT INTO prescriptions" in sql for sql in statements))
        item_call = next(call for call in cur.execute.call_args_list if "INSERT INTO prescription_items" in call.args[0])
        self.assertEqual(item_call.args[1], (901, 501, 7, "75 mg", None, None, None))
        normalized_item_sql = item_call.args[0].replace(" ", "")
        self.assertIn("quantity,instructions", normalized_item_sql)
        self.assertIn("VALUES(%s,%s,%s,%s,%s,%s,%s,NULL,NULL)", normalized_item_sql)
        prescription_sql = next(call.args[0] for call in cur.execute.call_args_list if "INSERT INTO prescriptions" in call.args[0])
        self.assertIn("'Active'", prescription_sql)
        self.assertFalse(any("pharmacy_sales" in sql or "pharmacy_sale_items" in sql for sql in statements))
        self.assertFalse(any("INSERT INTO lab_results" in sql for sql in statements))

    def test_medication_exact_resolution_fails_without_substitution(self):
        cur = MagicMock()
        cur.fetchall.return_value = []
        self.assertIsNone(prescription_service.resolve_medication(cur, self.action))
        query = cur.execute.call_args.args[0]
        self.assertIn("lower(trim(COALESCE(medication_name,'')))=lower(%s)", query)
        self.assertNotIn("ORDER BY medication_id ASC LIMIT 1", query)

    def test_dolo_650_brand_alias_resolves_only_with_matching_catalog_strength(self):
        cur = MagicMock()
        cur.fetchall.return_value = [{"medication_id": 24, "medication_name": "Tab. Paracetamol",
                                      "generic_name": "Acetaminophen", "brand_name": "Dolo 650",
                                      "strength": "650 mg"}]
        action = {**self.action, "name": "Dolo", "dose": 650, "unit": "mg"}
        self.assertEqual(prescription_service.resolve_medication(cur, action)["medication_id"], 24)

        cur.fetchall.return_value = [{"medication_id": 25, "medication_name": "Tab. Paracetamol",
                                      "generic_name": "Acetaminophen", "brand_name": "Dolo 500",
                                      "strength": "500 mg"}]
        self.assertIsNone(prescription_service.resolve_medication(cur, action))

    def test_dolo_frequency_is_extracted_and_persisted_on_prescription_item(self):
        action = extract_clinical_actions("Start Dolo 650 mg twice daily").actions[0]
        self.assertEqual((action.name, action.dose, action.unit, action.frequency), ("Dolo", 650, "mg", "TWICE DAILY"))

        cur = MagicMock()
        cur.fetchone.side_effect = [None, (501,), (501,), (901,)]
        cur.fetchall.return_value = [{"medication_id": 24, "medication_name": "Tab. Paracetamol",
                                      "generic_name": "Acetaminophen", "brand_name": "Dolo 650",
                                      "strength": "650 mg"}]
        prescription_service.create_prescription(cur, self.note, {**action.model_dump(), "action_id": self.action["action_id"]}, doctor_id=3)
        item_call = next(call for call in cur.execute.call_args_list if "INSERT INTO prescription_items" in call.args[0])
        self.assertEqual(item_call.args[1][4], "TWICE DAILY")

    def test_medication_with_missing_catalog_strength_is_not_resolved(self):
        cur = MagicMock()
        cur.fetchall.return_value = [{"medication_id": 24, "medication_name": "Tab. Aspirin",
                                      "generic_name": "Aspirin", "brand_name": "Aspirin",
                                      "strength": None}]
        self.assertIsNone(prescription_service.resolve_medication(cur, self.action))

    def test_unknown_medication_creates_no_prescription(self):
        cur = MagicMock()
        cur.fetchone.return_value = None
        cur.fetchall.return_value = []
        with self.assertRaisesRegex(ValueError, "Medication could not be resolved"):
            prescription_service.create_prescription(cur, self.note, self.action, doctor_id=3)
        self.assertFalse(any("INSERT INTO prescriptions" in call.args[0] for call in cur.execute.call_args_list))

    def test_missing_medication_dose_or_unit_creates_no_prescription(self):
        cur = MagicMock()
        cur.fetchone.return_value = None
        incomplete = {**self.action, "dose": None}
        with self.assertRaisesRegex(ValueError, "Medication order incomplete"):
            prescription_service.create_prescription(cur, self.note, incomplete, doctor_id=3)
        self.assertFalse(any("INSERT INTO prescriptions" in call.args[0] for call in cur.execute.call_args_list))

    def test_prescription_idempotency_returns_existing_by_action_id(self):
        cur = MagicMock()
        cur.fetchone.return_value = {"prescription_id": 501, "source_action_id": self.action["action_id"]}
        existing, idempotent = prescription_service.create_prescription(cur, self.note, self.action, doctor_id=3)
        self.assertTrue(idempotent)
        self.assertEqual(existing["prescription_id"], 501)
        self.assertEqual(cur.execute.call_count, 1)
        self.assertIn("source_action_id=%s", cur.execute.call_args.args[0])

    def test_lab_alias_resolves_cbc_to_existing_catalog_test(self):
        cur = MagicMock()
        cur.fetchall.return_value = [{"lab_test_id": 1, "test_code": "LAB-01", "test_name": "CBC"}]
        result = lab_service.resolve_lab_test(cur, {"name": "Complete Blood Count", "code": "CBC"})
        self.assertEqual(result["lab_test_id"], 1)
        self.assertEqual(set(cur.execute.call_args.args[1]), {"cbc", "complete blood count"})

    def test_lab_order_is_pending_and_creates_no_lab_result(self):
        cur = MagicMock()
        cur.fetchone.side_effect = [None, (701,), (701,)]
        cur.fetchall.return_value = [{"lab_test_id": 1, "test_code": "LAB-01", "test_name": "CBC"}]
        target, existing = lab_service.create_lab_order(cur, self.note, {**self.action, "action_type": "LAB_ORDER", "name": "Complete Blood Count", "code": "CBC"}, doctor_id=3)
        self.assertFalse(existing)
        self.assertEqual(target["status"], "Pending")
        sql = " ".join(call.args[0] for call in cur.execute.call_args_list)
        insert = next(call for call in cur.execute.call_args_list if "INSERT INTO lab_orders" in call.args[0])
        self.assertIn("'Pending'", insert.args[0])
        self.assertEqual(insert.args[1][-2:], (91, str(self.action["action_id"])))
        self.assertNotIn("INSERT INTO lab_results", sql)
        self.assertEqual(insert.args[1][0], 701)

    def test_unresolved_lab_creates_no_order_or_result(self):
        cur = MagicMock()
        cur.fetchone.return_value = None
        cur.fetchall.return_value = []
        with self.assertRaisesRegex(ValueError, "Laboratory test could not be resolved"):
            lab_service.create_lab_order(cur, self.note, {**self.action, "action_type": "LAB_ORDER", "name": "Unknown Panel", "code": "XYZ"}, doctor_id=3)
        self.assertFalse(any("INSERT INTO lab_orders" in call.args[0] for call in cur.execute.call_args_list))
        self.assertFalse(any("INSERT INTO lab_results" in call.args[0] for call in cur.execute.call_args_list))

    def test_lab_order_idempotency_returns_existing_by_action_id(self):
        cur = MagicMock()
        cur.fetchone.return_value = {"lab_order_id": 701, "source_action_id": self.action["action_id"]}
        existing, idempotent = lab_service.create_lab_order(cur, self.note, self.action, doctor_id=3)
        self.assertTrue(idempotent)
        self.assertEqual(existing["lab_order_id"], 701)
        self.assertEqual(cur.execute.call_count, 1)

    def test_only_confirmed_actions_are_dispatchable(self):
        base = {"confirmed_by": 3, "confirmed_at": "now"}
        for status in ("DETECTED", "PENDING_CONFIRMATION", "REJECTED", "FAILED", "CREATED"):
            self.assertFalse(dispatch._is_confirmed_for_dispatch({**base, "status": status}), status)
        self.assertTrue(dispatch._is_confirmed_for_dispatch({**base, "status": "CONFIRMED"}))

    def test_all_four_confirmed_structured_vitals_are_dispatched(self):
        note = {**self.note, "status": "SIGNED", "author_user_id": 8, "signed_by": 8,
                "raw_transcript": "the same dictated transcript"}
        fingerprint = dispatch._fingerprint(note["raw_transcript"])
        cases = [
            ("TEMPERATURE", {"value": 101, "unit": "F"}),
            ("BLOOD_PRESSURE", {"systolic": 130, "diastolic": 80, "unit": "mmHg"}),
            ("PULSE", {"value": 96, "unit": "bpm"}),
            ("SPO2", {"value": 98, "unit": "%"}),
        ]
        actions = [{
            "action_id": uuid4(), "soap_note_id": 91, "action_type": "CLINICAL_FINDING",
            "finding_type": finding_type, "status": "CONFIRMED", "confirmed_by": 8,
            "confirmed_at": "now", "transcript_fingerprint": fingerprint, **fields,
        } for finding_type, fields in cases]
        cur = MagicMock()
        conn = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cur
        cur.fetchall.return_value = actions
        created = []

        def persist_vital(_cur, _note, action, _actor_id):
            created.append(action["finding_type"])
            return {"vital_id": 100 + len(created)}, False

        def mark_created(_cur, action, _actor_id, module, target):
            self.assertEqual(module, "vital_signs")
            return ({**action, "status": "CREATED"}, target["vital_id"])

        with patch.object(dispatch.db_config, "get_db_connection", return_value=conn), \
             patch.object(dispatch, "_clinical_user", return_value={"id": 8, "role": "Doctor"}), \
             patch.object(dispatch, "_doctor_id_for_user", return_value=3), \
             patch.object(notes, "get_note", return_value=note), \
             patch.object(notes, "validate_context"), \
             patch.object(dispatch, "_event"), \
             patch.object(dispatch, "create_confirmed_soap_vital", side_effect=persist_vital), \
             patch.object(dispatch, "_mark_created", side_effect=mark_created):
            result = dispatch.dispatch_confirmed_actions(91, {"user_id": 8})

        self.assertTrue(result["success"])
        self.assertEqual(created, ["TEMPERATURE", "BLOOD_PRESSURE", "PULSE", "SPO2"])
        self.assertEqual([item["outcome"] for item in result["results"]], ["CREATED"] * 4)

    def test_doctor_lookup_uses_doctors_primary_key(self):
        cur = MagicMock()
        cur.fetchone.return_value = (6,)

        self.assertEqual(dispatch._doctor_id_for_user(cur, 6), 6)
        self.assertEqual(cur.execute.call_args.args,
                         ("SELECT id FROM doctors WHERE user_id=%s LIMIT 1", (6,)))

    def test_imaging_dispatch_calls_existing_order_workflow_with_provenance(self):
        cur = MagicMock()
        note = {**self.note, "soap_note_id": 91, "signed_by": 8, "admission_id": 900}
        action = {**self.action, "action_id": uuid4(), "name": "Chest X-ray", "projection": "PA",
                  "clinical_indication": "Persistent cough for 5 days", "priority": "ROUTINE"}
        order_id = uuid4()
        with patch("routers.imaging_orders.create_order_record", return_value={"order_id": str(order_id)}) as create:
            target, existing = dispatch._create_imaging_order(cur, note, action, doctor_id=3)
            retry_target, retry_existing = dispatch._create_imaging_order(cur, note, action, doctor_id=3)
        self.assertFalse(existing)
        self.assertEqual(retry_target, target)
        self.assertFalse(retry_existing)
        self.assertEqual(create.call_count, 2)
        self.assertEqual(target["order_id"], str(order_id))
        args = create.call_args.args
        body, user, provenance = args[1], args[2], args[3]
        self.assertEqual(body.examination, "Chest X-ray PA")
        self.assertEqual(body.indication, "Persistent cough for 5 days")
        self.assertEqual(body.priority, "Routine")
        self.assertEqual(str(body.request_id), str(action["action_id"]))
        self.assertEqual(str(create.call_args_list[0].args[1].request_id),
                         str(create.call_args_list[1].args[1].request_id))
        self.assertEqual(user, {"user_id": 8, "role": "doctor"})
        self.assertEqual(provenance, {"visit_id": 700, "admission_id": 900,
                                      "soap_note_id": 91, "action_id": str(action["action_id"])})

    def test_imaging_dispatch_rejects_missing_projection_before_workflow(self):
        with patch("routers.imaging_orders.create_order_record") as create:
            with self.assertRaisesRegex(ValueError, "projection"):
                dispatch._create_imaging_order(self.action, self.note, {**self.action, "name": "Chest X-ray",
                    "projection": None, "clinical_indication": "Cough"}, doctor_id=3)
        create.assert_not_called()

    def test_live_doctors_and_order_foreign_keys_use_id(self):
        conn = dispatch.db_config.get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""SELECT column_name FROM information_schema.columns
                               WHERE table_schema='public' AND table_name='doctors'""")
                doctor_columns = {row[0] for row in cur.fetchall()}
                self.assertTrue({"id", "user_id", "doctor_code"}.issubset(doctor_columns))
                self.assertNotIn("doctor_id", doctor_columns)

                cur.execute("""SELECT tc.table_name, ccu.table_name, ccu.column_name
                               FROM information_schema.table_constraints tc
                               JOIN information_schema.key_column_usage kcu
                                 ON tc.constraint_name=kcu.constraint_name
                                AND tc.constraint_schema=kcu.constraint_schema
                               JOIN information_schema.constraint_column_usage ccu
                                 ON ccu.constraint_name=tc.constraint_name
                                AND ccu.constraint_schema=tc.constraint_schema
                               WHERE tc.constraint_type='FOREIGN KEY'
                                 AND tc.table_schema='public'
                                 AND tc.table_name IN ('prescriptions','lab_orders')
                                 AND kcu.column_name='doctor_id'""")
                doctor_fks = {(row[0], row[1], row[2]) for row in cur.fetchall()}
                self.assertIn(("prescriptions", "doctors", "id"), doctor_fks)
                self.assertIn(("lab_orders", "doctors", "id"), doctor_fks)
        finally:
            conn.close()

    def test_confirmed_ecg_remains_confirmed_and_is_reported_unsupported(self):
        cur = MagicMock()
        conn = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cur
        cur.fetchone.return_value = (3,)
        action = {**self.action, "soap_note_id": 91, "action_type": "DIAGNOSTIC_ORDER", "status": "CONFIRMED",
                  "confirmed_by": 8, "confirmed_at": "now", "transcript_fingerprint": dispatch._fingerprint("raw")}
        cur.fetchall.return_value = [action]
        signed_note = {**self.note, "status": "SIGNED", "author_user_id": 8, "signed_by": 8, "raw_transcript": "raw"}
        user = {"id": 8, "role": "Doctor"}
        with patch.object(dispatch.db_config, "get_db_connection", return_value=conn), \
             patch.object(dispatch, "_clinical_user", return_value=user), \
             patch.object(notes, "get_note", return_value=signed_note), \
             patch.object(notes, "validate_context"):
            result = dispatch.dispatch_confirmed_actions(91, {"user_id": 8})
        self.assertEqual(result["results"][0]["outcome"], "NOT_DISPATCHED")
        self.assertEqual(result["results"][0]["status"], "CONFIRMED")
        self.assertTrue(any("SET error_message" in call.args[0] for call in cur.execute.call_args_list))
        self.assertFalse(any("UPDATE soap_clinical_actions SET status='CREATED'" in call.args[0] for call in cur.execute.call_args_list))

    def test_pending_or_rejected_action_is_skipped_without_mutation(self):
        for status in ("PENDING_CONFIRMATION", "REJECTED"):
            with self.subTest(status=status):
                cur = MagicMock()
                conn = MagicMock()
                conn.cursor.return_value.__enter__.return_value = cur
                cur.fetchone.return_value = (3,)
                action = {**self.action, "soap_note_id": 91, "action_type": "LAB_ORDER", "status": status,
                          "confirmed_by": None, "confirmed_at": None, "transcript_fingerprint": dispatch._fingerprint("raw")}
                cur.fetchall.return_value = [action]
                signed_note = {**self.note, "status": "SIGNED", "author_user_id": 8, "signed_by": 8, "raw_transcript": "raw"}
                user = {"id": 8, "role": "Doctor"}
                with patch.object(dispatch.db_config, "get_db_connection", return_value=conn), \
                     patch.object(dispatch, "_clinical_user", return_value=user), \
                     patch.object(notes, "get_note", return_value=signed_note), \
                     patch.object(notes, "validate_context"):
                    result = dispatch.dispatch_confirmed_actions(91, {"user_id": 8})
                self.assertEqual(result["results"][0]["outcome"], "SKIPPED")
                self.assertFalse(any("INSERT INTO lab_orders" in call.args[0] for call in cur.execute.call_args_list))

    def test_soap_sign_commits_before_partial_dispatch_outcome(self):
        conn = MagicMock()
        note = {**self.note, "author_user_id": 8, "status": "DRAFT", "raw_transcript": "Order CBC.",
                "ai_draft": {}, "subjective": "", "objective": "", "assessment": "", "plan": ""}
        signed = {**note, "status": "SIGNED", "signed_by": 8, "signed_at": "now"}
        conn.cursor.return_value.__enter__.return_value.fetchone.return_value = signed
        user = {"id": 8, "role": "Doctor", "doctor_id": 3}
        dispatch_result = {"soap_note_id": 91, "success": False, "results": [{"outcome": "FAILED", "error": "Medication could not be resolved."}]}

        def after_commit(*args):
            self.assertTrue(conn.commit.called)
            return dispatch_result

        with patch.object(notes.db_config, "get_db_connection", return_value=conn), \
             patch.object(notes, "verified_user", return_value=user), \
             patch.object(notes, "get_note", return_value=note), \
             patch.object(notes, "validate_context"), \
             patch.object(notes, "compare_clinical_entities", return_value={"has_mismatch": False, "fingerprint": "abc"}), \
             patch.object(notes, "_record_mismatch_detection"), \
             patch.object(notes, "_unresolved_mismatch_detections", return_value=[]), \
             patch.object(notes, "require_clinical_review"), \
             patch.object(notes, "audit"), \
             patch("services.soap_action_dispatch_service.dispatch_confirmed_actions", side_effect=after_commit):
            result = notes.sign_note(91, {"user_id": 8})
        self.assertEqual(result["status"], "SIGNED")
        self.assertEqual(result["action_dispatch"], dispatch_result)

    def test_sign_retry_invokes_idempotent_dispatch_after_existing_signature(self):
        conn = MagicMock()
        signed = {**self.note, "status": "SIGNED", "author_user_id": 8, "signed_by": 8, "signed_at": "now"}
        user = {"id": 8, "role": "Doctor", "doctor_id": 3}
        dispatch_result = {"soap_note_id": 91, "success": True, "results": []}
        with patch.object(notes.db_config, "get_db_connection", return_value=conn), \
             patch.object(notes, "verified_user", return_value=user), \
             patch.object(notes, "get_note", return_value=signed), \
             patch("services.soap_action_dispatch_service.dispatch_confirmed_actions", return_value=dispatch_result) as dispatch_call:
            result = notes.sign_note(91, {"user_id": 8})
        self.assertEqual(result["status"], "SIGNED")
        self.assertEqual(result["action_dispatch"], dispatch_result)
        dispatch_call.assert_called_once()
        self.assertTrue(conn.commit.called)

    def test_dispatch_migration_has_provenance_idempotency_and_action_events(self):
        migration = (os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "migrations", "032_ag17_medication_lab_dispatch.sql"))
        with open(migration, encoding="utf-8") as handle:
            sql = handle.read()
        for value in ("source_action_id", "uq_prescriptions_source_action", "uq_lab_orders_source_action",
                      "DISPATCH_STARTED", "CREATED", "DISPATCH_FAILED", "RETRY_SUCCEEDED"):
            self.assertIn(value, sql)


if __name__ == "__main__":
    unittest.main()
