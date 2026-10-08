import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT id, department_name FROM departments WHERE UPPER(status) = 'ACTIVE' ORDER BY id;")
depts = cur.fetchall()
print(f"Active Departments in DB ({len(depts)} total):")
for d in depts:
    cur.execute("SELECT COUNT(*) FROM doctors WHERE department_id = %s AND UPPER(status) = 'ACTIVE';", (d[0],))
    doc_cnt = cur.fetchone()[0]
    print(f"  ID: {d[0]:2d} | Name: {d[1]:25s} | Active Doctors: {doc_cnt}")

cur.close()
conn.close()
