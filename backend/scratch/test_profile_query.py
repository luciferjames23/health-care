import sys
sys.path.insert(0, 'backend')
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def get_profile(username):
    cur.execute("""
        SELECT u.id as user_id, u.username, u.email as user_email, u.phone as user_phone,
               u.first_name as user_fname, u.last_name as user_lname,
               u.staff_name, u.staff_type, u.staff_code, u.is_active,
               r.name as role_name,
               d.id as doctor_id, d.doctor_code, d.first_name as doc_fname, d.last_name as doc_lname,
               d.display_name as doc_display_name, d.specialization as doc_spec,
               d.qualification as doc_qual, d.experience_years, d.phone as doc_phone,
               d.email as doc_email, d.consultation_fee, d.status as doc_status,
               dept.department_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN doctors d ON d.user_id = u.id
        LEFT JOIN departments dept ON dept.id = COALESCE(d.department_id, u.department_id)
        WHERE LOWER(u.username) = LOWER(%s)
        LIMIT 1;
    """, (username,))
    row = cur.fetchone()
    if not row:
        return None
    display_name = (
        row["doc_display_name"] or
        row["staff_name"] or
        f"{row['user_fname'] or ''} {row['user_lname'] or ''}".strip() or
        row["username"]
    )
    fee = float(row["consultation_fee"]) if row.get("consultation_fee") is not None else None
    return {
        "user_id": row["user_id"],
        "username": row["username"],
        "role": row["role_name"],
        "name": display_name,
        "designation": row["doc_spec"] or row["staff_type"] or row["role_name"],
        "specialization": row["doc_spec"],
        "qualification": row["doc_qual"],
        "department": row["department_name"],
        "phone": row["doc_phone"] or row["user_phone"],
        "email": row["doc_email"] or row["user_email"],
        "consultation_fee": fee,
        "experience_years": row["experience_years"],
        "doctor_id": row["doctor_id"],
        "status": row["doc_status"] or ("Active" if row["is_active"] else "Inactive")
    }

print("ADMIN PROFILE:", get_profile("admin"))
print("\nDOCTOR_6 PROFILE:", get_profile("doctor_6"))
print("\nDOCTOR_2 PROFILE:", get_profile("doctor_2"))

conn.close()
