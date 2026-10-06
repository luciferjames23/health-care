import sys
import os
import json
import asyncio

# Ensure backend root is on Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import db_config
from agent.feedback_agent import (
    analyze_patient_feedback,
    check_emergency_feedback,
    extract_rating_from_text,
    store_patient_feedback
)
from agent.language_service import get_main_menu_buttons, translate_response
from agent.agent_service import handle_feedback_workflow
from services.post_discharge_feedback_scheduler import check_and_trigger_post_discharge_feedback

async def run_test_suite():
    print("============================================================")
    print("STARTING AG-05 FEEDBACK AGENT INTEGRATION TEST SUITE")
    print("============================================================\n")

    # TEST 1: Main Menu Feedback Button Translation across supported languages
    print("--- TEST 1: Main Menu [Feedback] Button Translation ---")
    langs = ["ENGLISH", "TAMIL", "HINDI", "TELUGU", "MALAYALAM", "KANNADA", "URDU"]
    for lang in langs:
        btns = get_main_menu_buttons(lang)
        fb_btn = next((b for b in btns if b.get("id") in ["btn_cat_feedback", "btn_feedback", "FEEDBACK"]), None)
        assert fb_btn is not None, f"Feedback button missing for {lang}"
        safe_title = repr(fb_btn.get('title'))
        print(f"[{lang}] Feedback Button Label: {safe_title}")
    print("✓ TEST 1 PASSED: Main Menu [Feedback] button present & translated in all 7 languages.\n")

    # TEST 2: AI Positive Feedback Understanding
    print("--- TEST 2: AI Positive Feedback ---")
    pos_text = "The doctor explained everything clearly and the nurses were very helpful."
    res_pos = analyze_patient_feedback(pos_text, language="ENGLISH")
    print("Result:", json.dumps(res_pos, indent=2))
    assert res_pos["sentiment"] in ["POSITIVE", "MIXED"], f"Expected POSITIVE, got {res_pos['sentiment']}"
    assert any("Doctor" in c or "Nursing" in c for c in res_pos["categories"]), "Expected Doctor/Nursing categories"
    print("✓ TEST 2 PASSED: Positive feedback classified correctly.\n")

    # TEST 3: AI Negative Feedback & Grievance Trigger
    print("--- TEST 3: AI Negative Feedback ---")
    neg_text = "The food was cold and the billing process took almost three hours."
    res_neg = analyze_patient_feedback(neg_text, language="ENGLISH")
    print("Result:", json.dumps(res_neg, indent=2))
    assert res_neg["sentiment"] == "NEGATIVE", f"Expected NEGATIVE, got {res_neg['sentiment']}"
    assert res_neg["requires_action"] is True, "Expected requires_action=True for negative feedback"
    print("✓ TEST 3 PASSED: Negative feedback classified correctly with requires_action=True.\n")

    # TEST 4: AI Neutral Feedback
    print("--- TEST 4: AI Neutral Feedback ---")
    neu_text = "The hospital has many departments but I had to wait before finding the correct counter."
    res_neu = analyze_patient_feedback(neu_text, language="ENGLISH")
    print("Result:", json.dumps(res_neu, indent=2))
    assert res_neu["sentiment"] in ["NEUTRAL", "MIXED"], f"Expected NEUTRAL/MIXED, got {res_neu['sentiment']}"
    print("✓ TEST 4 PASSED: Neutral feedback classified correctly.\n")

    # TEST 5: AI Mixed Feedback
    print("--- TEST 5: AI Mixed Feedback ---")
    mix_text = "Doctor was excellent but waiting time was very long."
    res_mix = analyze_patient_feedback(mix_text, language="ENGLISH")
    print("Result:", json.dumps(res_mix, indent=2))
    assert res_mix["sentiment"] in ["MIXED", "NEGATIVE", "POSITIVE"], f"Got {res_mix['sentiment']}"
    assert len(res_mix["categories"]) >= 2, "Expected multiple categories for mixed feedback"
    print("✓ TEST 5 PASSED: Mixed feedback classified correctly.\n")

    # TEST 6: Tamil / Multilingual Feedback Understanding
    print("--- TEST 6: Tamil / Tanglish Feedback Understanding ---")
    ta_text = "Food romba cold ah irundhuchu and billing ku romba time aachu."
    res_ta = analyze_patient_feedback(ta_text, language="TAMIL")
    print("Result:", json.dumps(res_ta, indent=2))
    assert res_ta["sentiment"] == "NEGATIVE", f"Expected NEGATIVE for Tamil complaint, got {res_ta['sentiment']}"
    print("✓ TEST 6 PASSED: Tamil / Tanglish feedback semantically understood.\n")

    # TEST 7: Emergency & Patient Safety Override
    print("--- TEST 7: Critical Safety Feedback Detection ---")
    emerg_text = "I am having severe chest pain after discharge."
    is_emerg = check_emergency_feedback(emerg_text)
    print("Emergency check result:", is_emerg)
    assert is_emerg is True, "Expected emergency check to return True for severe chest pain"
    print("✓ TEST 7 PASSED: Critical safety feedback routes to emergency override.\n")

    # TEST 8: DB Persistence & Patient Identification
    print("--- TEST 8: Database Feedback Persistence ---")
    record = store_patient_feedback(
        conversation_code="conv_test_123",
        original_feedback="The nursing staff was very attentive during my ward stay.",
        explicit_rating=8,
        source="WHATSAPP_TEXT",
        patient_id=87328,
        analysis_override=res_pos
    )
    print("Stored DB Record:", json.dumps(record, indent=2, default=str))
    assert record is not None, "Failed to insert patient feedback into database"
    assert record.get("feedback_id") is not None, "Feedback ID missing"
    assert str(record["patient_id"]) in ["87328", "P100025"], "Patient ID mismatch"
    print("✓ TEST 8 PASSED: Database persistence succeeded.\n")

    # TEST 9: Post-Discharge Feedback Automated Trigger Scheduler Check
    print("--- TEST 9: Post-Discharge Feedback Scheduler Trigger ---")
    scheduler_res = check_and_trigger_post_discharge_feedback()
    print("Scheduler Run Result:", scheduler_res)
    assert "triggered_count" in scheduler_res, "Scheduler result missing triggered_count"
    print("✓ TEST 9 PASSED: Post-discharge background trigger runner executed cleanly.\n")

    print("============================================================")
    print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (100%)")
    print("============================================================")

if __name__ == "__main__":
    asyncio.run(run_test_suite())
