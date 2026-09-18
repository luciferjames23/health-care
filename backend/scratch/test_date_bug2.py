import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import agent.agent_service as agent_service
import agent.state_manager as state_manager

def test_santhosh_flow():
    conv_id = "WA_919999977777_test"
    
    st = state_manager.get_default_state()
    st["conversation_id"] = conv_id
    st["patient_id"] = 9989
    state_manager.save_conversation_state(conv_id, st)

    print("\n--- STEP 1: Book Appointment ---")
    res1 = agent_service.process_agent_message(conv_id, None, "Book Appointment", interactive_id="btn_book_appt")

    print("\n--- STEP 2: Clinical Reason: hair fall ---")
    res2 = agent_service.process_agent_message(conv_id, None, "hair fall")

    print("\n--- STEP 3: Doctor Selection: Dr. Santhosh Kumar k (btn_doc_1016) ---")
    res3 = agent_service.process_agent_message(conv_id, None, "btn_doc_1016", interactive_id="btn_doc_1016")
    print("Response 3:", res3.get("response")[:200])

    print("\n--- STEP 4: Patient sends text 'Sat, Sep 19' ---")
    res4 = agent_service.process_agent_message(conv_id, None, "Sat, Sep 19")
    print("Response 4:", res4.get("response"))
    print("Intent 4:", res4.get("intent"))
    print("Buttons 4:", res4.get("interactive_buttons"))

if __name__ == "__main__":
    test_santhosh_flow()
