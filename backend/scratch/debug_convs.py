import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from utils.phone_utils import normalize_phone

def main():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, conversation_code, whatsapp_number, conversation_status, created_at, updated_at
            FROM conversations
            WHERE whatsapp_number LIKE '%5556698871%' OR conversation_code LIKE '%5556698871%'
            ORDER BY id DESC LIMIT 10;
        """)
        rows = cur.fetchall()
        print("Latest conversations for 15556698871 in DB:")
        for r in rows:
            print(f"ID={r[0]}, Code={r[1]}, WA_Num='{r[2]}', Status={r[3]}, Updated={r[5]}")

        w_num = "15556698871"
        norm_wnum = normalize_phone(w_num)
        print(f"\nQuerying active conv for '{w_num}' (norm='{norm_wnum}'):")
        cur.execute("""
            SELECT id, conversation_code, last_message_at, whatsapp_number, conversation_status FROM conversations 
            WHERE (
                whatsapp_number = %s OR 
                (whatsapp_number IS NOT NULL AND RIGHT(REGEXP_REPLACE(whatsapp_number, '[^0-9]', '', 'g'), 10) = %s AND %s <> '')
            ) AND conversation_status = 'ACTIVE'
            ORDER BY id DESC LIMIT 1;
        """, (w_num, norm_wnum, norm_wnum))
        r = cur.fetchone()
        print(f"Result: {r}")

    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
