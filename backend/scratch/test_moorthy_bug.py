import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import agent.agent_service as agent_service
import agent.state_manager as state_manager

def test_moorthy_flow():
    conv_id = "WA_919999955555_moorthy"

    st = state_manager.get_default_state()
    st["conversation_id"] = conv_id
    st["patient_id"] = 9989
    state_manager.save_conversation_state(conv_id, st)

    print("\n--- STEP 1: Book Appointment ---")
    res1 = agent_service.process_agent_message(conv_id, None, "Book Appointment", interactive_id="btn_book_appt")
    print("Response 1:", res1.get("response")[:120])

    print("\n--- STEP 2: Clinical Reason: fever ---")
    res2 = agent_service.process_agent_message(conv_id, None, "fever")
    print("Response 2:", res2.get("response")[:180])
    print("Buttons 2:", [b.get("id") or b.get("title") for b in res2.get("interactive_buttons", [])])

    print("\n--- STEP 3: Doctor Selection: Dr. Moorthy D (btn_doc_1018) ---")
    res3 = agent_service.process_agent_message(conv_id, None, "btn_doc_1018", interactive_id="btn_doc_1018")
    print("Response 3:", res3.get("response")[:250])
    print("Buttons 3:", [b.get("id") or b.get("title") for b in res3.get("interactive_buttons", [])])

    print("\n--- STEP 4a: Patient sends text 'Sat, Sep 19' ---")
    res4a = agent_service.process_agent_message(conv_id, None, "Sat, Sep 19")
    print("Response 4a:\n", res4a.get("response"))
    print("Buttons 4a:", res4a.get("interactive_buttons"))

    # Reset back to step 3 state to test 4b with button tap ID or title
    state_manager.save_conversation_state(conv_id, st)
    agent_service.process_agent_message(conv_id, None, "Book Appointment", interactive_id="btn_book_appt")
    agent_service.process_agent_message(conv_id, None, "fever")
    agent_service.process_agent_message(conv_id, None, "btn_doc_1018", interactive_id="btn_doc_1018")

    print("\n--- STEP 4b: Patient sends button title 'Sat, Sep 19 (16 slots available)' ---")
    res4b = agent_service.process_agent_message(conv_id, None, "Sat, Sep 19 (16 slots available)")
    print("Response 4b:\n", res4b.get("response"))
    print("Buttons 4b:", res4b.get("interactive_buttons"))

if __name__ == "__main__":
    test_moorthy_flow()
