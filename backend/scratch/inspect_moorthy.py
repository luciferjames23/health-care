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
        print("=== USERS & DOCTORS FOR MOORTHY AND OTHERS ===")
        cur.execute("""
            SELECT u.id as user_id, u.username, r.name as role, d.id as doctor_id, d.display_name, d.first_name, d.last_name, d.department_id, dept.department_name
            FROM doctors d
            LEFT JOIN users u ON d.user_id = u.id
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments dept ON d.department_id = dept.id
            WHERE d.display_name ILIKE '%Moorthy%' OR d.id IN (1005, 1006, 1009, 1010, 1018)
            ORDER BY d.id;
        """)
        rows = cur.fetchall()
        for r in rows:
            print(dict(r))

    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
