import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT u.id, u.username, u.role_id, u.patient_id, u.first_name, u.last_name, u.email, u.phone, u.password_hash
    FROM users u
    WHERE u.role_id = 8 OR u.patient_id IS NOT NULL;
""")
users = cur.fetchall()
print("Patient users in users table:")
for u in users:
    print(dict(u))

# Also check patient records corresponding to these patient_ids
pids = [u['patient_id'] for u in users if u['patient_id']]
if pids:
    cur.execute("SELECT id, patient_code, first_name, last_name, phone, email FROM patients WHERE id IN %s;", (tuple(pids),))
    print("\nCorresponding patients:")
    for p in cur.fetchall():
        print(dict(p))

cur.close()
conn.close()
