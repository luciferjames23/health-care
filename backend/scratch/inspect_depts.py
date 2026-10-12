import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

def inspect_depts():
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT id, department_name FROM departments ORDER BY id;")
    print("ALL DEPARTMENTS:")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}")

    cur.execute("SELECT COALESCE(department_id, -1), COUNT(*) FROM appointments GROUP BY department_id ORDER BY count DESC LIMIT 20;")
    print("\nAPPOINTMENTS BY department_id column:")
    for row in cur.fetchall():
        print(f"  dept_id={row[0]}: count={row[1]}")

    cur.execute("""
        SELECT COALESCE(d.department_id, -1), dept.department_name, COUNT(a.id)
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        GROUP BY d.department_id, dept.department_name
        ORDER BY count DESC
        LIMIT 20;
    """)
    print("\nAPPOINTMENTS BY DOCTOR'S department_id:")
    for row in cur.fetchall():
        print(f"  doc_dept_id={row[0]} ({row[1]}): count={row[2]}")

    cur.execute("SELECT COUNT(*) FROM appointments WHERE doctor_id IS NULL;")
    print("\nAppointments with doctor_id IS NULL:", cur.fetchone()[0])

    cur.close()
    conn.close()

if __name__ == '__main__':
    inspect_depts()
