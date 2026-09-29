import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import agent.agent_service as agent_service
import agent.state_manager as state_manager

def test_user_flow():
    conv_id = "WA_919999988888_test"
    
    # Reset state
    st = state_manager.get_default_state()
    st["conversation_id"] = conv_id
    st["patient_id"] = 9989
    state_manager.save_conversation_state(conv_id, st)

    print("\n--- STEP 1: Book Appointment ---")
    res1 = agent_service.process_agent_message(conv_id, None, "Book Appointment", interactive_id="btn_book_appt")
    print("Response 1:", res1.get("response")[:120])
    print("Buttons 1:", [b.get("title") for b in res1.get("interactive_buttons", [])])

    print("\n--- STEP 2: Clinical Reason: hair fall ---")
    res2 = agent_service.process_agent_message(conv_id, None, "hair fall")
    print("Response 2:", res2.get("response")[:150])
    print("Buttons 2:", [b.get("id") for b in res2.get("interactive_buttons", [])])

    # Find doctor ID for Dr. Santhosh Kumar K
    doc_btn_id = None
    for b in res2.get("interactive_buttons", []):
        if "btn_doc_" in b.get("id", ""):
            doc_btn_id = b["id"]
            break
    print("Doctor Button ID found:", doc_btn_id)

    if not doc_btn_id:
        doc_btn_id = "btn_doc_2" # Fallback if ID is 2

    print(f"\n--- STEP 3: Doctor Selection: {doc_btn_id} ---")
    res3 = agent_service.process_agent_message(conv_id, None, doc_btn_id, interactive_id=doc_btn_id)
    print("Response 3:", res3.get("response")[:200])
    print("Buttons 3:", [b.get("id") or b.get("title") for b in res3.get("interactive_buttons", [])])

    print("\n--- STEP 4: Patient selects date 'Sat, Sep 19' ---")
    res4 = agent_service.process_agent_message(conv_id, None, "Sat, Sep 19")
    print("Response 4:", res4.get("response"))
    print("Buttons 4:", res4.get("interactive_buttons"))

if __name__ == "__main__":
    test_user_flow()
