import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from agent.patient_identification_service import get_all_patients_by_phone
from utils.phone_utils import extract_whatsapp_number, normalize_phone

def inspect_db():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        print("=== PATIENTS TABLE ===")
        cur.execute("""
            SELECT id, patient_code, first_name, last_name, phone, whatsapp_number, status 
            FROM patients 
            WHERE phone LIKE '%5556698871%' OR whatsapp_number LIKE '%5556698871%'
               OR phone LIKE '%6698871%' OR whatsapp_number LIKE '%6698871%'
               OR phone LIKE '%669-8871%' OR whatsapp_number LIKE '%669-8871%';
        """)
        rows = cur.fetchall()
        print(f"Found {len(rows)} matching patients in PostgreSQL:")
        for r in rows:
            print(f"  ID={r[0]}, Code={r[1]}, Name={r[2]} {r[3]}, Phone='{r[4]}', WA='{r[5]}', Status={r[6]}")

        print("\n=== CONVERSATIONS TABLE ===")
        cur.execute("""
            SELECT id, conversation_code, patient_id, whatsapp_number, conversation_status, updated_at
            FROM conversations
            WHERE whatsapp_number LIKE '%5556698871%' OR conversation_code LIKE '%6698871%' OR conversation_code LIKE '%1555%'
            ORDER BY id DESC LIMIT 10;
        """)
        c_rows = cur.fetchall()
        print(f"Found {len(c_rows)} conversations:")
        for c in c_rows:
            print(f"  ID={c[0]}, Code={c[1]}, PatientID={c[2]}, WA_Num='{c[3]}', Status={c[4]}, Updated={c[5]}")

        print("\n=== TEST PATIENT LOOKUP FOR METAS SENDER FORMATS ===")
        test_senders = ["15556698871", "+1 (555) 669-8871", "+15556698871", "5556698871", "1 (555) 669-8871"]
        for s in test_senders:
            pats = get_all_patients_by_phone(s)
            print(f"Sender '{s}' -> found {len(pats)} patients: {[p['id'] for p in pats]}")

    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    inspect_db()
