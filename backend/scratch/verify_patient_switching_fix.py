import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import db_config
from agent.agent_service import process_agent_message
from agent.state_manager import get_conversation_state, save_conversation_state

CONV_CODE = "WA_8072851813_TEST"

def setup_test_patients():
    """Ensure Gil Christ (P9989) and John Peter (P1000061) both exist under phone 8072851813."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # Check / insert Gil Christ (P9989)
        cur.execute("SELECT id FROM patients WHERE id = 9989 OR patient_code = 'P9989';")
        r1 = cur.fetchone()
        if not r1:
            cur.execute("""
                INSERT INTO patients (id, patient_code, first_name, last_name, phone, whatsapp_number, date_of_birth, gender, status, created_at, updated_at)
                VALUES (9989, 'P9989', 'Gil', 'Christ', '8072851813', '8072851813', '2004-09-08', 'Male', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """)
        else:
            cur.execute("UPDATE patients SET whatsapp_number = '8072851813', phone = '8072851813', first_name = 'Gil', last_name = 'Christ' WHERE id = %s;", (r1[0],))

        # Check / insert John Peter (P1000061 / 1000061)
        cur.execute("SELECT id FROM patients WHERE id = 1000061 OR patient_code = 'P1000061';")
        r2 = cur.fetchone()
        if not r2:
            cur.execute("""
                INSERT INTO patients (id, patient_code, first_name, last_name, phone, whatsapp_number, date_of_birth, gender, status, created_at, updated_at)
                VALUES (1000061, 'P1000061', 'John', 'Peter', '8072851813', '8072851813', '1985-05-12', 'Male', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """)
        else:
            cur.execute("UPDATE patients SET whatsapp_number = '8072851813', phone = '8072851813', first_name = 'John', last_name = 'Peter' WHERE id = %s;", (r2[0],))

        conn.commit()
    finally:
        cur.close()
        conn.close()

def run_multi_patient_verification():
    print("==================================================")
    print("Verifying Multi-Patient Switching & Context Bug Fix")
    print("==================================================")

    setup_test_patients()

    # Reset conversation state for clean test
    state = get_conversation_state(CONV_CODE, "8072851813")
    state["selected_patient_id"] = None
    state["patient_id"] = None
    state["payment_context"] = None
    save_conversation_state(CONV_CODE, state)

    # 1. Start by requesting profile or booking -> should prompt patient selection for 8072851813
    r1 = process_agent_message(CONV_CODE, "8072851813", "book appointment")
    print("\n[STEP 1] 'book appointment' -> Response:")
    print(r1["response"])
    assert "btn_select_pat_9989" in [b.get("id") for b in r1.get("interactive_buttons", [])] or any("Gil Christ" in b.get("title", "") for b in r1.get("interactive_buttons", [])), "Patient selection buttons missing!"

    # 2. Select Gil Christ (9989)
    r2 = process_agent_message(CONV_CODE, "8072851813", "btn_select_pat_9989")
    print("\n[STEP 2] Select Gil Christ (9989) -> Response:")
    print(r2["response"])

    st2 = get_conversation_state(CONV_CODE, "8072851813")
    print(f"Current State: selected_patient_id = {st2.get('selected_patient_id')}, patient_id = {st2.get('patient_id')}")
    assert st2.get("selected_patient_id") == 9989, f"Expected selected_patient_id=9989, got {st2.get('selected_patient_id')}"
    assert st2.get("patient_id") == 9989, f"Expected patient_id=9989, got {st2.get('patient_id')}"

    # 3. Enter symptom: "Fever"
    r3 = process_agent_message(CONV_CODE, "8072851813", "Fever")
    print("\n[STEP 3] Symptom 'Fever' -> Response:")
    print(r3["response"])

    # Doctor Selection (Buttons are in r3 interactive_buttons)
    doc_btn = r3.get("interactive_buttons", [])[0]["id"]
    r5 = process_agent_message(CONV_CODE, "8072851813", doc_btn)
    print("\n[STEP 4] Select Doctor -> Response:")
    print(r5["response"])

    # Select Date
    date_btn = [b for b in r5.get("interactive_buttons", []) if "btn_date_" in b.get("id", "")][0]["id"]
    r6 = process_agent_message(CONV_CODE, "8072851813", date_btn)
    print("\n[STEP 5] Select Date -> Response:")
    print(r6["response"])

    # Select Time Slot
    slot_btn = [b for b in r6.get("interactive_buttons", []) if "btn_slot_" in b.get("id", "")][0]["id"]
    r7 = process_agent_message(CONV_CODE, "8072851813", slot_btn)
    print("\n[STEP 6] Select Time Slot -> Confirmation Screen Response:")
    print(r7["response"])
    assert "Gil Christ" in r7["response"] or "P9989" in r7["response"], f"Confirmation screen does not show Gil Christ P9989! Response:\n{r7['response']}"

    # 5. Tap "Confirm Appointment" (`btn_confirm_appt`)
    r8 = process_agent_message(CONV_CODE, "8072851813", "btn_confirm_appt")
    print("\n[STEP 7] Confirm Appointment -> Payment Method Options:")
    print(r8["response"])

    # 6. Tap "Google Pay" (`btn_pay_gpay`)
    r9 = process_agent_message(CONV_CODE, "8072851813", "btn_pay_gpay")
    print("\n[STEP 8] Select Google Pay -> Mock Payment Prompt:")
    print(r9["response"])

    # CRITICAL CHECK: Must NOT show "This bill has already been paid in full" or "John Peter"!
    assert "paid in full" not in r9["response"], f"CRITICAL FAILURE: Payment method handler triggered paid bill prompt!\n{r9['response']}"
    assert "John Peter" not in r9["response"], f"CRITICAL FAILURE: Payment prompt showed John Peter!\n{r9['response']}"

    st9 = get_conversation_state(CONV_CODE, "8072851813")
    print(f"State after Google Pay: selected_patient_id = {st9.get('selected_patient_id')}, patient_id = {st9.get('patient_id')}")
    assert st9.get("selected_patient_id") == 9989, f"Context corruption! selected_patient_id changed to {st9.get('selected_patient_id')}"

    # 7. Execute Mock Payment (`btn_pay_exec`)
    r10 = process_agent_message(CONV_CODE, "8072851813", "btn_pay_exec")
    print("\n[STEP 9] Execute Payment -> Final Appointment Result:")
    print(r10["response"])

    assert "Gil Christ" in r10["response"], f"Final appointment response missing Gil Christ!\n{r10['response']}"
    assert "John Peter" not in r10["response"], f"Final response showed John Peter!\n{r10['response']}"

    # 8. Test "Switch Patient" -> Select John Peter
    r11 = process_agent_message(CONV_CODE, "8072851813", "switch patient")
    print("\n[STEP 10] 'switch patient' -> Prompt:")
    print(r11["response"])

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id FROM patients WHERE patient_code = 'P1000061' OR (first_name = 'John' AND last_name = 'Peter') LIMIT 1;")
    john_db_id = cur.fetchone()[0]
    cur.close()
    conn.close()

    r12 = process_agent_message(CONV_CODE, "8072851813", f"btn_select_pat_{john_db_id}")
    print(f"\n[STEP 11] Select John Peter ({john_db_id}) -> Profile:")
    print(r12["response"])
    assert "John Peter" in r12["response"], f"Profile response missing John Peter!\n{r12['response']}"

    st12 = get_conversation_state(CONV_CODE, "8072851813")
    assert st12.get("selected_patient_id") == john_db_id, f"Expected selected_patient_id={john_db_id}, got {st12.get('selected_patient_id')}"

    # 9. Switch back to Gil Christ (9989)
    r13 = process_agent_message(CONV_CODE, "8072851813", "switch patient")
    r14 = process_agent_message(CONV_CODE, "8072851813", "btn_select_pat_9989")
    print("\n[STEP 12] Switch back to Gil Christ (9989) -> Profile:")
    print(r14["response"])
    assert "Gil Christ" in r14["response"], f"Profile response missing Gil Christ!\n{r14['response']}"

    st14 = get_conversation_state(CONV_CODE, "8072851813")
    assert st14.get("selected_patient_id") == 9989, f"Expected selected_patient_id=9989, got {st14.get('selected_patient_id')}"

    print("\n==================================================")
    print("✅ ALL MULTI-PATIENT CONTEXT VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_multi_patient_verification()
