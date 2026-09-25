import os
import sys
import json

# Ensure stdout handles utf-8 encoding on Windows standard console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import agent.agent_service as agent_service
import agent.state_manager as state_manager
import agent.language_service as language_service

def run_tests():
    print("=" * 70)
    print("STARTING GLOBAL MULTILINGUAL CONSISTENCY REGRESSION TESTS")
    print("=" * 70)
    
    test_phone = "919888877777"
    test_session = f"WA_{test_phone}_gmc"
    
    # Helper to clean up state before tests
    def reset_state(phone=test_session):
        conn = agent_service.db_config.get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM patients WHERE status = 'ACTIVE' LIMIT 1;")
        r = cur.fetchone()
        pid = r[0] if r else 1
        cur.execute("UPDATE patients SET whatsapp_number = %s WHERE id = %s;", (test_phone, pid))
        cur.execute("SELECT id FROM conversations WHERE conversation_code = %s;", (test_session,))
        if cur.fetchone():
            cur.execute("UPDATE conversations SET whatsapp_number = %s, patient_id = %s WHERE conversation_code = %s;", (test_phone, pid, test_session))
        else:
            cur.execute("INSERT INTO conversations (conversation_code, whatsapp_number, patient_id) VALUES (%s, %s, %s);", (test_session, test_phone, pid))
        conn.commit()
        cur.close()
        conn.close()

        state = state_manager.get_conversation_state(phone)
        state["language"] = "ENGLISH"
        state["patient_id"] = pid
        state["selected_patient_id"] = pid
        state["patient_identification_stage"] = "COMPLETED"
        state["conversation_state"] = "IDLE"
        state["booking_stage"] = None
        state["previous_question"] = None
        state["entities"] = {"patient_id": pid}
        state["interactive_buttons"] = []
        state_manager.save_conversation_state(phone, state)

    # -----------------------------------------------------------------------
    # TEST 1: COMPLETE END-TO-END TAMIL WORKFLOW
    # -----------------------------------------------------------------------
    print("\n--- TEST 1: Full End-to-End Tamil Workflow ---")
    reset_state()

    # Step 1: Select Tamil Language
    r1 = agent_service.process_agent_message(test_session, test_phone, "btn_lang_ta", interactive_id="btn_lang_ta")
    print(f"[Step 1] Lang: {r1.get('language')} | Response: {r1.get('response')}")
    assert r1.get("language") == "TAMIL", "Language must be TAMIL"
    assert "தமிழுக்கு" in r1.get("response"), "Response must be in Tamil"

    # Step 2: Main Menu in Tamil
    r2 = agent_service.process_agent_message(test_session, test_phone, "btn_main_menu", interactive_id="btn_main_menu")
    print(f"[Step 2] Buttons: {[b['title'] for b in r2.get('interactive_buttons', [])]}")
    btn_titles = [b['title'] for b in r2.get('interactive_buttons', [])]
    assert any("அப்பாயிண்ட்மெண்ட்" in t for t in btn_titles), "Main menu buttons must be in Tamil"

    # Step 3: Book Appointment
    r3 = agent_service.process_agent_message(test_session, test_phone, "btn_book_appt", interactive_id="btn_book_appt")
    print(f"[Step 3] Prompt: {r3.get('response')}")
    assert "சுகாதார பிரச்சனை" in r3.get("response") or "காரணத்திற்காக" in r3.get("response"), "Prompt must be in Tamil"

    # Step 4: Symptom "காய்ச்சல்" (Fever)
    r4 = agent_service.process_agent_message(test_session, test_phone, "காய்ச்சல்")
    print(f"[Step 4] Doctor selection:\n{r4.get('response')}")
    assert "மருத்துவர்கள்" in r4.get("response") or "மருத்துவரை" in r4.get("response"), "Doctor selection prompt must be in Tamil"

    # Step 5: Select Doctor (e.g. Dr. Arun Kumar or first doc button)
    doc_buttons = r4.get("interactive_buttons", [])
    target_doc_btn = doc_buttons[0]["id"] if doc_buttons else "btn_doc_1"
    r5 = agent_service.process_agent_message(test_session, test_phone, target_doc_btn, interactive_id=target_doc_btn)
    print(f"[Step 5] Date selection prompt:\n{r5.get('response')}")
    assert "தேதியில்" in r5.get("response") or "தேதிகள்" in r5.get("response"), "Date selection prompt must be in Tamil"
    date_buttons = r5.get("interactive_buttons", [])
    assert any("தேதி" in b["title"] or "Choose" not in b["title"] for b in date_buttons), "Date buttons must be localized"

    # Step 6: Select Date
    target_date_btn = date_buttons[0]["id"] if date_buttons else "btn_date_2026-09-25"
    r6 = agent_service.process_agent_message(test_session, test_phone, target_date_btn, interactive_id=target_date_btn)
    print(f"[Step 6] Time slot prompt:\n{r6.get('response')}")
    assert "நேரங்கள்" in r6.get("response") or "நேரத்தில்" in r6.get("response"), "Time slot prompt must be in Tamil"

    # Step 7: Select Available Time Slot
    slot_buttons = r6.get("interactive_buttons", [])
    target_slot_btn = slot_buttons[0]["id"] if slot_buttons else "btn_slot_11:00"
    slot_title = slot_buttons[0]["title"] if slot_buttons else "11:00 AM"
    r7 = agent_service.process_agent_message(test_session, test_phone, slot_title, interactive_id=target_slot_btn)
    print(f"[Step 7] Confirmation card:\n{r7.get('response')}")
    print(f"[Step 7] Buttons: {[b['title'] for b in r7.get('interactive_buttons', [])]}")
    assert "உறுதிப்படுத்தவும்" in r7.get("response") or "நோயாளி" in r7.get("response") or "மருத்துவர்" in r7.get("response"), "Confirmation card must be in Tamil"
    conf_buttons = [b['title'] for b in r7.get('interactive_buttons', [])]
    assert any("உறுதி" in b for b in conf_buttons), "Confirmation buttons must be in Tamil"

    # Step 8: Confirm Appointment
    r8 = agent_service.process_agent_message(test_session, test_phone, "btn_confirm_appt", interactive_id="btn_confirm_appt")
    print(f"[Step 8] Payment request:\n{r8.get('response')}")
    assert "கட்டணம்" in r8.get("response") or "தொகை" in r8.get("response"), "Payment prompt must be in Tamil"

    # Step 9: Select Pay at Desk
    r9 = agent_service.process_agent_message(test_session, test_phone, "btn_pay_desk", interactive_id="btn_pay_desk")
    print(f"[Step 9] Booking success:\n{r9.get('response')}")
    assert "வெற்றிகரமாக" in r9.get("response") or "முன்பதிவு" in r9.get("response"), "Booking success message must be in Tamil"

    # Step 10: My Appointments Card
    r10 = agent_service.process_agent_message(test_session, test_phone, "btn_my_appts", interactive_id="btn_my_appts")
    print(f"[Step 10] My Appointments:\n{r10.get('response')}")
    assert "அப்பாயிண்ட்மெண்ட்" in r10.get("response"), "My Appointments header/card must be in Tamil"

    # Step 11: My Profile Card
    r11 = agent_service.process_agent_message(test_session, test_phone, "btn_my_profile", interactive_id="btn_my_profile")
    print(f"[Step 11] My Profile:\n{r11.get('response')}")
    assert "சுயவிவர" in r11.get("response") or "பெயர்" in r11.get("response"), "My Profile card must be in Tamil"

    print("PASSED TEST 1: Full Tamil Workflow")

    # -----------------------------------------------------------------------
    # TEST 2: MID-FLOW LANGUAGE SWITCHING (Tamil -> English -> Tamil)
    # -----------------------------------------------------------------------
    print("\n--- TEST 2: Mid-Flow Language Switching ---")
    reset_state()
    agent_service.process_agent_message(test_session, test_phone, "btn_lang_ta", interactive_id="btn_lang_ta")
    agent_service.process_agent_message(test_session, test_phone, "btn_book_appt", interactive_id="btn_book_appt")
    
    # Switch to English mid-flow
    res_en_shift = agent_service.process_agent_message(test_session, test_phone, "English please")
    print(f"Shift to EN response: {res_en_shift.get('response')}")
    assert res_en_shift.get("language") == "ENGLISH", "Language must shift to ENGLISH"
    assert "changed to English" in res_en_shift.get("response"), "Confirmation must be in English"

    # Send symptom in English
    res_en_sym = agent_service.process_agent_message(test_session, test_phone, "fever")
    print(f"EN symptom response:\n{res_en_sym.get('response')}")
    assert res_en_sym.get("language") == "ENGLISH", "Response language must remain ENGLISH"
    assert "General Medicine" in res_en_sym.get("response") and "Which doctor" in res_en_sym.get("response"), "Response must be in English"

    # Switch back to Tamil mid-flow
    res_ta_shift = agent_service.process_agent_message(test_session, test_phone, "தமிழ்")
    print(f"Shift back to TA response: {res_ta_shift.get('response')}")
    assert res_ta_shift.get("language") == "TAMIL", "Language must shift back to TAMIL"
    print("PASSED TEST 2: Mid-Flow Language Switching")

    print("\n=" * 70)
    print("ALL GLOBAL MULTILINGUAL CONSISTENCY TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
