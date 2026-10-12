import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

def check_queue():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM queue_entries;")
    print("Total queue entries:", cur.fetchone()[0])
    cur.execute("SELECT appointment_id, COUNT(*) FROM queue_entries GROUP BY appointment_id HAVING COUNT(*) > 1 LIMIT 5;")
    dups = cur.fetchall()
    print("Duplicate appointment_id in queue_entries:", dups)
    cur.close()
    conn.close()

if __name__ == '__main__':
    check_queue()
