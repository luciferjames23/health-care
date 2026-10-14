"""
test_intelligent_spelling_semantic.py
======================================
Comprehensive automated verification suite for Intelligent Spelling Correction,
Medical Semantic Understanding & Intent Routing across Meridian Hospital AI Patient Desk.
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import agent.message_normalizer as message_normalizer
import agent.llm_intent_router as llm_intent_router
import agent.intent_router as intent_router
import agent.entity_extractor as entity_extractor
import agent.grounding_validator as grounding_validator
import agent.agent_service as agent_service


class TestSpellingAndIntentUnderstanding(unittest.TestCase):
    """Verifies phonetic, edit-distance, and character repetition typo tolerance."""

    def test_01_fevereee_to_fever_and_gen_med(self):
        msg = "fevereee"
        interp = message_normalizer.normalize_patient_message(msg)
        self.assertEqual(interp.symptoms, ["fever"])
        self.assertEqual(interp.department, "General Medicine")
        self.assertEqual(interp.suggested_intent, "BOOK_APPOINTMENT")

        # Fallback router verification
        res = llm_intent_router.route_patient_message_llm(msg)
        self.assertEqual(res["intent"], "BOOK_APPOINTMENT")
        self.assertEqual(res["department"], "General Medicine")
        self.assertIn("fever", res["symptoms"])

    def test_02_hedache_to_headache_and_gen_med(self):
        msg = "hedache"
        interp = message_normalizer.normalize_patient_message(msg)
        self.assertEqual(interp.symptoms, ["headache"])
        self.assertEqual(interp.department, "General Medicine")
        self.assertEqual(interp.suggested_intent, "BOOK_APPOINTMENT")

        res = llm_intent_router.route_patient_message_llm(msg)
        self.assertEqual(res["intent"], "BOOK_APPOINTMENT")
        self.assertEqual(res["department"], "General Medicine")
        self.assertIn("headache", res["symptoms"])

    def test_03_hairfal_to_hair_fall_and_dermatology(self):
        msg = "hairfal"
        interp = message_normalizer.normalize_patient_message(msg)
        self.assertEqual(interp.symptoms, ["hair fall"])
        self.assertEqual(interp.department, "Dermatology")
        self.assertEqual(interp.suggested_intent, "BOOK_APPOINTMENT")

        res = llm_intent_router.route_patient_message_llm(msg)
        self.assertEqual(res["intent"], "BOOK_APPOINTMENT")
        self.assertEqual(res["department"], "Dermatology")
        self.assertIn("hair fall", res["symptoms"])

    def test_04_my_appointmnets_to_appointment_status(self):
        msg = "my appointmnets"
        interp = message_normalizer.normalize_patient_message(msg)
        self.assertEqual(interp.suggested_intent, "APPOINTMENT_STATUS")

        res = llm_intent_router.route_patient_message_llm(msg)
        self.assertEqual(res["intent"], "APPOINTMENT_STATUS")
        self.assertEqual(res.get("appointment_subject"), "SELF")

    def test_05_cancle_my_appoinment_to_cancel_appointment(self):
        msg = "cancle my appoinment"
        interp = message_normalizer.normalize_patient_message(msg)
        self.assertEqual(interp.suggested_intent, "CANCEL_APPOINTMENT")

        # Crucial check: must NOT be BOOK_APPOINTMENT!
        res = llm_intent_router.route_patient_message_llm(msg)
        self.assertEqual(res["intent"], "CANCEL_APPOINTMENT")

    def test_06_show_my_repots_to_patient_reports(self):
        msg = "show my repots"
        interp = message_normalizer.normalize_patient_message(msg)
        self.assertEqual(interp.suggested_intent, "PATIENT_REPORTS")

        res = llm_intent_router.route_patient_message_llm(msg)
        self.assertEqual(res["intent"], "PATIENT_REPORTS")

    def test_07_preserve_reported_duration_and_facts(self):
        msg = "I have fevereee from yestarday"
        interp = message_normalizer.normalize_patient_message(msg)
        self.assertEqual(interp.symptoms, ["fever"])
        self.assertEqual(interp.duration, "from yesterday")
        self.assertEqual(interp.department, "General Medicine")
        # Ensure no temperatures or diagnoses are fabricated
        self.assertNotIn("39", interp.normalized_message)
        self.assertNotIn("severe", interp.normalized_message)

    def test_08_grounding_validator_accepts_normalized_symptoms(self):
        msg = "hedache"
        extracted = {
            "intent": "BOOK_APPOINTMENT",
            "medical_reason": "headache",
            "reason_raw_quote": "hedache",
            "department": "General Medicine",
            "doctor_name": None,
            "appointment_date": None,
            "appointment_time": None,
        }
        res = grounding_validator.validate_extraction(msg, {}, extracted)
        self.assertEqual(res["cleaned"]["medical_reason"], "headache")
        self.assertNotIn("medical_reason", res["rejected_fields"])


class TestContextAndStateManagement(unittest.TestCase):
    """Verifies context switching, follow-up answering, and stale state protection."""

    def test_09_stale_doctor_selection_cleared_by_new_symptom(self):
        # User previously selected Dr. Wilson M in ENT
        state = {
            "conversation_code": "WA_919876543210_test",
            "intent": "DOCTOR_AVAILABILITY",
            "department_name": "ENT",
            "selected_doctor_name": "Dr. Wilson M",
            "selected_doctor_id": 12,
            "entities": {"doctor_id": 12, "reason": "earache"}
        }
        # Now user enters a new complaint in a different department
        msg = "hairfal"
        res = llm_intent_router.route_patient_message_llm(msg, current_state=state)
        self.assertEqual(res["intent"], "BOOK_APPOINTMENT")
        self.assertEqual(res["department"], "Dermatology")
        # Doctor preference must NOT be Wilson
        self.assertIsNone(res.get("doctor_name"))

    def test_10_topic_switching_interrupts_availability_workflow(self):
        state = {
            "conversation_code": "WA_919876543210_test",
            "intent": "DOCTOR_AVAILABILITY",
            "department_name": "General Medicine",
            "booking_stage": "DOCTOR_SELECTION_REQUIRED"
        }
        msg = "cancle my appoinment"
        res = llm_intent_router.route_patient_message_llm(msg, current_state=state)
        self.assertEqual(res["intent"], "CANCEL_APPOINTMENT")


class TestMultilingualAndRegionalLanguages(unittest.TestCase):
    """Verifies semantic symptom extraction across all 7 supported regional languages."""

    def test_11_tamil_symptoms(self):
        interp = message_normalizer.normalize_patient_message("எனக்கு காய்ச்சல் உள்ளது")
        self.assertEqual(interp.detected_language, "TAMIL")
        self.assertEqual(interp.department, "General Medicine")
        self.assertEqual(interp.suggested_intent, "BOOK_APPOINTMENT")

        interp2 = message_normalizer.normalize_patient_message("முடி கொட்டுதல் பிரச்சனை")
        self.assertEqual(interp2.detected_language, "TAMIL")
        self.assertEqual(interp2.department, "Dermatology")

    def test_12_hindi_symptoms(self):
        interp = message_normalizer.normalize_patient_message("मुझे बुखार है")
        self.assertEqual(interp.detected_language, "HINDI")
        self.assertEqual(interp.department, "General Medicine")

        interp2 = message_normalizer.normalize_patient_message("बाल झड़ रहे हैं")
        self.assertEqual(interp2.detected_language, "HINDI")
        self.assertEqual(interp2.department, "Dermatology")

    def test_13_telugu_symptoms(self):
        interp = message_normalizer.normalize_patient_message("నాకు జ్వరం ఉంది")
        self.assertEqual(interp.detected_language, "TELUGU")
        self.assertEqual(interp.department, "General Medicine")

        interp2 = message_normalizer.normalize_patient_message("జుట్టు రాలడం ఉంది")
        self.assertEqual(interp2.detected_language, "TELUGU")
        self.assertEqual(interp2.department, "Dermatology")

    def test_14_malayalam_symptoms(self):
        interp = message_normalizer.normalize_patient_message("എനിക്ക് പനിയാണ്")
        self.assertEqual(interp.detected_language, "MALAYALAM")
        self.assertEqual(interp.department, "General Medicine")

        interp2 = message_normalizer.normalize_patient_message("മുടി കൊഴിച്ചിൽ")
        self.assertEqual(interp2.detected_language, "MALAYALAM")
        self.assertEqual(interp2.department, "Dermatology")

    def test_15_kannada_symptoms(self):
        interp = message_normalizer.normalize_patient_message("ನನಗೆ ಜ್ವರ ಬಂದಿದೆ")
        self.assertEqual(interp.detected_language, "KANNADA")
        self.assertEqual(interp.department, "General Medicine")

        interp2 = message_normalizer.normalize_patient_message("ಕೂದಲು ಉದುರುವಿಕೆ")
        self.assertEqual(interp2.detected_language, "KANNADA")
        self.assertEqual(interp2.department, "Dermatology")

    def test_16_urdu_symptoms(self):
        interp = message_normalizer.normalize_patient_message("مجھے بخار ہے")
        self.assertEqual(interp.detected_language, "URDU")
        self.assertEqual(interp.department, "General Medicine")

        interp2 = message_normalizer.normalize_patient_message("بال گر رہے ہیں")
        self.assertEqual(interp2.detected_language, "URDU")
        self.assertEqual(interp2.department, "Dermatology")


class TestMedicalSafetyAndEmergency(unittest.TestCase):
    """Verifies that emergencies are safely routed and clinical facts are unchanged."""

    def test_17_urgent_emergency_symptoms(self):
        msg = "I have severe chest pain and cannot breathe"
        res = llm_intent_router.route_patient_message_llm(msg)
        self.assertTrue(res.get("emergency") or res.get("intent") == "EMERGENCY")

    def test_18_no_hallucination_or_record_alteration(self):
        raw = "hedache from yestarday"
        interp = message_normalizer.normalize_patient_message(raw)
        self.assertEqual(interp.raw_message, raw)
        self.assertEqual(interp.normalized_message, "headache from yesterday")
        self.assertEqual(interp.symptoms, ["headache"])
        self.assertEqual(interp.duration, "from yesterday")


if __name__ == "__main__":
    unittest.main()
