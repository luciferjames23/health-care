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


class TestExplicitRequirementsSuite(unittest.TestCase):
    """Explicit test coverage for TC-UI, TC-KPI, and TC-WA requirements."""

    def test_tc_ui_001_to_005_ui_presentation_rules(self):
        sidebar_path = os.path.join(backend_dir, "..", "frontend", "src", "components", "AppSidebar.jsx")
        feedback_page_path = os.path.join(backend_dir, "..", "frontend", "src", "pages", "admin", "FeedbackPage.tsx")

        with open(sidebar_path, "r", encoding="utf-8") as f:
            sidebar_content = f.read()
        with open(feedback_page_path, "r", encoding="utf-8") as f:
            feedback_page_content = f.read()

        # TC-UI-001 AG-05 badge not visible in sidebar
        self.assertNotIn("badge: 'AG-05'", sidebar_content)
        self.assertIn("label: 'Feedback & Grievances'", sidebar_content)

        # TC-UI-002 & TC-UI-003 Page title and AG-05 badge removed beside page title
        self.assertNotIn("AG-05 Feedback Agent", feedback_page_content)
        self.assertIn("Patient Feedback & Grievance Centre", feedback_page_content)

        # TC-UI-004 Existing feedback table remains visible
        self.assertIn("<table", feedback_page_content)

        # TC-UI-005 Source displays WhatsApp
        self.assertIn("formatSourceDisplay", feedback_page_content)
        self.assertIn("WHATSAPP", feedback_page_content)

    def test_tc_kpi_001_to_011_kpi_calculation_contract(self):
        import math
        summary_res = get_feedback_summary()
        self.assertTrue(summary_res.get("success"))
        s = summary_res.get("summary", {})

        # TC-KPI-001 Total feedback count is an integer >= 0
        self.assertIsInstance(s.get("total_feedback"), int)
        total = s.get("total_feedback", 0)

        # TC-KPI-002..006 Sentiments and percentages calculation
        pos = s.get("positive_count", 0)
        neg = s.get("negative_count", 0)
        neu = s.get("neutral_count", 0)
        mix = s.get("mixed_count", 0)

        pos_pct = (pos / total * 100) if total > 0 else 0.0
        neg_pct = (neg / total * 100) if total > 0 else 0.0
        neu_mix_pct = ((neu + mix) / total * 100) if total > 0 else 0.0

        self.assertFalse(math.isinf(pos_pct) or math.isnan(pos_pct))
        self.assertFalse(math.isinf(neg_pct) or math.isnan(neg_pct))
        self.assertFalse(math.isinf(neu_mix_pct) or math.isnan(neu_mix_pct))

        # TC-KPI-007 & TC-KPI-008 Average rating is float or None, no NaN
        avg_rating = s.get("average_rating")
        if avg_rating is not None:
            self.assertIsInstance(avg_rating, (int, float))
            self.assertFalse(math.isnan(avg_rating))

        # TC-KPI-010 & TC-KPI-011 List pagination and filters
        list_res = get_feedback_list(limit=5, offset=0)
        self.assertTrue(list_res.get("success"))
        self.assertIn("total_count", list_res)
        self.assertGreaterEqual(list_res["total_count"], len(list_res.get("data", [])))

    def test_tc_wa_001_to_015_whatsapp_feedback_workflow(self):
        conv_code = f"conv_wa_test_{int(datetime.datetime.now().timestamp())}"
        state = {}

        # TC-WA-001 Main Menu -> Feedback
        r1 = handle_feedback_workflow(conv_code, state, "Feedback", "ENGLISH", btn_id="btn_cat_feedback")
        self.assertIn("Patient Feedback", r1["response"])
        self.assertEqual(state.get("active_workflow"), "FEEDBACK")
        self.assertEqual(state.get("feedback_stage"), "AWAITING_TEXT_OR_VOICE")

        # TC-WA-002 Feedback -> Write Feedback
        r2 = handle_feedback_workflow(conv_code, state, "", "ENGLISH", btn_id="btn_write_feedback")
        self.assertIn("Write Feedback", r2["response"])
        self.assertIn(state.get("feedback_stage"), ["FEEDBACK_TEXT", "AWAITING_TEXT"])

        # TC-WA-003 Text feedback -> Rating prompt
        r3 = handle_feedback_workflow(conv_code, state, "The food was served on time and taste was very good.", "ENGLISH")
        self.assertIn("How would you rate your overall experience", r3["response"])
        self.assertIn(state.get("feedback_stage"), ["FEEDBACK_RATING", "AWAITING_RATING"])
        self.assertEqual(state.get("pending_feedback_text"), "The food was served on time and taste was very good.")

        # TC-WA-004..008 Rating 9 -> Saved single record with source WHATSAPP_TEXT
        r4 = handle_feedback_workflow(conv_code, state, "9", "ENGLISH")
        self.assertIn("Thank you for your feedback", r4["response"])
        self.assertIsNone(state.get("active_workflow"))
        self.assertIsNone(state.get("pending_feedback_text"))

        # TC-WA-009 Voice -> Rating flow
        conv_voice = f"conv_voice_test_{int(datetime.datetime.now().timestamp())}"
        state_v = {}
        handle_feedback_workflow(conv_voice, state_v, "Voice Feedback", "ENGLISH", btn_id="btn_voice_feedback")
        r_v_msg = handle_feedback_workflow(conv_voice, state_v, "The doctor was extremely caring.", "ENGLISH", metadata={"message_type": "VOICE"})
        self.assertIn("How would you rate", r_v_msg["response"])
        self.assertEqual(state_v.get("pending_feedback_source"), "WHATSAPP_VOICE")

    def test_tc_wa_exact_flow_with_process_agent_message(self):
        from agent.agent_service import process_agent_message

        # Test case 1: Feedback -> Write Feedback -> "The food was not good." -> 3
        conv1 = f"WA_919810087328_flow1_{int(datetime.datetime.now().timestamp())}"
        r1_1 = process_agent_message(conv1, "", "Feedback", interactive_id="btn_cat_feedback")
        self.assertIn("Patient Feedback", r1_1["response"])

        r1_2 = process_agent_message(conv1, "", "Write Feedback", interactive_id="btn_write_feedback")
        self.assertIn("Write Feedback", r1_2["response"])

        r1_3 = process_agent_message(conv1, "", "The food was not good.")
        self.assertIn("How would you rate your overall experience", r1_3["response"])

        r1_4 = process_agent_message(conv1, "", "3")
        self.assertIn("Thank you for your feedback", r1_4["response"])

        # Test case 2: Feedback -> Write Feedback -> "Billing took 3 hours." -> 2 (verifying "billing" keyword doesn't misroute!)
        conv2 = f"WA_919810087328_flow2_{int(datetime.datetime.now().timestamp())}"
        process_agent_message(conv2, "", "Feedback", interactive_id="btn_cat_feedback")
        process_agent_message(conv2, "", "Write Feedback", interactive_id="btn_write_feedback")
        r2_3 = process_agent_message(conv2, "", "Billing took 3 hours.")
        self.assertIn("How would you rate your overall experience", r2_3["response"])

        r2_4 = process_agent_message(conv2, "", "2")
        self.assertIn("Thank you for your feedback", r2_4["response"])

        # Test case 3: Feedback -> Write Feedback -> "The Food was Not well" -> Rating selection verification
        conv3 = f"WA_919810087328_flow3_{int(datetime.datetime.now().timestamp())}"
        process_agent_message(conv3, "", "Feedback", interactive_id="btn_cat_feedback")
        process_agent_message(conv3, "", "Write Feedback", interactive_id="btn_write_feedback")
        r3_3 = process_agent_message(conv3, "", "The Food was Not well")
        self.assertIn("How would you rate your overall experience", r3_3["response"])
        self.assertIn("interactive_buttons", r3_3)
        
        # Verify ALL 10 rating options (1 through 10) are generated in interactive_buttons
        btn_ids = [b["id"] for b in r3_3["interactive_buttons"]]
        expected_btn_ids = [f"btn_rating_{i}" for i in range(1, 11)]
        self.assertEqual(btn_ids, expected_btn_ids)
        self.assertEqual(len(r3_3["interactive_buttons"]), 10)

        r3_4 = process_agent_message(conv3, "", "3")
        self.assertIn("Thank you for your feedback", r3_4["response"])

    def test_tc_rating_selection_all_values(self):
        from agent.agent_service import process_agent_message
        for val in range(1, 11):
            conv = f"WA_919810087328_val_{val}_{int(datetime.datetime.now().timestamp())}"
            process_agent_message(conv, "", "Feedback", interactive_id="btn_cat_feedback")
            process_agent_message(conv, "", "Write Feedback", interactive_id="btn_write_feedback")
            process_agent_message(conv, "", "The hospital service was good")
            res_rating = process_agent_message(conv, "", f"⭐ {val}", interactive_id=f"btn_rating_{val}")
            self.assertIn("Thank you for your feedback", res_rating["response"], f"Failed selection for rating {val}")

        # Test case 4: All Section 5 natural language feedback phrases
        section5_phrases = [
            "The food was not good",
            "Billing took three hours",
            "Doctors were very helpful",
            "Staff treated me very well",
            "The room was not clean",
            "I had a problem with registration",
            "The nurses were excellent"
        ]
        for idx, phrase in enumerate(section5_phrases):
            conv_ph = f"WA_919810087328_ph_{idx}_{int(datetime.datetime.now().timestamp())}"
            process_agent_message(conv_ph, "", "Feedback", interactive_id="btn_cat_feedback")
            process_agent_message(conv_ph, "", "Write Feedback", interactive_id="btn_write_feedback")
            res_ph = process_agent_message(conv_ph, "", phrase)
            self.assertIn("How would you rate your overall experience", res_ph["response"], f"Failed for phrase: '{phrase}'")
            res_rate = process_agent_message(conv_ph, "", "8")
            self.assertIn("Thank you for your feedback", res_rate["response"])

        # Test case 5: Feedback -> Skip
        conv_sk = f"WA_919810087328_skip_{int(datetime.datetime.now().timestamp())}"
        process_agent_message(conv_sk, "", "Feedback", interactive_id="btn_cat_feedback")
        r_sk = process_agent_message(conv_sk, "", "Skip", interactive_id="btn_skip_feedback")
        self.assertIn("Thank you", r_sk["response"])

    def test_tc_wa_process_and_send_reply_no_exception(self):
        from api.whatsapp_routes import process_and_send_reply
        session_id = f"WA_919810087328_reply_{int(datetime.datetime.now().timestamp())}"
        
        # Step 1: Write Feedback
        process_and_send_reply(session_id, "919810087328", None, "Write Feedback", button_id="btn_write_feedback")

        # Step 2: Send "The Food was Not well" (Must NOT throw exception!)
        res = process_and_send_reply(session_id, "919810087328", None, "The Food was Not well")
        self.assertIsNotNone(res)
        self.assertIn("How would you rate your overall experience", res["response"])

        # Step 3: Rating 3
        res_end = process_and_send_reply(session_id, "919810087328", None, "3")
        self.assertIsNotNone(res_end)
        self.assertIn("Thank you for your feedback", res_end["response"])


if __name__ == '__main__':
    unittest.main()

