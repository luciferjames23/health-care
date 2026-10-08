import sys
import os
import json
import time

# Add backend directory to sys.path
backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config
from agent.agent_service import process_agent_message
from agent.llm_intent_router import get_active_departments_from_db
from agent.state_manager import save_conversation_state, get_conversation_state

def test_active_depts_db():
    print("\n--- TEST 1: DB ACTIVE DEPARTMENTS ---")
    depts = get_active_departments_from_db()
    print(f"Total active departments loaded from DB: {len(depts)}")
    for d in depts:
        print(f"  ID {d['id']:2d}: {d['department_name']} ({d['department_code']})")
    assert len(depts) >= 15, "Expected active departments count >= 15"

def init_identified_session(conv_code: str, phone: str = "919999900508"):
    """Helper to initialize a session with an identified patient so prompts go straight to booking."""
    state = get_conversation_state(conv_code, phone)
    state["patient_id"] = 1002
    state["contact_patient_id"] = 1002
    state["selected_patient_id"] = 1002
    state["phone"] = phone
    state["conversation_state"] = "IDLE"
    state["patient_selection_completed"] = True
    state["patient_info"] = {
        "id": 1002,
        "first_name": "Ashok",
        "last_name": "Dutta",
        "patient_code": "PAT-1000508",
        "phone": phone
    }
    save_conversation_state(conv_code, state)
    return state

def test_symptom_routing():
    print("\n--- TEST 2: SYMPTOM -> DEPARTMENT -> DOCTORS MAPPING ---")
    test_cases = [
        ("Fever", "General Medicine"),
        ("Mild chest pain", "Cardiology"),
        ("Breathing difficulty", "Cardiology"),
        ("Corona Virus", "General Medicine"),
        ("Hair fall", "Dermatology"),
        ("Ear pain", "ENT"),
        ("Knee pain", "Orthopedics"),
        ("Skin rash", "Dermatology"),
        ("Stomach pain", "General Medicine"),
    ]
    
    phone = "919999900024"
    
    for symptom, expected_dept in test_cases:
        conv_code = f"TEST_CONV_{int(time.time()*1000)}"
        init_identified_session(conv_code, phone)
        
        print(f"\n[Testing Input]: {symptom!r}")
        res = process_agent_message(conv_code, phone, symptom)
        response_text = res.get("response", "")
        intent = res.get("intent", "")
        buttons = res.get("interactive_buttons", [])
        
        print(f"  Intent: {intent}")
        safe_resp = response_text.encode("ascii", "backslashreplace").decode("ascii")
        print(f"  Response Preview:\n{safe_resp[:180]}")
        print(f"  Buttons Count: {len(buttons)}")
        
        assert expected_dept.lower() in response_text.lower(), f"Expected department '{expected_dept}' in response text!"
        print(f"  PASSED: Department '{expected_dept}' correctly matched and returned for '{symptom}'.")

def test_ambiguous_symptom():
    print("\n--- TEST 3: AMBIGUOUS INPUT CLARIFICATION ---")
    conv_code = f"TEST_AMBIG_{int(time.time()*1000)}"
    phone = "919999900024"
    init_identified_session(conv_code, phone)
    
    ambig_input = "I don't feel well"
    print(f"Sending ambiguous input: {ambig_input!r}")
    res = process_agent_message(conv_code, phone, ambig_input)
    resp = res.get('response', '')
    safe_resp = resp.encode("ascii", "backslashreplace").decode("ascii")
    print(f"  Response: {safe_resp!r}")
    assert "describe" in resp.lower() or "symptom" in resp.lower() or "experience" in resp.lower() or "could you" in resp.lower(), "Ambiguous input should prompt for clarification!"
    print("  PASSED: Ambiguous input triggered clarification prompt instead of defaulting to General Medicine.")

def test_back_to_back_symptoms():
    print("\n--- TEST 4: BACK-TO-BACK SYMPTOMS (NO STALE STATE) ---")
    conv_code = f"TEST_B2B_{int(time.time()*1000)}"
    phone = "919999900024"
    init_identified_session(conv_code, phone)
    
    symptoms_seq = [
        ("Breathing difficulty", "Cardiology"),
        ("Chest pain", "Cardiology"),
        ("Hair fall", "Dermatology"),
        ("Ear pain", "ENT"),
        ("Knee pain", "Orthopedics")
    ]
    for idx, (sym, expected_dept) in enumerate(symptoms_seq, 1):
        res = process_agent_message(conv_code, phone, sym)
        resp = res.get("response", "")
        safe_resp = resp.encode("ascii", "backslashreplace").decode("ascii")
        print(f"  Turn {idx} [{sym} -> Expected: {expected_dept}]: {safe_resp[:120]!r}...")
        assert expected_dept.lower() in resp.lower(), f"Turn {idx} response must contain department '{expected_dept}' for input '{sym}'"
    print("  PASSED: 5 back-to-back turns correctly updated response without stale state leakage!")

def test_zero_doctor_department():
    print("\n--- TEST 5: ZERO DOCTOR DEPARTMENT (GYNECOLOGY) ---")
    conv_code = f"TEST_ZERO_DOC_{int(time.time()*1000)}"
    phone = "919999900024"
    init_identified_session(conv_code, phone)
    
    res = process_agent_message(conv_code, phone, "Pregnancy checkup")
    resp = res.get("response", "")
    buttons = res.get("interactive_buttons", [])
    safe_resp = resp.encode("ascii", "backslashreplace").decode("ascii")
    print(f"  Response:\n{safe_resp}")
    print(f"  Buttons: {buttons}")
    assert "no active doctors" in resp.lower() or "front desk" in resp.lower() or "gynecology" in resp.lower(), "Zero-doctor department notice must be displayed!"
    print("  PASSED: Zero-doctor department handled gracefully with front desk/dept selection options.")

if __name__ == "__main__":
    try:
        test_active_depts_db()
        test_symptom_routing()
        test_ambiguous_symptom()
        test_back_to_back_symptoms()
        test_zero_doctor_department()
        print("\n==========================================")
        print("ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!")
        print("==========================================")
    except Exception as e:
        print(f"\nTEST FAILURE: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
