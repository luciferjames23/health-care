import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import agent.agent_service as agent_service
import agent.state_manager as state_manager

def run_suite():
    print("=== TESTING ALL DOCTORS AND DATES ===")

    conv_id = "WA_919999944444_suite"

    # Test 1: Dr. Moorthy D on Fri, Sat, Sun, Mon
    for d_str in ["Fri, Sep 18", "Sat, Sep 19", "Sun, Sep 20", "Mon, Sep 21"]:
        st = state_manager.get_default_state()
        st["conversation_id"] = conv_id
        st["patient_id"] = 9989
        state_manager.save_conversation_state(conv_id, st)

        agent_service.process_agent_message(conv_id, None, "Book Appointment", interactive_id="btn_book_appt")
        agent_service.process_agent_message(conv_id, None, "fever")
        agent_service.process_agent_message(conv_id, None, "btn_doc_1018", interactive_id="btn_doc_1018")
        
        res = agent_service.process_agent_message(conv_id, None, d_str)
        resp = res.get("response", "")
        print(f"\n[Dr. Moorthy D - {d_str}]:")
        print("Snippet:", resp[:180])
        assert "Dr. Moorthy D" in resp, f"Doctor lost for {d_str}: {resp}"
        assert "General Medicine" in resp, f"Department lost for {d_str}: {resp}"
        assert "General consultation" not in resp, f"FAIL: Routed to General consultation for {d_str}!"

    # Test 2: Second Doctor - Dr. Arun Kumar (1005)
    st = state_manager.get_default_state()
    st["conversation_id"] = conv_id
    st["patient_id"] = 9989
    state_manager.save_conversation_state(conv_id, st)

    agent_service.process_agent_message(conv_id, None, "Book Appointment", interactive_id="btn_book_appt")
    agent_service.process_agent_message(conv_id, None, "fever")
    agent_service.process_agent_message(conv_id, None, "btn_doc_1005", interactive_id="btn_doc_1005")
    res_arun = agent_service.process_agent_message(conv_id, None, "Mon, Sep 21")
    resp_arun = res_arun.get("response", "")
    print(f"\n[Dr. Arun Kumar - Mon, Sep 21]:")
    print("Snippet:", resp_arun[:180])
    assert "Dr. Arun Kumar" in resp_arun, f"Doctor mismatch for Dr. Arun Kumar: {resp_arun}"
    assert "General Medicine" in resp_arun, f"Department mismatch: {resp_arun}"

    # Test 3: Second Department - Cardiology (Dr. Edwin Stephano J - 1017)
    st = state_manager.get_default_state()
    st["conversation_id"] = conv_id
    st["patient_id"] = 9989
    state_manager.save_conversation_state(conv_id, st)

    agent_service.process_agent_message(conv_id, None, "Book Appointment", interactive_id="btn_book_appt")
    agent_service.process_agent_message(conv_id, None, "chest pain")
    agent_service.process_agent_message(conv_id, None, "btn_doc_1017", interactive_id="btn_doc_1017")
    res_card = agent_service.process_agent_message(conv_id, None, "Fri, Sep 18")
    resp_card = res_card.get("response", "")
    print(f"\n[Dr. Edwin Stephano J - Fri, Sep 18]:")
    print("Snippet:", resp_card[:180])
    assert "Dr. Edwin Stephano J" in resp_card, f"Doctor mismatch for Dr. Edwin Stephano J: {resp_card}"
    assert "Cardiology" in resp_card, f"Department mismatch: {resp_card}"

    print("\n==================================================")
    print("ALL TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == "__main__":
    run_suite()
