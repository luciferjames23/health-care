import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import agent.agent_service as agent_service
import agent.state_manager as state_manager

def run_fresh_test(conversation_code, message_text):
    print(f"\n=======================================================")
    print(f"FRESH TEST: '{message_text}' on conv '{conversation_code}'")
    print(f"=======================================================")
    
    # Initialize fresh state
    state = state_manager.get_conversation_state(conversation_code)
    state["patient_id"] = 1
    state["entities"]["patient_id"] = 1
    state["patient_identification_stage"] = "COMPLETED"
    state_manager.save_conversation_state(conversation_code, state)

    res = agent_service.process_agent_message(conversation_code, None, message_text)
    resp = res.get('response', '').encode('ascii', 'replace').decode('ascii')
    print(f"RESPONSE:\n{resp}\n")
    print(f"INTENT: {res.get('intent')}")
    print(f"BUTTONS: {res.get('interactive_buttons')}")
    return res

if __name__ == "__main__":
    run_fresh_test("fresh_conv_knee", "Knee")
    run_fresh_test("fresh_conv_knee_pain", "Knee pain")
