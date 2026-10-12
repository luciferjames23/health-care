import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT d.id, d.doctor_code, d.display_name, d.user_id, u.username
    FROM doctors d
    LEFT JOIN users u ON d.user_id = u.id
    WHERE d.id >= 1000
    LIMIT 20;
""")
print("DOCTORS WITH ID >= 1000:")
for r in cur.fetchall():
    print(" ", r)
cur.close()
conn.close()
