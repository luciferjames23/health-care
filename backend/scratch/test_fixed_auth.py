import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

def test_fixed_queries():
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    # 1. Test get_auth_users query
    q1 = """
        SELECT DISTINCT ON (u.id)
            u.id,
            u.username,
            COALESCE(r.name, 'Staff') as role,
            COALESCE(
                d.display_name, 
                NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
                u.staff_name, 
                NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
                u.username
            ) as name,
            COALESCE(dept.department_name, CASE WHEN LOWER(COALESCE(r.name, '')) = 'patient' THEN 'Patient Portal' ELSE u.staff_type END, r.name) as dept,
            COALESCE(d.specialization, CASE WHEN LOWER(COALESCE(r.name, '')) = 'patient' THEN p.patient_code ELSE dept.department_name END, u.staff_type, 'General Medicine') as specialization,
            COALESCE(d.specialization, CASE WHEN LOWER(COALESCE(r.name, '')) = 'patient' THEN 'Patient' ELSE u.staff_type END, r.name) as title,
            u.email,
            p.id as patient_id,
            p.patient_code,
            COALESCE(u.is_active, true) as is_active
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN doctors d ON d.user_id = u.id
        LEFT JOIN departments dept ON u.department_id = dept.id
        LEFT JOIN patients p ON (LOWER(p.patient_code) = LOWER(u.username) OR (u.phone IS NOT NULL AND p.phone = u.phone))
        ORDER BY
            u.id ASC,
            CASE
                WHEN LOWER(COALESCE(r.name, '')) = 'admin' THEN 1
                WHEN LOWER(COALESCE(r.name, '')) = 'radiologist' THEN 2
                WHEN LOWER(COALESCE(r.name, '')) = 'doctor' THEN 3
                WHEN LOWER(COALESCE(r.name, '')) = 'patient' THEN 5
                ELSE 4
            END;
    """
    cur.execute(q1)
    rows1 = cur.fetchall()
    print("Q1 (get_auth_users) returned rows:", len(rows1))

    # 2. Test select_account query for 'admin'
    q2 = """
        SELECT u.id, u.username, r.name,
               COALESCE(
                   d.display_name, 
                   NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), 
                   u.staff_name, 
                   u.username
               ),
               COALESCE(dept.department_name, CASE WHEN LOWER(r.name) = 'patient' THEN 'Patient Portal' ELSE NULL END),
               d.id, d.specialization,
               p.id as patient_id, p.patient_code,
               COALESCE(d.department_id, u.department_id)
        FROM users u JOIN roles r ON r.id=u.role_id
        LEFT JOIN doctors d ON d.user_id=u.id
        LEFT JOIN departments dept ON dept.id=COALESCE(d.department_id,u.department_id)
        LEFT JOIN patients p ON (LOWER(p.patient_code) = LOWER(u.username) OR (u.phone IS NOT NULL AND p.phone = u.phone))
        WHERE (lower(u.username)=lower(%s) OR (p.patient_code IS NOT NULL AND lower(p.patient_code)=lower(%s))) AND u.is_active=true
        LIMIT 1
    """
    cur.execute(q2, ("admin", "admin"))
    row2 = cur.fetchone()
    print("Q2 (select_account 'admin') row:", row2)

    cur.execute(q2, ("doctor_1", "doctor_1"))
    row3 = cur.fetchone()
    print("Q2 (select_account 'doctor_1') row:", row3)

    cur.close()
    conn.close()

if __name__ == '__main__':
    test_fixed_queries()
