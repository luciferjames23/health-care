import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT ds.doctor_id, d.display_name, ds.day_of_week, ds.start_time, ds.end_time, ds.status
    FROM doctor_schedules ds
    JOIN doctors d ON ds.doctor_id = d.id
    WHERE ds.status = 'ACTIVE'
    LIMIT 10;
""")
print("ACTIVE DOCTOR SCHEDULES:")
for r in cur.fetchall():
    print(" ", r)
cur.close()
conn.close()
