import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.dashboard_routes import get_appointments

def test_doc_appts():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM appointments WHERE doctor_id = 1;")
    print("Doctor 1 raw appointment count in DB:", cur.fetchone()[0])

    cur.execute("SELECT id, booking_id, appointment_date, status, doctor_id, department_id FROM appointments WHERE doctor_id = 1 LIMIT 5;")
    for row in cur.fetchall():
        print("  ", row)

    doc_user = {
        "user_id": 1,
        "username": "doctor_1",
        "role": "DOCTOR",
        "doctor_id": 1,
        "full_name": "Dr. Priya Patel"
    }

    res = get_appointments(
        search=None,
        status=None,
        department=None,
        doctor_id=None,
        booking_source=None,
        date_from=None,
        date_to=None,
        date_type='appointment_date',
        sort_by='appointment_date',
        sort_order='desc',
        page=1,
        per_page=20,
        current_user=doc_user
    )
    print("\nDoctor 1 get_appointments result:")
    print("  Total:", res.get("total"))
    print("  Returned:", len(res.get("appointments", [])))
    if res.get("appointments"):
        print("  First appt:", res["appointments"][0])

    cur.close()
    conn.close()

if __name__ == '__main__':
    test_doc_appts()
