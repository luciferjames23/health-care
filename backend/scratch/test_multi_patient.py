import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from agent.agent_service import process_agent_message

def setup_multi_patients():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # Patient 1: Gil Christ (P9989)
        cur.execute("""
            INSERT INTO patients (id, patient_code, first_name, last_name, phone, whatsapp_number, date_of_birth, gender, preferred_language, registration_date, status)
            VALUES (9989, 'P9989', 'Gil', 'Christ', '+1 (555) 669-8871', '15556698871', '1988-05-12', 'Male', 'ENGLISH', CURRENT_DATE, 'ACTIVE')
            ON CONFLICT (id) DO UPDATE SET phone = '+1 (555) 669-8871', whatsapp_number = '15556698871', status = 'ACTIVE';
        """)
        # Patient 2: John David (P2666)
        cur.execute("""
            INSERT INTO patients (id, patient_code, first_name, last_name, phone, whatsapp_number, date_of_birth, gender, preferred_language, registration_date, status)
            VALUES (2666, 'P2666', 'John', 'David', '+1 (555) 669-8871', '15556698871', '1990-01-01', 'Male', 'ENGLISH', CURRENT_DATE, 'ACTIVE')
            ON CONFLICT (id) DO UPDATE SET phone = '+1 (555) 669-8871', whatsapp_number = '15556698871', status = 'ACTIVE';
        """)
        conn.commit()
    finally:
        cur.close()
        conn.close()

def run_multi_test():
    setup_multi_patients()
    session_code = "WA_15556698871"

    # Reset conversations
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM conversations WHERE conversation_code = %s;", (session_code,))
        conn.commit()
    finally:
        cur.close()
        conn.close()

    print("\n=== MULTI-PATIENT TEST ===")

    print("\n--- STEP 1: User sends 'Hey' ---")
    res1 = process_agent_message(session_code, None, "Hey")
    print(f"Response 1:\n{res1.get('response')}\nButtons: {[b.get('title') if isinstance(b, dict) else b.get('id') if isinstance(b, dict) else b for b in res1.get('interactive_buttons', [])]}")

    print("\n--- STEP 2: User selects 'My Health & Records' ---")
    res2 = process_agent_message(session_code, None, "My Health & Records", interactive_id="btn_cat_health")
    print(f"Response 2:\n{res2.get('response')}\nButtons: {[b.get('title') if isinstance(b, dict) else b.get('id') if isinstance(b, dict) else b for b in res2.get('interactive_buttons', [])]}")

    print("\n--- STEP 3: User selects 'My Profile' ---")
    res3 = process_agent_message(session_code, None, "My Profile", interactive_id="btn_my_profile")
    print(f"Response 3:\n{res3.get('response')}\nButtons: {[b.get('title') if isinstance(b, dict) else b.get('id') if isinstance(b, dict) else b for b in res3.get('interactive_buttons', [])]}")

    print("\n--- STEP 4: User selects John David (btn_select_pat_2666) ---")
    res4 = process_agent_message(session_code, None, "John David — P2666", interactive_id="btn_select_pat_2666")
    print(f"Response 4:\n{res4.get('response')}\nButtons: {[b.get('title') if isinstance(b, dict) else b.get('id') if isinstance(b, dict) else b for b in res4.get('interactive_buttons', [])]}")

if __name__ == "__main__":
    run_multi_test()
