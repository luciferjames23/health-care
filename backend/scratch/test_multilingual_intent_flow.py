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
    print("STARTING MULTILINGUAL INTENT & CONVERSATION STATE REGRESSION TESTS")
    print("=" * 70)
    
    test_phone = "919999999999"
    test_session = test_phone
    
    # Helper to clean up state before tests
    def reset_state(phone=test_phone):
        state = state_manager.get_conversation_state(phone)
        state["language"] = "ENGLISH"
        state["conversation_state"] = "IDLE"
        state["booking_stage"] = None
        state["previous_question"] = None
        state["entities"] = {}
        state["interactive_buttons"] = []
        state_manager.save_conversation_state(phone, state)

    # TEST 1: Tamil Language Selection & Persistence
    print("\n--- TEST 1: Tamil Language Selection & Persistence ---")
    reset_state()
    res1 = agent_service.process_agent_message(test_session, test_phone, "btn_lang_ta", interactive_id="btn_lang_ta")
    print(f"Res 1 Language: {res1.get('language')}")
    print(f"Res 1 Response: {res1.get('response')[:80]}")
    assert res1.get("language") == "TAMIL", f"Expected TAMIL, got {res1.get('language')}"
    
    state = state_manager.get_conversation_state(test_phone)
    assert state.get("language") == "TAMIL", f"State language should be TAMIL, got {state.get('language')}"
    print("PASSED TEST 1")

    # TEST 2: Tamil Booking Request & Symptom Prompt
    print("\n--- TEST 2: Tamil Booking Request ---")
    res2 = agent_service.process_agent_message(test_session, test_phone, "முன்பதிவு செய்ய", interactive_id="btn_book_appt")
    print(f"Res 2 Language: {res2.get('language')}")
    print(f"Res 2 Response: {res2.get('response')}")
    assert res2.get("language") == "TAMIL", "Response language must be TAMIL"
    assert "சுகாதாரப் பிரச்சனை" in res2.get("response") or "பிரச்சனை" in res2.get("response") or "அறிகுறி" in res2.get("response"), "Response must ask for symptom in Tamil"
    
    state = state_manager.get_conversation_state(test_phone)
    assert state.get("booking_stage") == "AWAITING_SYMPTOM", f"Expected AWAITING_SYMPTOM, got {state.get('booking_stage')}"
    print("PASSED TEST 2")

    # TEST 3: Tamil Symptom "தலைவலி" (Headache)
    print("\n--- TEST 3: Tamil Symptom 'தலைவலி' (Headache) ---")
    res3 = agent_service.process_agent_message(test_session, test_phone, "தலைவலி")
    print(f"Res 3 Language: {res3.get('language')}")
    print(f"Res 3 Response:\n{res3.get('response')}")
    assert res3.get("language") == "TAMIL", "Response language must be TAMIL"
    assert "சுகாதாரப் பிரச்சனை" not in res3.get("response"), "Must NOT repeat the symptom prompt!"
    assert "மருத்துவர்" in res3.get("response") or "துறை" in res3.get("response"), "Must display doctor/dept options in Tamil"
    print("PASSED TEST 3")

    # TEST 4: Tamil Symptom "காய்ச்சல்" (Fever)
    print("\n--- TEST 4: Tamil Symptom 'காய்ச்சல்' (Fever) ---")
    reset_state()
    agent_service.process_agent_message(test_session, test_phone, "btn_lang_ta", interactive_id="btn_lang_ta")
    agent_service.process_agent_message(test_session, test_phone, "btn_book_appt", interactive_id="btn_book_appt")
    res4 = agent_service.process_agent_message(test_session, test_phone, "காய்ச்சல்")
    print(f"Res 4 Response:\n{res4.get('response')}")
    assert res4.get("language") == "TAMIL", "Response language must be TAMIL"
    assert "சுகாதாரப் பிரச்சனை" not in res4.get("response"), "Must NOT repeat symptom prompt!"
    assert "General Medicine" in res4.get("response") or "மருத்துவர்" in res4.get("response"), "Must route to department/doctor in Tamil"
    print("PASSED TEST 4")

    # TEST 5: Tamil Symptom "முடி உதிர்வு" (Hair loss)
    print("\n--- TEST 5: Tamil Symptom 'முடி உதிர்வு' (Hair loss) ---")
    reset_state()
    agent_service.process_agent_message(test_session, test_phone, "btn_lang_ta", interactive_id="btn_lang_ta")
    agent_service.process_agent_message(test_session, test_phone, "btn_book_appt", interactive_id="btn_book_appt")
    res5 = agent_service.process_agent_message(test_session, test_phone, "முடி உதிர்வு")
    print(f"Res 5 Response:\n{res5.get('response')}")
    assert res5.get("language") == "TAMIL", "Response language must be TAMIL"
    assert "Dermatology" in res5.get("response") or "மருத்துவர்" in res5.get("response"), "Must route to Dermatology or prompt doctor"
    print("PASSED TEST 5")

    # TEST 6: English Equivalents Unchanged
    print("\n--- TEST 6: English Flow Unchanged ---")
    reset_state()
    agent_service.process_agent_message(test_session, test_phone, "btn_lang_en", interactive_id="btn_lang_en")
    res_en_book = agent_service.process_agent_message(test_session, test_phone, "Book Appointment", interactive_id="btn_book_appt")
    assert res_en_book.get("language") == "ENGLISH"
    assert "health problem" in res_en_book.get("response").lower()
    
    res_en_sym = agent_service.process_agent_message(test_session, test_phone, "headache")
    assert res_en_sym.get("language") == "ENGLISH"
    assert "health problem" not in res_en_sym.get("response").lower()
    assert "doctor" in res_en_sym.get("response").lower() or "department" in res_en_sym.get("response").lower()
    print("PASSED TEST 6")

    # TEST 7: Language Switch (Tamil -> English -> Tamil)
    print("\n--- TEST 7: Language Switch ---")
    reset_state()
    agent_service.process_agent_message(test_session, test_phone, "btn_lang_ta", interactive_id="btn_lang_ta")
    st = state_manager.get_conversation_state(test_phone)
    assert st.get("language") == "TAMIL"

    agent_service.process_agent_message(test_session, test_phone, "btn_lang_en", interactive_id="btn_lang_en")
    st = state_manager.get_conversation_state(test_phone)
    assert st.get("language") == "ENGLISH"

    agent_service.process_agent_message(test_session, test_phone, "btn_lang_ta", interactive_id="btn_lang_ta")
    st = state_manager.get_conversation_state(test_phone)
    assert st.get("language") == "TAMIL"
    print("PASSED TEST 7")

    print("\n=" * 70)
    print("ALL MULTILINGUAL INTENT & CONVERSATION STATE TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
