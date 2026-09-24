import os
import sys
import json

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")
import agent.agent_service as agent_service
import agent.state_manager as state_manager

os.environ["SKIP_REMOTE_LLM"] = "true"

def run_test(text_input):
    conv_id = f"WA_debug_dermo_text_{hash(text_input)}"
    state = state_manager.get_conversation_state(conv_id)
    state["patient_id"] = 100008
    state["patient_identification_stage"] = "COMPLETED"
    state_manager.save_conversation_state(conv_id, state)

    print(f"\n==================================================")
    print(f"TESTING TEXT INPUT AT STEP 3: '{text_input}'")
    print(f"==================================================")
    
    # Step 1: Hair fall
    r1 = agent_service.process_agent_message(conv_id, "P100008", "I have severe hair fall")
    
    # Step 2: Doctor button
    first_doc_btn = "btn_doc_1016"
    for b in r1.get("interactive_buttons", []):
        if "santhosh" in b.get("title", "").lower():
            first_doc_btn = b.get("id")
            
    r2 = agent_service.process_agent_message(conv_id, "P100008", first_doc_btn, interactive_id=first_doc_btn)
    
    state = state_manager.get_conversation_state(conv_id)
    print(f"State BEFORE date text: state={state.get('conversation_state')}, doctor_id={state.get('selected_doctor_id')}, entities={state.get('entities')}")
    
    # Step 3: Text message input for date
    r3 = agent_service.process_agent_message(conv_id, "P100008", text_input)
    print(f"Response to date text '{text_input}':")
    print(r3.get("response"))
    print("Buttons returned:", [b["id"] for b in r3.get("interactive_buttons", [])])
    
    state = state_manager.get_conversation_state(conv_id)
    print(f"State AFTER date text: state={state.get('conversation_state')}, doctor_id={state.get('selected_doctor_id')}, entities={state.get('entities')}")

run_test("Fri, Sep 25")
run_test("Fri, Sep 25 (16 slots available)")
run_test("25/09/2026")
run_test("2026-09-25")
