import unittest
import os
import sys
import json
import datetime
from unittest.mock import MagicMock, patch

# Ensure backend root is on Python path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config
from agent.feedback_agent import (
    analyze_patient_feedback,
    check_emergency_feedback,
    extract_rating_from_text,
    store_patient_feedback,
    FEEDBACK_CATEGORIES
)
from agent.language_service import get_main_menu_buttons, translate_response
from agent.intent_detector import detect_intent
from agent.agent_service import handle_feedback_workflow
from services.post_discharge_feedback_scheduler import check_and_trigger_post_discharge_feedback
from api.feedback_routes import get_feedback_summary, get_feedback_list, update_feedback_status, FeedbackStatusUpdate


class TestFeedbackAgentUnit(unittest.TestCase):
    """Unit tests for AI Feedback Agent (AG-05) semantic understanding, ratings, typos, & multilingual analysis."""

    def test_01_positive_feedback_analysis(self):
        text = "The doctor was excellent and the nurses were very helpful."
        res = analyze_patient_feedback(text, language="ENGLISH")
        self.assertIn(res["sentiment"], ["POSITIVE", "MIXED"])
        self.assertTrue(any("Doctor" in c or "Nursing" in c for c in res["categories"]))
        self.assertFalse(res["requires_action"])

    def test_02_negative_feedback_analysis(self):
        text = "The billing process took three hours."
        res = analyze_patient_feedback(text, language="ENGLISH")
        self.assertEqual(res["sentiment"], "NEGATIVE")
        self.assertTrue(any("Billing" in c for c in res["categories"]))
        self.assertTrue(res["requires_action"])

    def test_03_neutral_feedback_analysis(self):
        text = "The hospital has many departments."
        res = analyze_patient_feedback(text, language="ENGLISH")
        self.assertIn(res["sentiment"], ["NEUTRAL", "MIXED"])

    def test_04_mixed_feedback_analysis(self):
        text = "The doctor was excellent but the waiting time was very long."
        res = analyze_patient_feedback(text, language="ENGLISH")
        self.assertIn(res["sentiment"], ["MIXED", "NEGATIVE"])
        self.assertTrue(len(res["categories"]) >= 2)

    def test_05_multiple_issues_analysis(self):
        text = "The food was cold and billing took too long."
        res = analyze_patient_feedback(text, language="ENGLISH")
        self.assertEqual(res["sentiment"], "NEGATIVE")
        self.assertTrue(any("Food" in c or "Dining" in c for c in res["categories"]))
        self.assertTrue(any("Billing" in c for c in res["categories"]))
        self.assertTrue(res["requires_action"])

    def test_06_multilingual_analysis(self):
        langs = {
            "TAMIL": "மருத்துவர் மிகவும் நன்றாக இருந்தார் மற்றும் செவிலியர் நல்ல உதவி செய்தார்கள்",
            "HINDI": "डॉक्टर बहुत अच्छे थे लेकिन बिलिंग में बहुत देरी हुई",
            "TELUGU": "వైద్యుడు చాలా మంచివాడు కానీ వేచి ఉండే సమయం ఎక్కువ",
            "MALAYALAM": "ഡോക്ടർ വളരെ നല്ലവനായിരുന്നു",
            "KANNADA": "ವೈದ್ಯರು ತುಂಬಾ ಒಳ್ಳೆಯವರು",
            "URDU": "ڈاکٹر بہت اچھے تھے"
        }
        for lang, text in langs.items():
            res = analyze_patient_feedback(text, language=lang)
            self.assertIn(res["sentiment"], ["POSITIVE", "NEGATIVE", "MIXED", "NEUTRAL"], f"Failed for {lang}")
            self.assertTrue(len(res["categories"]) > 0)

    def test_07_mixed_language_tanglish(self):
        text = "The doctor was very good, but billing romba late."
        res = analyze_patient_feedback(text, language="TAMIL")
        self.assertIn(res["sentiment"], ["MIXED", "NEGATIVE"])
        self.assertTrue(any("Billing" in c for c in res["categories"]))

    def test_08_typo_resilience(self):
        typo_cases = [
            ("billing took toooo long", "Billing"),
            ("doctor was exellent", "Doctor / Clinical Care"),
            ("food was coldd", "Food / Dining"),
            ("nursess were very helpfull", "Nursing")
        ]
        for text, expected_cat in typo_cases:
            res = analyze_patient_feedback(text, language="ENGLISH")
            self.assertTrue(any(expected_cat.lower() in c.lower() for c in res["categories"]), f"Failed typo for '{text}'")

    def test_09_rating_extraction(self):
        self.assertEqual(extract_rating_from_text("I would give the hospital 8 out of 10."), 8)
        self.assertEqual(extract_rating_from_text("8/10"), 8)
        self.assertEqual(extract_rating_from_text("Score is 10"), 10)
        self.assertEqual(extract_rating_from_text("Rating 5"), 5)
        self.assertIsNone(extract_rating_from_text("Great doctor and fast service."))

    def test_10_critical_safety_emergency_override(self):
        text = "I am having severe chest pain after discharge."
        is_emerg = check_emergency_feedback(text)
        self.assertTrue(is_emerg)
        
        res = analyze_patient_feedback(text, language="ENGLISH")
        self.assertTrue(res["is_emergency"])
        self.assertEqual(res["severity"], "CRITICAL")
        self.assertTrue(res["requires_action"])


class TestFeedbackDatabaseAndIntegrations(unittest.TestCase):
    """Integration & Database persistence tests for AG-05 Feedback Agent."""

    def test_11_original_feedback_preservation(self):
        original_text = "The doctor was excellent but billing took three hours."
        res = analyze_patient_feedback(original_text, language="ENGLISH")
        record = store_patient_feedback(
            conversation_code="conv_unittest_01",
            original_feedback=original_text,
            explicit_rating=6,
            source="WHATSAPP_TEXT",
            patient_id=87328,
            analysis_override=res
        )
        self.assertTrue(record.get("success"))
        
        # Verify in database
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT original_feedback, ai_summary FROM patient_feedback WHERE id = %s", (record["feedback_id"],))
        row = cur.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], original_text)
        self.assertIsNotNone(row[1])  # Separate AI summary stored

    def test_12_positive_feedback_no_unnecessary_grievance(self):
        original_text = "The nurses were amazingly kind and attentive."
        res = analyze_patient_feedback(original_text, language="ENGLISH")
        record = store_patient_feedback(
            conversation_code="conv_unittest_pos",
            original_feedback=original_text,
            explicit_rating=10,
            source="WHATSAPP_TEXT",
            patient_id=87328,
            analysis_override=res
        )
        self.assertTrue(record.get("success"))
        self.assertIsNone(record.get("escalation_id"))

    def test_13_negative_feedback_creates_grievance_ticket(self):
        original_text = "Billing process took over 3 hours and staff were unhelpful."
        res = analyze_patient_feedback(original_text, language="ENGLISH")
        record = store_patient_feedback(
            conversation_code="conv_unittest_neg",
            original_feedback=original_text,
            explicit_rating=2,
            source="WHATSAPP_TEXT",
            patient_id=87328,
            analysis_override=res
        )
        self.assertTrue(record.get("success"))
        self.assertIsNotNone(record.get("escalation_id"))

    def test_14_patient_identity_linking_and_multiple_profiles(self):
        # Profile 1 (John Peter - 87327)
        rec1 = store_patient_feedback(
            conversation_code="conv_unittest_p1",
            original_feedback="Good consultation.",
            explicit_rating=9,
            source="WHATSAPP_TEXT",
            patient_id=87327
        )
        self.assertEqual(rec1.get("patient_id"), 87327)

        # Profile 2 (Jack Daniels - 87328)
        rec2 = store_patient_feedback(
            conversation_code="conv_unittest_p2",
            original_feedback="Clean rooms.",
            explicit_rating=8,
            source="WHATSAPP_TEXT",
            patient_id=87328
        )
        self.assertEqual(rec2.get("patient_id"), 87328)

    def test_15_duplicate_message_idempotency(self):
        msg_id = f"wamid_test_dup_{int(datetime.datetime.now().timestamp())}"
        rec1 = store_patient_feedback(
            conversation_code="conv_unittest_dup",
            original_feedback="Identical feedback text.",
            explicit_rating=7,
            source="WHATSAPP_TEXT",
            whatsapp_message_id=msg_id,
            patient_id=87328
        )
        self.assertFalse(rec1.get("duplicate"))

        # Second submission with exact same message ID
        rec2 = store_patient_feedback(
            conversation_code="conv_unittest_dup",
            original_feedback="Identical feedback text.",
            explicit_rating=7,
            source="WHATSAPP_TEXT",
            whatsapp_message_id=msg_id,
            patient_id=87328
        )
        self.assertTrue(rec2.get("duplicate"))
        self.assertEqual(rec1["feedback_id"], rec2["feedback_id"])


class TestAdminApiAndScheduler(unittest.TestCase):
    """Tests for Admin Portal Feedback APIs & Automated Post-Discharge Scheduler."""

    def test_16_admin_feedback_summary_api(self):
        res = get_feedback_summary()
        self.assertTrue(res.get("success"))
        self.assertIn("summary", res)
        summary = res["summary"]
        self.assertIn("total_feedback", summary)
        self.assertIn("positive_count", summary)
        self.assertIn("negative_count", summary)

    def test_17_admin_feedback_list_and_filters_api(self):
        # Fetch list without filter
        res = get_feedback_list(limit=10, offset=0)
        self.assertTrue(res.get("success"))
        self.assertIn("data", res)

        # Fetch with sentiment filter
        res_neg = get_feedback_list(sentiment="NEGATIVE", limit=10, offset=0)
        self.assertTrue(res_neg.get("success"))
        for item in res_neg.get("data", []):
            self.assertEqual(item["sentiment"], "NEGATIVE")

    def test_18_admin_feedback_status_transition_api(self):
        # Insert a fresh test feedback
        rec = store_patient_feedback(
            conversation_code="conv_status_test",
            original_feedback="Status transition test complaint.",
            explicit_rating=3,
            source="WHATSAPP_TEXT",
            patient_id=87328
        )
        f_id = rec["feedback_id"]

        mock_user = {"user_id": 32, "username": "doctor_32", "role": "Admin"}

        # Transition OPEN -> IN_PROGRESS
        res1 = update_feedback_status(f_id, FeedbackStatusUpdate(status="IN_PROGRESS", resolution_notes="Contacted patient."), user=mock_user)
        self.assertTrue(res1.get("success"))
        self.assertEqual(res1.get("status"), "IN_PROGRESS")

        # Transition IN_PROGRESS -> RESOLVED
        res2 = update_feedback_status(f_id, FeedbackStatusUpdate(status="RESOLVED", resolution_notes="Billing difference refunded."), user=mock_user)
        self.assertTrue(res2.get("success"))
        self.assertEqual(res2.get("status"), "RESOLVED")

    def test_19_post_discharge_scheduler_runner(self):
        res = check_and_trigger_post_discharge_feedback()
        self.assertTrue(res.get("success"))
        self.assertIn("triggered_count", res)


class TestRegressionWorkflows(unittest.TestCase):
    """Regression tests verifying zero breakdown across existing Patient Desk features."""

    def test_20_main_menu_buttons_preserve_existing_actions(self):
        btns = get_main_menu_buttons("ENGLISH")
        btn_ids = [b["id"] for b in btns]
        self.assertIn("btn_cat_appts", btn_ids)
        self.assertIn("btn_cat_doctors", btn_ids)
        self.assertIn("btn_cat_inquiries", btn_ids)
        self.assertIn("btn_cat_health", btn_ids)
        self.assertIn("btn_cat_billing", btn_ids)
        self.assertIn("btn_cat_feedback", btn_ids)
        self.assertIn("btn_cat_emergency", btn_ids)

    def test_21_intent_detector_preserves_existing_intents(self):
        self.assertEqual(detect_intent("book appointment"), "BOOK_APPOINTMENT")
        self.assertEqual(detect_intent("doctor availability"), "DOCTOR_AVAILABILITY")
        self.assertEqual(detect_intent("emergency help"), "EMERGENCY_GUIDANCE")
        self.assertEqual(detect_intent("give feedback about my hospital stay"), "FEEDBACK")


if __name__ == '__main__':
    unittest.main()
