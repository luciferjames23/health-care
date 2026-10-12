import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT u.id, u.username, r.name, u.staff_name, u.email, u.phone, u.department_id
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY u.id;
""")
print(f"TOTAL USERS: {cur.rowcount}")
for row in cur.fetchall():
    print(f"  {row}")
cur.close()
conn.close()
