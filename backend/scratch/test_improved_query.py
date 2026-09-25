import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.dashboard_routes import get_conn, rows_to_dicts

def run_test_query(search=None, department=None, status=None):
    conn = get_conn()
    cur = conn.cursor()

    conditions = []
    params = []

    if search and search.strip():
        s = f"%{search.strip().lower()}%"
        conditions.append(
            "(LOWER(d.display_name) LIKE %s OR LOWER(d.doctor_code) LIKE %s OR LOWER(d.first_name) LIKE %s OR LOWER(d.last_name) LIKE %s OR LOWER(d.specialization) LIKE %s OR LOWER(d.email) LIKE %s OR LOWER(COALESCE(d.phone, '')) LIKE %s OR LOWER(COALESCE(dept.department_name, '')) LIKE %s)"
        )
        params += [s, s, s, s, s, s, s, s]

    if department and department.strip() and department.strip().lower() not in {"all", "all departments", "all department", "null", "undefined"}:
        conditions.append("LOWER(COALESCE(dept.department_name, 'General Medicine')) = LOWER(%s)")
        params.append(department.strip())

    if status and status.strip() and status.strip().lower() not in {"all", "all status", "all statuses", "null", "undefined"}:
        conditions.append("UPPER(d.status) = UPPER(%s)")
        params.append(status.strip())

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    cur.execute(
        f"""
        SELECT d.id, d.doctor_code, d.display_name, d.first_name, d.last_name,
               d.specialization, d.qualification, d.experience_years,
               d.phone, d.email, d.consultation_fee, d.status, d.created_at,
               COALESCE(dept.department_name, 'General Medicine') as department_name,
               COUNT(a.id) FILTER (WHERE a.appointment_date = CURRENT_DATE) as today_appts,
               COUNT(a.id) FILTER (WHERE a.status NOT IN ('CANCELLED', 'RESCHEDULED')) as total_appts
        FROM doctors d
        LEFT JOIN departments dept ON d.department_id = dept.id
        LEFT JOIN appointments a ON d.id = a.doctor_id
        {where}
        GROUP BY d.id, d.doctor_code, d.display_name, d.first_name, d.last_name,
                 d.specialization, d.qualification, d.experience_years,
                 d.phone, d.email, d.consultation_fee, d.status, d.created_at,
                 dept.department_name
        ORDER BY d.display_name;
        """,
        params,
    )
    doctors = rows_to_dicts(cur, cur.fetchall())
    cur.close()
    conn.close()
    return doctors

def test_all():
    print("1. All doctors (no params):", len(run_test_query()))
    print("2. 'All Departments':", len(run_test_query(department="All Departments")))
    print("3. 'All Status':", len(run_test_query(status="All Status")))
    print("4. 'ACTIVE' status:", len(run_test_query(status="ACTIVE")))
    print("5. 'INACTIVE' status:", len(run_test_query(status="INACTIVE")))
    print("6. 'General Medicine' dept:", len(run_test_query(department="General Medicine")))
    print("7. 'Neurology' dept:", len(run_test_query(department="Neurology")))
    print("8. Search 'DOC-0004':", len(run_test_query(search="DOC-0004")))
    print("9. Search 'Vikram':", len(run_test_query(search="Vikram")))
    print("10. Search 'General Medicine' + 'ACTIVE':", len(run_test_query(department="General Medicine", status="ACTIVE")))

if __name__ == "__main__":
    test_all()
