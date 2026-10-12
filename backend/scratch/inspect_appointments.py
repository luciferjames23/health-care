import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

def inspect():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'doctors' ORDER BY ordinal_position;")
    print("DOCTORS COLUMNS:")
    for col in cur.fetchall():
        print(f"  {col[0]}: {col[1]}")

    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'appointments' ORDER BY ordinal_position;")
    print("\nAPPOINTMENTS COLUMNS:")
    for col in cur.fetchall():
        print(f"  {col[0]}: {col[1]}")

    cur.execute("SELECT id, user_id, doctor_code, display_name, specialization, department_id FROM doctors ORDER BY id LIMIT 10;")
    print("\nSAMPLE DOCTORS:")
    for doc in cur.fetchall():
        print(f"  {doc}")

    cur.execute("SELECT DISTINCT status FROM appointments;")
    print("\nAPPOINTMENT DISTINCT STATUSES:")
    for st in cur.fetchall():
        print(f"  {st[0]}")

    cur.execute("SELECT MIN(appointment_date), MAX(appointment_date), COUNT(*) FROM appointments;")
    print("\nAPPOINTMENT DATE RANGE & COUNT:")
    print(cur.fetchone())

    cur.close()
    conn.close()

if __name__ == '__main__':
    inspect()
