import sys
import os
import json

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import agent.agent_service as agent_service
import agent.state_manager as state_manager
import agent.entity_extractor as entity_extractor
import agent.intent_router as intent_router

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(str(text).encode("ascii", "backslashreplace").decode("ascii"))

def run_single_verify(test_group, conv_code, message_text):
    state = state_manager.get_conversation_state(conv_code)
    state["patient_id"] = 1
    state["entities"]["patient_id"] = 1
    state["patient_identification_stage"] = "COMPLETED"
    state["booking_stage"] = "AWAITING_SYMPTOM"
    state["intent"] = "BOOK_APPOINTMENT"
    state_manager.save_conversation_state(conv_code, state)

    route = intent_router.route_patient_message(message_text, state)
    res = agent_service.process_agent_message(conv_code, None, message_text)
    
    resp_clean = res.get('response', '').encode('ascii', 'backslashreplace').decode('ascii')
    dept_chosen = state.get("selected_department_name") or state.get("department_name") or route.get("department") or "None (Clarifying)"
    confidence = route.get("confidence", 0.0)
    buttons = res.get("interactive_buttons", [])
    
    safe_print(f"[{test_group}] Input: '{message_text}'")
    safe_print(f"  -> Dept Chosen : {dept_chosen}")
    safe_print(f"  -> Confidence  : {confidence}")
    safe_print(f"  -> Code Path   : process_agent_message (BOOK_APPOINTMENT_HANDLER)")
    safe_print(f"  -> Buttons     : {buttons}")
    safe_print(f"  -> Response    :\n{resp_clean}\n")
    return {
        "input": message_text,
        "dept": dept_chosen,
        "confidence": confidence,
        "buttons": buttons,
        "response": resp_clean
    }

def main():
    safe_print("=" * 80)
    safe_print("PHASE 3 VERIFICATION SUITE")
    safe_print("=" * 80)

    # 1. Single words
    safe_print("\n--- 1. SINGLE WORDS ---")
    single_words = ["Knee", "Chest", "Breathing", "Ear", "Skin", "Eye", "Back", "Head", "Stomach", "Teeth", "Heart", "Fever"]
    for i, w in enumerate(single_words):
        run_single_verify("SingleWord", f"verify_single_{i}", w)

    # 2. Full phrases
    safe_print("\n--- 2. FULL PHRASES ---")
    full_phrases = ["Knee pain", "Chest pain", "Breathing difficulty", "Ear pain", "Skin rash", "Eye pain", "Back pain", "Headache", "Stomach pain", "Toothache"]
    for i, p in enumerate(full_phrases):
        run_single_verify("FullPhrase", f"verify_phrase_{i}", p)

    # 3. Corona virus / COVID
    safe_print("\n--- 3. CORONA / COVID ---")
    for i, c in enumerate(["Corona virus", "COVID"]):
        run_single_verify("CoronaCOVID", f"verify_corona_{i}", c)

    # 4. Tamil & Hindi equivalents
    safe_print("\n--- 4. TAMIL & HINDI EQUIVALENTS ---")
    multilingual = [
        ("முழங்கால் வலி", "Knee Pain (Tamil)"),
        ("நெஞ்சு வலி", "Chest Pain (Tamil)"),
        ("மூச்சு திணறல்", "Breathing Difficulty (Tamil)"),
        ("காது வலி", "Ear Pain (Tamil)"),
        ("காய்ச்சல்", "Fever (Tamil)"),
        ("घुटना दर्द", "Knee Pain (Hindi)"),
        ("सीने में दर्द", "Chest Pain (Hindi)"),
        ("सांस लेने में तकलीफ", "Breathing Difficulty (Hindi)"),
        ("कान में दर्द", "Ear Pain (Hindi)"),
        ("बुखार", "Fever (Hindi)")
    ]
    for i, (m, label) in enumerate(multilingual):
        run_single_verify("Multilingual", f"verify_multi_{i}", m)

    # 5. Ambiguous input
    safe_print("\n--- 5. AMBIGUOUS INPUT ---")
    for i, a in enumerate(["I don't feel well", "pain"]):
        run_single_verify("Ambiguous", f"verify_ambig_{i}", a)

    # 6. Simulated classifier failure / null match
    safe_print("\n--- 6. SIMULATED CLASSIFIER FAILURE / UNKNOWN SYMPTOM ---")
    run_single_verify("ClassifierFail", "verify_fail_1", "xyz123 unmapped symptom")

    # 7. Repeated 5x sequence: Knee -> Knee pain -> Chest
    safe_print("\n--- 7. 5X REPEATED TURN SEQUENCE (Knee -> Knee pain -> Chest) ---")
    seq_conv = "verify_sequence_conv"
    for turn in range(5):
        safe_print(f"\n--- SEQUENCE TURN {turn+1} ---")
        run_single_verify(f"Sequence_Turn{turn+1}", seq_conv, "Knee")
        run_single_verify(f"Sequence_Turn{turn+1}", seq_conv, "Knee pain")
        run_single_verify(f"Sequence_Turn{turn+1}", seq_conv, "Chest")

    # 8. Department doctor list verification against DB
    safe_print("\n--- 8. ALL DEPARTMENTS DOCTOR LIST VERIFICATION ---")
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, department_name FROM departments WHERE UPPER(status) = 'ACTIVE' ORDER BY id;")
    depts = cur.fetchall()
    for dept_id, dept_name in depts:
        cur.execute("SELECT id, display_name FROM doctors WHERE department_id = %s AND UPPER(status) = 'ACTIVE' ORDER BY id;", (dept_id,))
        docs = cur.fetchall()
        doc_names = [d[1] for d in docs]
        safe_print(f"Department ID: {dept_id:2d} | Name: {dept_name:25s} | Active DB Doctors ({len(doc_names)}): {doc_names}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
