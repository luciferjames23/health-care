import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

def check_opd():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(DISTINCT doctor_id) FROM appointments;")
    print("Unique doctors with appointments:", cur.fetchone()[0])
    cur.execute("SELECT COUNT(*) FROM doctors;")
    print("Total doctors in doctors table:", cur.fetchone()[0])
    cur.close()
    conn.close()

if __name__ == '__main__':
    check_opd()
