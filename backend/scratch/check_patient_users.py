import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT u.id, u.username, r.name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE LOWER(r.name) = 'patient';
""")
print("PATIENT USERS IN DB:", cur.fetchall())

cur.execute("""
    SELECT p.id, p.patient_code, p.first_name, p.phone
    FROM patients p
    LIMIT 5;
""")
print("SAMPLE PATIENTS:", cur.fetchall())

cur.close()
conn.close()
