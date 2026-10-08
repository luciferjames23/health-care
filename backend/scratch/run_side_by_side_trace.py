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

def trace_input(conv_id, raw_input):
    print("=" * 80)
    print(f"TRACE FOR INBOUND MESSAGE: '{raw_input}'")
    print("=" * 80)

    # 1. Raw & Normalized input
    normalized_input = raw_input.strip().lower()
    print(f"1. Raw Input        : '{raw_input}'")
    print(f"   Normalized Input : '{normalized_input}'")

    # 2. Reset conversation state to AWAITING_SYMPTOM
    state = state_manager.get_conversation_state(conv_id)
    state["patient_id"] = 1
    state["entities"]["patient_id"] = 1
    state["patient_identification_stage"] = "COMPLETED"
    state["booking_stage"] = "AWAITING_SYMPTOM"
    state["intent"] = "BOOK_APPOINTMENT"
    state_manager.save_conversation_state(conv_id, state)

    # 3. Department list passed to classifier
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, department_name FROM departments WHERE status = 'ACTIVE' ORDER BY id;")
    depts = cur.fetchall()
    print(f"3. Active Departments in DB ({len(depts)} total):")
    dept_names = [f"{d[0]}:{d[1]}" for d in depts[:10]]
    print(f"   Sample: {dept_names} ...")

    # 4. Classifier/Router execution
    print(f"4. Routing execution:")
    rule_route = intent_router.route_patient_message(raw_input, state)
    extracted_dept_name = entity_extractor.map_symptom_to_department_name(raw_input)
    print(f"   Rule-based route output : intent={rule_route.get('intent')}, dept={rule_route.get('department')}, confidence={rule_route.get('confidence')}")
    print(f"   entity_extractor map    : '{extracted_dept_name}'")

    # 5. Handler & Match / Validation
    print(f"5. Handler execution:")
    print(f"   Handler function        : agent_service.process_agent_message -> handle_book_appointment")
    
    row = None
    extracted_dept_id = rule_route.get("department_id")
    if extracted_dept_id:
        cur.execute("SELECT id, department_name FROM departments WHERE id = %s AND UPPER(status) = 'ACTIVE';", (extracted_dept_id,))
        row = cur.fetchone()
    if not row and extracted_dept_name:
        cur.execute("SELECT id, department_name FROM departments WHERE LOWER(department_name) = LOWER(%s) AND UPPER(status) = 'ACTIVE';", (extracted_dept_name,))
        row = cur.fetchone()
    
    if row:
        dept_id, resolved_dept = row[0], row[1]
        print(f"   Match/Validation result  : MATCH FOUND -> dept_id={dept_id}, name='{resolved_dept}'")
    else:
        print(f"   Match/Validation result  : NO MATCH -> FALLBACK TRIGGERED: SELECT id, department_name FROM departments WHERE id = 17")
        cur.execute("SELECT id, department_name FROM departments WHERE id = 17 AND UPPER(status) = 'ACTIVE';")
        row = cur.fetchone()
        dept_id, resolved_dept = row[0], row[1]
        print(f"   Fallback result          : dept_id={dept_id}, name='{resolved_dept}' (General Medicine)")

    # 6. Doctor query executed
    doc_query = f"SELECT id, display_name, specialization FROM doctors WHERE department_id = {dept_id} AND UPPER(status) = 'ACTIVE' ORDER BY id;"
    cur.execute("SELECT id, display_name, specialization FROM doctors WHERE department_id = %s AND UPPER(status) = 'ACTIVE' ORDER BY id;", (dept_id,))
    docs = cur.fetchall()
    print(f"6. Doctor query executed   : {doc_query}")
    print(f"   Doctors returned ({len(docs)}): {[d[1] for d in docs]}")

    # 7. Agent Response
    res = agent_service.process_agent_message(conv_id, None, raw_input)
    print(f"7. Response Template Used  : Location A (agent_service.py line 9643)")
    print(f"   Full Message Response   :")
    print("-" * 40)
    print(res.get('response', '').encode('ascii', 'replace').decode('ascii'))
    print("-" * 40)
    print("\n")
    cur.close()
    conn.close()

if __name__ == "__main__":
    trace_input("trace_knee", "Knee")
    trace_input("trace_knee_pain", "Knee pain")
