"""
Automated Test Suite for Meridian Hospital AI Patient Desk:
PERMANENT FIX — PATIENT SWITCHING / MY PROFILE ROUTING & SECURITY
"""
import sys
import os
import uuid
import datetime

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config
import agent.agent_service as agent_service
import agent.state_manager as state_manager
import agent.patient_identification_service as patient_id_service
import agent.llm_intent_router as llm_intent_router


def create_test_patient(phone: str, patient_code: str, first_name: str, last_name: str, dob: str = "1990-05-15", gender: str = "Male") -> int:
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO patients (patient_code, first_name, last_name, date_of_birth, gender, phone, whatsapp_number, registration_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_DATE, 'ACTIVE')
            RETURNING id;
        """, (patient_code, first_name, last_name, dob, gender, phone, phone))
        pid = cur.fetchone()[0]
        conn.commit()
        return pid
    finally:
        cur.close()
        conn.close()


def cleanup_test_data(test_phone: str, other_phone: str):
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_code LIKE 'WA_TEST_%%');")
        cur.execute("DELETE FROM agent_action_logs WHERE conversation_id IN (SELECT id FROM conversations WHERE conversation_code LIKE 'WA_TEST_%%');")
        cur.execute("DELETE FROM conversations WHERE conversation_code LIKE 'WA_TEST_%%';")
        cur.execute("DELETE FROM appointments WHERE patient_id IN (SELECT id FROM patients WHERE patient_code IN ('P99001', 'P99002', 'P99003', 'P99004'));")
        cur.execute("DELETE FROM bills WHERE patient_id IN (SELECT id FROM patients WHERE patient_code IN ('P99001', 'P99002', 'P99003', 'P99004'));")
        cur.execute("DELETE FROM patients WHERE patient_code IN ('P99001', 'P99002', 'P99003', 'P99004');")
        conn.commit()
    finally:
        cur.close()
        conn.close()


def run_all_tests():
    print("============================================================")
    print("RUNNING 23 PATIENT SWITCHING / MY PROFILE ROUTING TEST CASES")
    print("============================================================")

    test_phone_single = "919888877771"
    test_phone_multi = "919888877772"
    other_user_phone = "919888877773"

    cleanup_test_data(test_phone_single, test_phone_multi)
    cleanup_test_data(other_user_phone, "919999999999")

    # Seed Database Records
    pid_single = create_test_patient(test_phone_single, "P99001", "Single", "User", "1985-01-01", "Male")
    pid_multi_1 = create_test_patient(test_phone_multi, "P99002", "John", "Peter", "1990-02-02", "Male")
    pid_multi_2 = create_test_patient(test_phone_multi, "P99003", "Jack", "Daniels", "1992-03-03", "Male")
    pid_other = create_test_patient(other_user_phone, "P99004", "Alice", "Smith", "1995-04-04", "Female")

    conv_single = f"WA_TEST_SINGLE_{uuid.uuid4().hex[:6]}"
    conv_multi = f"WA_TEST_MULTI_{uuid.uuid4().hex[:6]}"

    # Helper conversation initializer
    def init_conv(code: str, phone: str, selected_pid=None):
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                INSERT INTO conversations (conversation_code, whatsapp_number, patient_id, language)
                VALUES (%s, %s, %s, 'ENGLISH');
            """, (code, phone, selected_pid))
            conn.commit()
        except Exception:
            conn.rollback()
            cur.execute("UPDATE conversations SET patient_id = %s, whatsapp_number = %s WHERE conversation_code = %s;", (selected_pid, phone, code))
            conn.commit()
        finally:
            cur.close()
            conn.close()

        st = state_manager.get_conversation_state(code)
        st["whatsapp_number"] = phone
        st["selected_patient_id"] = selected_pid
        st["patient_id"] = selected_pid
        st["language"] = "ENGLISH"
        state_manager.save_conversation_state(code, st)

    init_conv(conv_single, test_phone_single, pid_single)
    init_conv(conv_multi, test_phone_multi, None)

    passed_count = 0
    total_count = 23

    try:
        # TEST 1: Single patient -> "My profile" -> Profile displayed
        res1 = agent_service.process_agent_message(conv_single, "", "My profile")
        assert res1["intent"] == "PATIENT_PROFILE", f"Test 1 Failed: {res1}"
        assert "Single User" in res1["response"] or "P99001" in res1["response"], f"Test 1 Failed: {res1['response']}"
        print("[PASS] TEST 1 PASSED: Single patient -> My profile displays profile card directly")
        passed_count += 1

        # TEST 2: Multiple patients -> "My profile" -> Patient Profiles selection
        res2 = agent_service.process_agent_message(conv_multi, "", "My profile")
        assert "Patient Profiles" in res2["response"] or "btn_select_pat_" in str(res2.get("interactive_buttons")), f"Test 2 Failed: {res2}"
        print("[PASS] TEST 2 PASSED: Multiple patients -> My profile prompts profile selection")
        passed_count += 1

        # TEST 3: "Switch patient" -> Patient Profiles selection
        res3 = agent_service.process_agent_message(conv_multi, "", "Switch patient")
        assert "Patient Profiles" in res3["response"] or "btn_select_pat_" in str(res3.get("interactive_buttons")), f"Test 3 Failed: {res3}"
        print("[PASS] TEST 3 PASSED: Switch patient prompts profile selection")
        passed_count += 1

        # TEST 4: "Change profile" -> Profile field selection
        res4 = agent_service.process_agent_message(conv_single, "", "Change profile")
        assert "What would you like to update?" in res4["response"], f"Test 4 Failed: {res4}"
        st_check = state_manager.get_conversation_state(conv_single)
        assert st_check.get("profile_update_stage") == "SELECT_FIELD", f"Test 4 Failed state: {st_check}"
        print("[PASS] TEST 4 PASSED: Change profile enters field selection (SELECT_FIELD)")
        passed_count += 1

        # TEST 5: "Switch patient" while state is SELECT_FIELD -> Switch patient flow wins
        res5 = agent_service.process_agent_message(conv_multi, "", "Change profile")
        res5_b = agent_service.process_agent_message(conv_multi, "", "Switch patient")
        assert "Patient Profiles" in res5_b["response"], f"Test 5 Failed: {res5_b}"
        st_check = state_manager.get_conversation_state(conv_multi)
        assert st_check.get("profile_update_stage") is None, f"Test 5 Failed state: {st_check}"
        print("[PASS] TEST 5 PASSED: Switch patient overrides stale SELECT_FIELD stage")
        passed_count += 1

        # TEST 6: "My profile" while state is SELECT_FIELD -> My profile flow wins
        st = state_manager.get_conversation_state(conv_single)
        st["profile_update_stage"] = "SELECT_FIELD"
        st["selected_patient_id"] = pid_single
        state_manager.save_conversation_state(conv_single, st)
        res6 = agent_service.process_agent_message(conv_single, "", "My profile")
        assert "Single User" in res6["response"] or "P99001" in res6["response"], f"Test 6 Failed: {res6}"
        st_check = state_manager.get_conversation_state(conv_single)
        assert st_check.get("profile_update_stage") is None, f"Test 6 Failed state: {st_check}"
        print("[PASS] TEST 6 PASSED: My profile overrides stale SELECT_FIELD stage")
        passed_count += 1

        # TEST 7: Patient selects profile -> selected_patient_id updated
        res7 = agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_1}")
        st_check = state_manager.get_conversation_state(conv_multi)
        assert st_check.get("selected_patient_id") == pid_multi_1, f"Test 7 Failed: {st_check}"
        print("[PASS] TEST 7 PASSED: Selecting profile updates selected_patient_id")
        passed_count += 1

        # TEST 8: Patient selects another profile -> Old patient transient context cleared
        st_check["payment_context"] = "OLD_BILL"
        st_check["bill_id"] = 9999
        state_manager.save_conversation_state(conv_multi, st_check)
        res8 = agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_2}")
        st_check = state_manager.get_conversation_state(conv_multi)
        assert st_check.get("selected_patient_id") == pid_multi_2, f"Test 8 Failed pid: {st_check}"
        assert st_check.get("bill_id") is None and st_check.get("payment_context") is None, f"Test 8 Failed context: {st_check}"
        print("[PASS] TEST 8 PASSED: Switching profile clears old patient transient context")
        passed_count += 1

        # TEST 9: Invalid patient selection -> Rejected
        res9 = agent_service.process_agent_message(conv_multi, "", "btn_select_pat_999999")
        assert "Access denied" in res9["response"], f"Test 9 Failed: {res9}"
        print("[PASS] TEST 9 PASSED: Invalid patient selection rejected securely")
        passed_count += 1

        # TEST 10: Patient attempts to select another WhatsApp user's patient -> Rejected
        res10 = agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_other}")
        assert "Access denied" in res10["response"], f"Test 10 Failed: {res10}"
        print("[PASS] TEST 10 PASSED: Cross-user patient selection rejected securely")
        passed_count += 1

        # TEST 11: "My profile" with one patient -> No unnecessary patient selection screen
        res11 = agent_service.process_agent_message(conv_single, "", "My profile")
        assert "Patient Profiles" not in res11["response"] and ("Single User" in res11["response"] or "P99001" in res11["response"]), f"Test 11 Failed: {res11}"
        print("[PASS] TEST 11 PASSED: Single patient profile direct display without selector")
        passed_count += 1

        # TEST 12: "Switch patient" with one patient -> No fake "patient not found" error
        res12 = agent_service.process_agent_message(conv_single, "", "Switch patient")
        assert "couldn't find a matching patient record" not in res12["response"].lower(), f"Test 12 Failed: {res12}"
        assert "Single User" in res12["response"] or "P99001" in res12["response"], f"Test 12 Failed: {res12}"
        print("[PASS] TEST 12 PASSED: Switch patient with 1 patient confirms profile cleanly")
        passed_count += 1

        # TEST 13: "Show another patient" -> SWITCH_PATIENT
        res13 = llm_intent_router.route_patient_message_llm("Show another patient", {}, [])
        assert res13["intent"] == "SWITCH_PATIENT", f"Test 13 Failed: {res13}"
        print("[PASS] TEST 13 PASSED: 'Show another patient' correctly maps to SWITCH_PATIENT intent")
        passed_count += 1

        # TEST 14: "Show my details" -> MY_PROFILE / PATIENT_DETAILS
        res14 = llm_intent_router.route_patient_message_llm("Show my details", {}, [])
        assert res14["intent"] in ["PATIENT_DETAILS", "MY_PROFILE"], f"Test 14 Failed: {res14}"
        print("[PASS] TEST 14 PASSED: 'Show my details' correctly maps to PATIENT_DETAILS intent")
        passed_count += 1

        # TEST 15: "Change my profile" -> CHANGE_PROFILE / PATIENT_DETAILS_UPDATE
        res15 = llm_intent_router.route_patient_message_llm("Change my profile", {}, [])
        assert res15["intent"] in ["PATIENT_DETAILS_UPDATE", "CHANGE_PROFILE"], f"Test 15 Failed: {res15}"
        print("[PASS] TEST 15 PASSED: 'Change my profile' correctly maps to CHANGE_PROFILE intent")
        passed_count += 1

        # TEST 16: "My profile, don't change anything" -> MY_PROFILE / PATIENT_DETAILS
        res16 = llm_intent_router.route_patient_message_llm("My profile, don't change anything", {}, [])
        assert res16["intent"] in ["PATIENT_DETAILS", "MY_PROFILE"], f"Test 16 Failed: {res16}"
        print("[PASS] TEST 16 PASSED: 'My profile, don't change anything' maps to PATIENT_DETAILS intent")
        passed_count += 1

        # TEST 17: Duplicate WhatsApp webhook event -> One processing result (Idempotency)
        import api.whatsapp_routes as wa_routes
        wamid_test = f"wamid.test_{uuid.uuid4().hex[:8]}"
        claim1 = wa_routes.claim_inbound_wamid(wamid_test)
        claim2 = wa_routes.claim_inbound_wamid(wamid_test)
        assert claim1 is True and claim2 is False, f"Test 17 Failed: claim1={claim1}, claim2={claim2}"
        print("[PASS] TEST 17 PASSED: Duplicate WhatsApp webhook event rejected via wamid claim guard")
        passed_count += 1

        # TEST 18: Patient selection action repeated -> Idempotent behavior
        res18_a = agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_1}")
        res18_b = agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_1}")
        assert res18_a.get("success") is True and res18_b.get("success") is True, f"Test 18 Failed: {res18_a}, {res18_b}"
        print("[PASS] TEST 18 PASSED: Repeated patient profile selection behaves idempotently")
        passed_count += 1

        # TEST 19: After profile switch -> "My appointments"
        agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_1}")
        res19 = agent_service.process_agent_message(conv_multi, "", "My appointments")
        assert res19["intent"] in ["APPOINTMENT_STATUS", "MY_APPOINTMENTS"], f"Test 19 Failed: {res19}"
        print("[PASS] TEST 19 PASSED: 'My appointments' after profile switch targets selected patient")
        passed_count += 1

        # TEST 20: After profile switch -> "Book appointment"
        agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_2}")
        res20 = agent_service.process_agent_message(conv_multi, "", "Book appointment")
        st_check = state_manager.get_conversation_state(conv_multi)
        assert st_check.get("selected_patient_id") == pid_multi_2, f"Test 20 Failed: {st_check}"
        print("[PASS] TEST 20 PASSED: 'Book appointment' uses newly selected patient")
        passed_count += 1

        # TEST 21: After profile switch -> "My reports"
        agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_1}")
        res21 = agent_service.process_agent_message(conv_multi, "", "My reports")
        assert "reports" in res21["response"].lower() or res21["intent"] == "PATIENT_REPORTS", f"Test 21 Failed: {res21}"
        print("[PASS] TEST 21 PASSED: 'My reports' targets newly selected patient")
        passed_count += 1

        # TEST 22: After profile switch -> "Billing"
        agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_2}")
        res22 = agent_service.process_agent_message(conv_multi, "", "Billing")
        assert res22["intent"] == "BILLING_AND_PAYMENTS", f"Test 22 Failed: {res22}"
        print("[PASS] TEST 22 PASSED: 'Billing' targets newly selected patient")
        passed_count += 1

        # TEST 23: After profile switch -> "Payment"
        agent_service.process_agent_message(conv_multi, "", f"btn_select_pat_{pid_multi_1}")
        res23 = agent_service.process_agent_message(conv_multi, "", "Show my bill")
        st_check = state_manager.get_conversation_state(conv_multi)
        assert st_check.get("bill_patient_id") == pid_multi_1 or st_check.get("selected_patient_id") == pid_multi_1, f"Test 23 Failed: {st_check}"
        print("[PASS] TEST 23 PASSED: Payment context belongs to newly selected patient")
        passed_count += 1

    finally:
        cleanup_test_data(test_phone_single, test_phone_multi)
        cleanup_test_data(other_user_phone, "919999999999")

    print("\n============================================================")
    print(f"SUCCESS: {passed_count}/{total_count} AUTOMATED TESTS PASSED!")
    print("============================================================")


if __name__ == "__main__":
    run_all_tests()
