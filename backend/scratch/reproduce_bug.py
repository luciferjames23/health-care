import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from agent.agent_service import process_agent_message

def setup_test_patient():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, phone, whatsapp_number FROM patients WHERE id = 9989 OR patient_code = 'P9989';")
        r = cur.fetchone()
        if r:
            cur.execute("""
                UPDATE patients 
                SET phone = '+1 (555) 669-8871', whatsapp_number = '15556698871' 
                WHERE id = %s;
            """, (r[0],))
            conn.commit()
            return r[0]
        else:
            cur.execute("""
                INSERT INTO patients (id, patient_code, first_name, last_name, phone, whatsapp_number, date_of_birth, gender, status)
                VALUES (9989, 'P9989', 'Gil', 'Christ', '+1 (555) 669-8871', '15556698871', '1988-05-12', 'Male', 'ACTIVE')
                ON CONFLICT (id) DO UPDATE SET phone = '+1 (555) 669-8871', whatsapp_number = '15556698871'
                RETURNING id;
            """)
            conn.commit()
            return 9989
    finally:
        cur.close()
        conn.close()

def run_simulation():
    pat_id = setup_test_patient()
    session_code = "WA_15556698871"

    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM conversations WHERE conversation_code = %s;", (session_code,))
        conn.commit()
    finally:
        cur.close()
        conn.close()

    print("\n--- STEP 1: Patient sends 'Hey' ---")
    res1 = process_agent_message(session_code, None, "Hey")
    print(f"Response 1:\n{res1.get('response')}\nButtons: {[b.get('title') if isinstance(b, dict) else b for b in res1.get('interactive_buttons', [])]}")

    print("\n--- STEP 2: Patient selects 'My Health & Records' ---")
    res2 = process_agent_message(session_code, None, "My Health & Records", interactive_id="btn_cat_health")
    print(f"Response 2:\n{res2.get('response')}\nButtons: {[b.get('title') if isinstance(b, dict) else b for b in res2.get('interactive_buttons', [])]}")

    print("\n--- STEP 3: Patient selects 'My Profile' ---")
    res3 = process_agent_message(session_code, None, "My Profile", interactive_id="btn_my_profile")
    print(f"Response 3:\n{res3.get('response')}\nButtons: {[b.get('title') if isinstance(b, dict) else b for b in res3.get('interactive_buttons', [])]}")

if __name__ == "__main__":
    run_simulation()
