import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

def check_dates():
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*)
        FROM appointments
        WHERE appointment_date >= '2026-10-01' AND appointment_date <= '2026-10-31';
    """)
    print("Appointments in October 2026 (2026-10-01 to 2026-10-31):", cur.fetchone()[0])

    cur.execute("""
        SELECT doctor_id, COUNT(*)
        FROM appointments
        WHERE appointment_date >= '2026-10-01' AND appointment_date <= '2026-10-31'
        GROUP BY doctor_id
        ORDER BY count DESC
        LIMIT 10;
    """)
    print("Top doctors with appointments in October 2026:")
    for row in cur.fetchall():
        print(f"  doctor_id={row[0]}: count={row[1]}")

    cur.execute("""
        SELECT TO_CHAR(appointment_date, 'YYYY-MM') as month, COUNT(*)
        FROM appointments
        GROUP BY month
        ORDER BY month;
    """)
    print("\nAppointments grouped by Month:")
    for row in cur.fetchall():
        print(f"  {row[0]}: count={row[1]}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    check_dates()
