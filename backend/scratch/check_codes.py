import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

print("--- RECENT PATIENT CODES ---")
cur.execute("SELECT id, patient_code, first_name, last_name, phone, whatsapp_number, created_at FROM patients ORDER BY id DESC LIMIT 15;")
for r in cur.fetchall():
    print(r)

print("\n--- SAMPLE PATIENT CODES LIKE MER-PAT ---")
cur.execute("SELECT id, patient_code FROM patients WHERE patient_code LIKE 'MER-PAT%' ORDER BY id DESC LIMIT 5;")
for r in cur.fetchall():
    print(r)

print("\n--- SAMPLE PATIENT CODES LIKE P0% ---")
cur.execute("SELECT id, patient_code FROM patients WHERE patient_code ~ '^P[0-9]+' ORDER BY id DESC LIMIT 5;")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
