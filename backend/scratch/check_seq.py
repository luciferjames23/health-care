import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("SELECT MAX(id) FROM patients;")
max_id = cur.fetchone()[0]
cur.execute("SELECT last_value, is_called FROM patients_id_seq;")
seq_val = cur.fetchone()
print(f"MAX(id): {max_id}, Sequence: {seq_val}")

cur.execute("SELECT id, patient_code FROM patients WHERE patient_code LIKE 'MER-PAT%' ORDER BY id DESC LIMIT 10;")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
