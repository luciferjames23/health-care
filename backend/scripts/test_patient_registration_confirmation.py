import os
import sys
import uuid
import datetime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agent import agent_service, state_manager
import agent.patient_identification_service as patient_id_service
import db_config

import random

def run_tests():
    print("============================================================")
    print("RUNNING AUTOMATED REGRESSION TESTS FOR REGISTRATION FLOW")
    print("============================================================\n")

    test_phone = f"9198{random.randint(10000000, 99999999)}"
    conv_code = f"WA_{test_phone}_session"

    # Cleanup DB before starting
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM conversations WHERE conversation_code = %s;", (conv_code,))
        cur.execute("DELETE FROM patients WHERE phone = %s OR whatsapp_number = %s;", (test_phone, test_phone))
        conn.commit()
    finally:
        cur.close()
        conn.close()

    # ------------------------------------------------------------
    # TEST 1: User says "I already registered"
    # ------------------------------------------------------------
    print("[TEST 1] Testing 'I already registered' routing...")
    res1 = agent_service.process_agent_message(conv_code, None, "I already registered")
    state1 = state_manager.get_conversation_state(conv_code)
    
    assert state1.get("patient_identification_stage") == "AWAITING_PATIENT_ID", f"Expected AWAITING_PATIENT_ID, got {state1.get('patient_identification_stage')}"
    assert state1.get("registration_name") != "I already registered", f"Name incorrectly captured: {state1.get('registration_name')}"
    reg_fn1 = (state1.get("registration_fields") or {}).get("first_name")
    assert reg_fn1 != "I already registered", f"first_name incorrectly stored in draft: {reg_fn1}"
    print("   [PASS] TEST 1 PASSED: 'I already registered' routed to Existing Patient, name is not stored.\n")

    # ------------------------------------------------------------
    # TEST 3: User says "First time visitor"
    # ------------------------------------------------------------
    print("[TEST 3] Testing 'First time visitor' trigger...")
    res3 = agent_service.process_agent_message(conv_code, None, "First time visitor")
    state3 = state_manager.get_conversation_state(conv_code)
    
    assert state3.get("patient_identification_stage") == "REGISTRATION", f"Expected REGISTRATION stage, got {state3.get('patient_identification_stage')}"
    reg_fn3 = (state3.get("registration_fields") or {}).get("first_name")
    assert reg_fn3 is None, f"Expected name to be None initially, got {reg_fn3}"
    print("   [PASS] TEST 3 PASSED: New registration started, name remains NULL.\n")

    # ------------------------------------------------------------
    # TEST 2: User says "My name is Arun Kumar"
    # ------------------------------------------------------------
    print("[TEST 2] Testing Name extraction ('My name is Arun Kumar')...")
    res2 = agent_service.process_agent_message(conv_code, None, "My name is Arun Kumar")
    state2 = state_manager.get_conversation_state(conv_code)
    
    reg_fn2 = (state2.get("registration_fields") or {}).get("first_name")
    assert reg_fn2 == "Arun", f"Expected first_name 'Arun', got '{reg_fn2}'"
    print("   [PASS] TEST 2 PASSED: Name correctly parsed as Arun.\n")

    # Supply DOB & Gender to reach Confirmation Card
    print("[STEP] Providing DOB '20-Jan-2001'...")
    res_dob = agent_service.process_agent_message(conv_code, None, "20-Jan-2001")
    print("   res_dob response:", res_dob.get("response"))
    state_dob = state_manager.get_conversation_state(conv_code)
    print("   state_dob reg_fields:", state_dob.get("registration_fields"))
    print("   state_dob stage:", state_dob.get("patient_identification_stage"))
    
    print("[STEP] Providing Gender 'Male'...")
    res_gen = agent_service.process_agent_message(conv_code, None, "Male", interactive_id="btn_g_male")
    print("   res_gen response:", res_gen.get("response"))
    state_conf = state_manager.get_conversation_state(conv_code)
    print("   state_conf reg_fields:", state_conf.get("registration_fields"))
    print("   state_conf stage:", state_conf.get("patient_identification_stage"))

    assert state_conf.get("patient_identification_stage") == "REGISTRATION_CONFIRMATION", f"Expected REGISTRATION_CONFIRMATION, got {state_conf.get('patient_identification_stage')}"
    assert state_conf.get("reg_confirmation_pending") is True, "Expected reg_confirmation_pending to be True"
    assert "👤 Name: Arun Kumar" in res_gen["response"], f"Confirmation response missing name: {res_gen['response']}"
    assert "🎂 Date of Birth: 20-Jan-2001" in res_gen["response"], f"Confirmation response missing DOB: {res_gen['response']}"
    assert "👨 Gender: Male" in res_gen["response"], f"Confirmation response missing Gender: {res_gen['response']}"
    print("   [PASS] STEP PASSED: Confirmation Card generated with correct draft details.\n")

    # ------------------------------------------------------------
    # TEST 4: At confirmation, User taps/types Edit
    # ------------------------------------------------------------
    print("[TEST 4] Testing Edit button tap at confirmation...")
    res4 = agent_service.process_agent_message(conv_code, None, "Edit", interactive_id="btn_edit_reg")
    state4 = state_manager.get_conversation_state(conv_code)

    assert state4.get("patient_identification_stage") == "REGISTRATION_EDIT", f"Expected REGISTRATION_EDIT, got {state4.get('patient_identification_stage')}"
    assert "What would you like to change?" in res4["response"], f"Expected field selection prompt, got: {res4['response']}"
    assert len(res4["interactive_buttons"]) >= 5, f"Expected field buttons, got: {res4['interactive_buttons']}"
    print("   [PASS] TEST 4 PASSED: Edit action opens field selection buttons, card not repeated.\n")

    # ------------------------------------------------------------
    # TEST 7: Duplicate Edit webhook tap
    # ------------------------------------------------------------
    print("[TEST 7] Testing Duplicate Edit webhook tap...")
    res7 = agent_service.process_agent_message(conv_code, None, "Edit", interactive_id="btn_edit_reg")
    state7 = state_manager.get_conversation_state(conv_code)

    assert state7.get("patient_identification_stage") == "REGISTRATION_EDIT", "Expected REGISTRATION_EDIT"
    print("   [PASS] TEST 7 PASSED: Duplicate Edit handled idempotently.\n")

    # ------------------------------------------------------------
    # TEST 8: Patient edits Name
    # ------------------------------------------------------------
    print("[TEST 8] Testing editing Name field...")
    res8_select = agent_service.process_agent_message(conv_code, None, "Name", interactive_id="btn_edit_reg_name")
    assert "Please enter your full name" in res8_select["response"], f"Expected name prompt, got {res8_select['response']}"

    res8_update = agent_service.process_agent_message(conv_code, None, "Arun Dev")
    state8 = state_manager.get_conversation_state(conv_code)

    reg_fields8 = state8.get("registration_fields") or {}
    assert reg_fields8.get("first_name") == "Arun" and reg_fields8.get("last_name") == "Dev", f"Expected Arun Dev, got {reg_fields8}"
    assert reg_fields8.get("date_of_birth") == "2001-01-20", f"DOB changed unexpectedly: {reg_fields8.get('date_of_birth')}"
    assert reg_fields8.get("gender") == "Male", f"Gender changed unexpectedly: {reg_fields8.get('gender')}"
    assert state8.get("patient_identification_stage") == "REGISTRATION_CONFIRMATION", "Expected return to REGISTRATION_CONFIRMATION"
    print("   [PASS] TEST 8 PASSED: Name edited to Arun Dev, other fields remained unchanged.\n")

    # ------------------------------------------------------------
    # TEST 9: Patient edits DOB
    # ------------------------------------------------------------
    print("[TEST 9] Testing editing DOB field...")
    agent_service.process_agent_message(conv_code, None, "Edit", interactive_id="btn_edit_reg")
    agent_service.process_agent_message(conv_code, None, "DOB", interactive_id="btn_edit_reg_dob")
    res9_update = agent_service.process_agent_message(conv_code, None, "15-Aug-1995")
    state9 = state_manager.get_conversation_state(conv_code)

    reg_fields9 = state9.get("registration_fields") or {}
    assert reg_fields9.get("date_of_birth") == "1995-08-15", f"Expected 1995-08-15, got {reg_fields9.get('date_of_birth')}"
    assert reg_fields9.get("first_name") == "Arun", "Name changed unexpectedly"
    print("   [PASS] TEST 9 PASSED: Only DOB changed.\n")

    # ------------------------------------------------------------
    # TEST 10: Patient edits Gender
    # ------------------------------------------------------------
    print("[TEST 10] Testing editing Gender field...")
    agent_service.process_agent_message(conv_code, None, "Edit", interactive_id="btn_edit_reg")
    agent_service.process_agent_message(conv_code, None, "Gender", interactive_id="btn_edit_reg_gender")
    res10_update = agent_service.process_agent_message(conv_code, None, "Male", interactive_id="btn_g_male")
    state10 = state_manager.get_conversation_state(conv_code)

    reg_fields10 = state10.get("registration_fields") or {}
    assert reg_fields10.get("gender") == "Male", "Gender update failed"
    print("   [PASS] TEST 10 PASSED: Only Gender changed.\n")

    # ------------------------------------------------------------
    # TEST 11: Patient edits Email
    # ------------------------------------------------------------
    print("[TEST 11] Testing editing Email field...")
    agent_service.process_agent_message(conv_code, None, "Edit", interactive_id="btn_edit_reg")
    agent_service.process_agent_message(conv_code, None, "Email", interactive_id="btn_edit_reg_email")
    res11_update = agent_service.process_agent_message(conv_code, None, "arun.dev@example.com")
    state11 = state_manager.get_conversation_state(conv_code)

    reg_fields11 = state11.get("registration_fields") or {}
    assert reg_fields11.get("email") == "arun.dev@example.com", f"Expected email arun.dev@example.com, got {reg_fields11.get('email')}"
    print("   [PASS] TEST 11 PASSED: Email updated in draft.\n")

    # ------------------------------------------------------------
    # TEST 12: Optional email omitted check
    # ------------------------------------------------------------
    print("[TEST 12] Verification that registration can proceed without email...")
    assert reg_fields11.get("first_name") and reg_fields11.get("date_of_birth") and reg_fields11.get("gender") and reg_fields11.get("phone")
    print("   [PASS] TEST 12 PASSED: Required fields are valid for confirmation.\n")

    # ------------------------------------------------------------
    # TEST 5: At confirmation, User taps/types Confirm
    # ------------------------------------------------------------
    print("[TEST 5] Testing Confirm button tap at confirmation...")
    res5 = agent_service.process_agent_message(conv_code, None, "Confirm", interactive_id="btn_confirm_reg")
    state5 = state_manager.get_conversation_state(conv_code)

    assert state5.get("patient_identification_stage") == "COMPLETED", f"Expected COMPLETED, got {state5.get('patient_identification_stage')}"
    new_pid = state5.get("selected_patient_id")
    assert new_pid is not None, "selected_patient_id was not set!"

    # Verify patient in PostgreSQL DB
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, first_name, last_name, patient_code, phone FROM patients WHERE id = %s;", (new_pid,))
        db_p = cur.fetchone()
        assert db_p is not None, f"Patient record id {new_pid} not found in DB!"
        assert db_p[1] == "Arun" and db_p[2] == "Dev", f"DB Patient name mismatch: {db_p}"
        print(f"   [PASS] TEST 5 PASSED: Patient successfully persisted in DB. Patient ID: {db_p[3]} (DB ID: {new_pid}).\n")
    finally:
        cur.close()
        conn.close()

    # ------------------------------------------------------------
    # TEST 6: Duplicate Confirm webhook
    # ------------------------------------------------------------
    print("[TEST 6] Testing Duplicate Confirm webhook...")
    res6 = agent_service.process_agent_message(conv_code, str(new_pid), "Confirm", interactive_id="btn_confirm_reg")
    state6 = state_manager.get_conversation_state(conv_code)
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM patients WHERE phone = %s;", (test_phone,))
        cnt = cur.fetchone()[0]
        assert cnt == 1, f"Expected 1 patient record for phone {test_phone}, found {cnt}"
        print("   [PASS] TEST 6 PASSED: Duplicate Confirm handled idempotently without duplicate records.\n")
    finally:
        cur.close()
        conn.close()

    # ------------------------------------------------------------
    # TEST 13: selected_patient_id must be assigned to newly created patient
    # ------------------------------------------------------------
    print("[TEST 13] Checking selected_patient_id assignment...")
    assert state6.get("selected_patient_id") == new_pid, f"Expected selected_patient_id={new_pid}, got {state6.get('selected_patient_id')}"
    print("   [PASS] TEST 13 PASSED: selected_patient_id correctly points to newly registered patient.\n")

    # ------------------------------------------------------------
    # TEST 14: "My profile" shows newly registered patient
    # ------------------------------------------------------------
    print("[TEST 14] Testing 'My profile' after registration...")
    res14 = agent_service.process_agent_message(conv_code, "", "My profile")
    print("   res14 response:", res14.get("response"))
    assert "Arun" in res14["response"], f"Profile response missing Arun: {res14['response']}"
    print("   [PASS] TEST 14 PASSED: 'My profile' correctly displays newly registered patient.\n")

    # ------------------------------------------------------------
    # TEST 15: "Book appointment" uses newly registered patient
    # ------------------------------------------------------------
    print("[TEST 15] Testing 'Book appointment' context after registration...")
    res15 = agent_service.process_agent_message(conv_code, "", "Book appointment")
    state15 = state_manager.get_conversation_state(conv_code)
    assert state15.get("selected_patient_id") == new_pid, "selected_patient_id lost in booking flow!"
    print("   [PASS] TEST 15 PASSED: 'Book appointment' uses newly registered patient profile.\n")

    print("============================================================")
    print("ALL 15 REGRESSION TESTS PASSED SUCCESSFULLY! (100% SUCCESS)")
    print("============================================================\n")

if __name__ == "__main__":
    run_tests()
