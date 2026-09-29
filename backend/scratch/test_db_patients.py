import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

def main():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, patient_code, first_name, last_name, phone, whatsapp_number, status 
            FROM patients 
            WHERE first_name ILIKE '%Gil%' OR first_name ILIKE '%John%' OR first_name ILIKE '%Anitha%'
               OR last_name ILIKE '%Christ%' OR last_name ILIKE '%David%'
               OR patient_code IN ('P9989', 'P2666', 'P100009')
               OR phone LIKE '%669%' OR whatsapp_number LIKE '%669%'
               OR phone LIKE '%8871%' OR whatsapp_number LIKE '%8871%';
        """)
        rows = cur.fetchall()
        print(f"Matching patients in DB ({len(rows)}):")
        for r in rows:
            print(f"ID={r[0]}, Code={r[1]}, Name={r[2]} {r[3]}, Phone='{r[4]}', WA='{r[5]}', Status={r[6]}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
