import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import psycopg2.extras

def main():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        print("=== USERS & DOCTORS MAPPING ===")
        cur.execute("""
            SELECT u.id as user_id, u.username, r.name as role, d.id as doctor_id, d.display_name, d.first_name, d.last_name, d.department_id, dept.department_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN doctors d ON d.user_id = u.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            ORDER BY u.id;
        """)
        users = cur.fetchall()
        for u in users:
            print(f"User ID: {u['user_id']} | Username: {u['username']} | Role: {u['role']} | Doctor ID: {u['doctor_id']} | Name: {u['display_name']} | Dept: {u['department_name']}")

        print("\n=== APPOINTMENTS COUNT PER DOCTOR ===")
        cur.execute("""
            SELECT a.doctor_id, d.display_name, COUNT(*) as total_appts,
                   COUNT(*) FILTER (WHERE a.status = 'BOOKED') as booked,
                   COUNT(*) FILTER (WHERE a.status = 'CONFIRMED') as confirmed,
                   COUNT(*) FILTER (WHERE a.status = 'COMPLETED') as completed,
                   COUNT(*) FILTER (WHERE a.status = 'CANCELLED') as cancelled,
                   MIN(a.appointment_date) as min_date,
                   MAX(a.appointment_date) as max_date
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            GROUP BY a.doctor_id, d.display_name
            ORDER BY a.doctor_id;
        """)
        appts = cur.fetchall()
        for a in appts:
            print(f"Doctor ID: {a['doctor_id']} | Name: {a['display_name']} | Total: {a['total_appts']} | Booked: {a['booked']} | Confirmed: {a['confirmed']} | Completed: {a['completed']} | Cancelled: {a['cancelled']} | Date range: {a['min_date']} to {a['max_date']}")

    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
