import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import agent.agent_service as agent_service
import agent.state_manager as state_manager

def run_test(conversation_code, message_text):
    print(f"\n=======================================================")
    print(f"TESTING MESSAGE: '{message_text}' on conv '{conversation_code}'")
    print(f"=======================================================")
    
    # Initialize state for booking
    state = state_manager.get_conversation_state(conversation_code)
    state["patient_id"] = 1
    state["entities"]["patient_id"] = 1
    state["patient_identification_stage"] = "COMPLETED"
    state["booking_stage"] = "AWAITING_SYMPTOM"
    state["intent"] = "BOOK_APPOINTMENT"
    state_manager.save_conversation_state(conversation_code, state)

    res = agent_service.process_agent_message(conversation_code, None, message_text)
    print(f"RESPONSE:\n{res.get('response')}\n")
    print(f"INTENT: {res.get('intent')}")
    print(f"BUTTONS: {res.get('interactive_buttons')}")
    return res

if __name__ == "__main__":
    run_test("test_conv_knee_1", "Knee")
    run_test("test_conv_knee_2", "Knee pain")
