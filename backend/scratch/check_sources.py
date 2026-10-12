import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT DISTINCT booking_source, COUNT(*) FROM appointments GROUP BY booking_source ORDER BY count DESC;")
print("DISTINCT BOOKING SOURCES:")
for r in cur.fetchall():
    print(" ", r)
cur.close()
conn.close()
