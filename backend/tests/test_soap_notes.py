import os
import sys
import tempfile
import unittest
import wave
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import HTTPException
from routers.soap_notes import is_silent_pcm_wav
from services import soap_note_service as notes
from services.soap_clinical_validation import compare_clinical_entities, require_clinical_review
from services.soap_generation_service import SoapDraft


class SoapContextTests(unittest.TestCase):
    def test_patient_visit_mismatch_rejected(self):
        cur = MagicMock()
        cur.fetchone.return_value = (19,)
        with self.assertRaises(HTTPException) as caught:
            notes.validate_context(cur, 20, 700)
        self.assertEqual(caught.exception.status_code, 400)

    def test_admission_must_match_patient_and_visit(self):
        cur = MagicMock()
        cur.fetchone.side_effect = [(20,), (20, 701)]
        with self.assertRaises(HTTPException) as caught:
            notes.validate_context(cur, 20, 700, 90)
        self.assertEqual(caught.exception.status_code, 400)

    def test_patient_only_note_rejected(self):
        cur = MagicMock()
        with self.assertRaises(HTTPException) as caught:
            notes.validate_context(cur, 20, None)
        self.assertEqual(caught.exception.status_code, 400)

    def test_dev_fallback_cannot_sign(self):
        with self.assertRaises(HTTPException) as caught:
            notes.verified_user(MagicMock(), {"user_id": 1, "username": "admin", "role": "ADMIN", "auth_method": "development-fallback"}, signing=True)
        self.assertEqual(caught.exception.status_code, 401)


class SoapDraftSchemaTests(unittest.TestCase):
    def test_unsupported_assessment_can_remain_empty(self):
        parsed = SoapDraft.model_validate({"subjective": "Chest pain", "objective": "BP 140/90", "assessment": "", "plan": "Aspirin 75 mg"})
        self.assertEqual(parsed.assessment, "")

    def test_unstructured_or_extra_model_fields_are_rejected(self):
        with self.assertRaises(Exception):
            SoapDraft.model_validate({"subjective": "x", "objective": "", "assessment": "", "plan": "", "diagnosis": "I20"})


class SoapClinicalValidationTests(unittest.TestCase):
    def _compare(self, transcript, ai_text, final_text):
        return compare_clinical_entities(
            transcript,
            {"plan": ai_text},
            {"plan": final_text},
        )

    def test_atorvastatin_to_acetaminophen_is_mismatch(self):
        result = self._compare("Start atorvastatin 40 mg.", "Start acetaminophen 40 mg.", "Start acetaminophen 40 mg.")
        self.assertTrue(result["final_has_mismatch"])
        self.assertIn("atorvastatin", str(result["mismatches"]))
        self.assertIn("acetaminophen", str(result["mismatches"]))

    def test_dose_mismatch_is_blocking(self):
        result = self._compare("Start atorvastatin 40 mg.", "Start atorvastatin 40 mg.", "Start atorvastatin 20 mg.")
        self.assertTrue(result["final_has_mismatch"])
        with self.assertRaises(HTTPException) as caught:
            require_clinical_review(result)
        self.assertEqual(caught.exception.status_code, 409)

    def test_unit_mismatch_is_blocking(self):
        result = self._compare("Start atorvastatin 40 mg.", "Start atorvastatin 40 mg.", "Start atorvastatin 40 mcg.")
        self.assertTrue(result["final_has_mismatch"])
        self.assertIn("40 mcg", str(result["mismatches"]))

    def test_vital_mismatch_is_blocking(self):
        result = self._compare("Blood pressure 120/80 mmHg.", "Blood pressure 120/80 mmHg.", "Blood pressure 140/90 mmHg.")
        self.assertTrue(result["final_has_mismatch"])
        self.assertIn("blood_pressure 120/80 mmhg", str(result["mismatches"]))

    def test_exact_sensitive_entity_match_has_no_mismatch(self):
        source = "Atorvastatin 40 mg daily for 5 days. BP 120/80 mmHg. ECG shows T-wave inversion."
        result = self._compare(source, source, source)
        self.assertFalse(result["has_mismatch"])
        self.assertFalse(result["final_has_mismatch"])

    def test_spoken_four_vitals_match_normalized_objective_units(self):
        transcript = (
            "Patient has fever for two days. Temperature is 101 degrees Fahrenheit. "
            "Blood pressure is 130 over 80. Pulse is 96 per minute. "
            "Oxygen saturation is 98 percent."
        )
        objective = "Temperature 101\u00b0F. BP 130/80 mmHg. Pulse 96 bpm. SpO2 98%."
        complete_record = {"subjective": "Patient has fever for 2 days.", "objective": objective}
        result = compare_clinical_entities(transcript, complete_record, complete_record)
        self.assertFalse(result["has_mismatch"], result["mismatches"])
        self.assertFalse(result["final_has_mismatch"], result["mismatches"])

    def test_equivalent_dose_units_duration_words_and_spoken_blood_pressure_match(self):
        transcript = "Take aspirin 40 milligrams for three days. Blood pressure is 140 over 90."
        final = "Take aspirin 40 mg for 3 days. BP 140/90 mmHg."
        result = self._compare(transcript, transcript, final)
        self.assertFalse(result["final_has_mismatch"], result["mismatches"])

    def test_clinical_formatting_and_follow_up_differences_do_not_block(self):
        cases = [
            ("Aspirin 75 milligrams", "Aspirin 75 mg"),
            ("Atorvastatin 40 milligrams", "Atorvastatin 40 mg"),
            ("Aspirin seventy five milligrams", "Aspirin 75 mg"),
            ("Atorvastatin forty milligrams", "Atorvastatin 40 mg"),
            ("BP 140 over 90", "BP 140/90"),
            ("BP one hundred forty over ninety", "BP 140/90"),
            ("ECG shows T-wave inversion", "ECG shows T wave inversion"),
            ("chest pain for 3 days", "chest pain for 3 days. Review after 7 days."),
        ]
        for transcript, final in cases:
            with self.subTest(transcript=transcript):
                result = self._compare(transcript, transcript, final)
                self.assertFalse(result["final_has_mismatch"], result["mismatches"])

    def test_structured_medication_dose_and_vital_mismatches_block(self):
        cases = [
            ("Atorvastatin 40 mg", "Acetaminophen 40 mg"),
            ("Aspirin 75 mg", "Aspirin 150 mg"),
            ("BP 140/90", "BP 180/110"),
            ("Aspirin 75 mg", ""),
            ("Aspirin 75 mg", "Aspirin"),
            ("Aspirin 75 mg", "Aspirin 75 mg and atorvastatin 40 mg"),
        ]
        for transcript, final in cases:
            with self.subTest(transcript=transcript, final=final):
                result = self._compare(transcript, transcript, final)
                self.assertTrue(result["final_has_mismatch"], result["mismatches"])

    def test_duration_and_test_finding_changes_are_detected(self):
        transcript = "Take atorvastatin 40 mg for 5 days. ECG shows T-wave inversion."
        result = self._compare(transcript, transcript, "Take atorvastatin 40 mg for 7 days. ECG shows ST elevation.")
        self.assertIn("duration", [item["entity_type"] for item in result["mismatches"]])
        self.assertIn("test_finding", [item["entity_type"] for item in result["mismatches"]])

    def test_unpunctuated_ecg_clause_does_not_absorb_medication_text(self):
        transcript = "ECG shows T wave inversion start aspirin 75 mg and atorvastatine in 40 mg"
        ai_draft = {"plan": "ECG shows T wave inversion; start aspirin 75 mg and atrovestate in 40 mg"}
        result = compare_clinical_entities(transcript, ai_draft, {"objective": "ECG shows T wave inversion; start aspirin 75 mg and atorvastatine in 40 mg"})
        ai_differences = [item for item in result["mismatches"] if item["document"] == "ai_draft"]
        self.assertEqual([item["entity_type"] for item in ai_differences], ["medication"])
        self.assertFalse(any(item["entity_type"] == "test_finding" for item in result["mismatches"]))

    def test_clinician_correction_and_resolution_allows_sign(self):
        transcript = "Start atorvastatin 40 mg."
        ai_draft = {"plan": "Start acetaminophen 40 mg."}
        wrong_final = {"plan": "Start acetaminophen 40 mg."}
        detected = compare_clinical_entities(transcript, ai_draft, wrong_final)
        with self.assertRaises(HTTPException):
            require_clinical_review(detected)

        corrected_final = {"plan": "Start atorvastatin 40 mg."}
        corrected = compare_clinical_entities(transcript, ai_draft, corrected_final)
        self.assertTrue(corrected["has_mismatch"])  # AI draft remains flagged for explicit review.
        self.assertFalse(corrected["final_has_mismatch"])
        self.assertTrue(corrected["can_resolve"])
        with self.assertRaises(HTTPException):
            require_clinical_review(corrected)
        require_clinical_review(corrected, corrected["fingerprint"])

        note = {
            "soap_note_id": 71, "patient_id": 20, "visit_id": 700, "admission_id": None,
            "author_user_id": 7, "status": "DRAFT", "raw_transcript": transcript,
            "ai_draft": ai_draft, "subjective": "", "objective": "", "assessment": "",
            "plan": corrected_final["plan"],
        }
        signed = {**note, "status": "SIGNED", "signed_at": "now", "signed_by": 7}
        conn = MagicMock()
        conn.cursor.return_value.__enter__.return_value.fetchone.return_value = signed
        user = {"id": 7, "name": "Clinician", "role": "Doctor"}
        with patch.object(notes.db_config, "get_db_connection", return_value=conn), \
             patch.object(notes, "verified_user", return_value=user), \
             patch.object(notes, "get_note", return_value=note), \
             patch.object(notes, "validate_context"), \
             patch.object(notes, "_record_mismatch_detection"), \
             patch.object(notes, "_unresolved_mismatch_detections", return_value=[]), \
             patch.object(notes, "audit"):
            result = notes.sign_note(71, {"user_id": 7})
        self.assertEqual(result["status"], "SIGNED")

        conn = MagicMock()
        pending_note = {**note, "plan": corrected_final["plan"]}
        with patch.object(notes.db_config, "get_db_connection", return_value=conn), \
             patch.object(notes, "verified_user", return_value=user), \
             patch.object(notes, "get_note", return_value=pending_note), \
             patch.object(notes, "validate_context"), \
             patch.object(notes, "_record_mismatch_detection"), \
             patch.object(notes, "_unresolved_mismatch_detections", return_value=[{"id": 9, "metadata": {}}]), \
             patch.object(notes, "audit"):
            with self.assertRaises(HTTPException) as caught:
                notes.sign_note(71, {"user_id": 7})
        self.assertEqual(caught.exception.status_code, 409)
        self.assertEqual(conn.cursor.return_value.__enter__.return_value.execute.call_count, 0)


class SilentAudioTests(unittest.TestCase):
    def _wav_file(self, samples):
        temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp.close()
        with wave.open(temp.name, "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(16000)
            audio.writeframes(samples)
        self.addCleanup(os.unlink, temp.name)
        return temp.name

    def test_silent_pcm16_wav_is_rejected(self):
        self.assertTrue(is_silent_pcm_wav(self._wav_file(b"\0\0" * 1600)))

    def test_audible_pcm16_wav_is_not_marked_silent(self):
        self.assertFalse(is_silent_pcm_wav(self._wav_file(b"\x10\x27" * 1600)))


if __name__ == "__main__":
    unittest.main()
