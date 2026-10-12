import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.dashboard_routes import get_appointments, resolve_target_doctor_id, get_doctors, get_departments

def test():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    
    # 1. Check users in database
    cur.execute("""
        SELECT u.id, u.username, r.name as role, d.id as doc_id, d.display_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN doctors d ON d.user_id = u.id
        ORDER BY u.id
        LIMIT 25;
    """)
    users = cur.fetchall()
    print("USERS IN DB:")
    for u in users:
        print(f"  ID={u[0]}, user={u[1]}, role={u[2]}, doc_id={u[3]}, doc_name={u[4]}")

    # 2. Check doctors with appointments
    cur.execute("""
        SELECT d.id, d.display_name, COUNT(a.id) as appt_count
        FROM doctors d
        JOIN appointments a ON a.doctor_id = d.id
        GROUP BY d.id, d.display_name
        ORDER BY appt_count DESC
        LIMIT 10;
    """)
    print("\nDOCTORS WITH APPOINTMENTS:")
    for d in cur.fetchall():
        print(f"  Doc ID={d[0]}, name={d[1]}, appts={d[2]}")

    # 3. Check what get_doctors(appointment_only=True) returns!
    doc_res = get_doctors(appointment_only=True, current_user={"user_id": 1, "role": "ADMIN"})
    print("\nGET_DOCTORS(appointment_only=True) count:", len(doc_res.get("doctors", [])))
    print("First 5 doctors from get_doctors:")
    for doc in doc_res.get("doctors", [])[:5]:
        print(" ", doc)

    # 4. Check what get_departments(appointment_only=True) returns!
    dept_res = get_departments(appointment_only=True, current_user={"user_id": 1, "role": "ADMIN"})
    print("\nGET_DEPARTMENTS(appointment_only=True) count:", len(dept_res.get("departments", [])))
    print("Departments:", dept_res.get("departments", []))

    cur.close()
    conn.close()

if __name__ == '__main__':
    test()
