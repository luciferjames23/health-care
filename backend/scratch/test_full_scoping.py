import sys
sys.path.append('.')
import db_config
import psycopg2.extras
from typing import Optional

def resolve_user_context(cur, role: Optional[str] = None, username: Optional[str] = None, user_name: Optional[str] = None):
    ADMIN_ROLES = {
        'hospital management', 'admin', 'system admin', 'ai administrator', 
        'governance officer', 'it administrator', 'auditor', 'hr'
    }
    role_clean = (role or '').strip().lower()
    uname_clean = (username or '').strip().lower()
    
    is_admin = False
    if role_clean in ADMIN_ROLES or uname_clean in ('admin', 'sysadmin'):
        is_admin = True
    elif not role and not username and not user_name:
        is_admin = True
        
    user_row = None
    doctor_id = None
    user_id = None
    staff_name = ''
    clean_name = ''
    
    if not is_admin and (username or user_name):
        raw_name = (user_name or '')
        for prefix in ['Dr.', 'Dr', 'Doctor', 'Nurse', 'Surgeon', 'Physician', '- Surgeon', '- Physician']:
            raw_name = raw_name.replace(prefix, '')
        raw_name = raw_name.strip()
        
        try:
            cur.execute("""
                SELECT u.id, u.username, u.staff_name, u.first_name, u.last_name, u.staff_type,
                       d.id as doctor_id, d.doctor_code, d.display_name as doctor_display_name
                FROM users u
                LEFT JOIN doctors d ON (d.user_id = u.id OR d.id = u.id)
                WHERE (%s IS NOT NULL AND u.username = %s)
                   OR (%s IS NOT NULL AND (u.staff_name ILIKE %s OR d.display_name ILIKE %s))
                LIMIT 1;
            """, (username, username, user_name, f"%{raw_name}%", f"%{raw_name}%"))
            user_row = cur.fetchone()
            if user_row:
                doctor_id = user_row.get('doctor_id')
                user_id = user_row.get('id')
                staff_name = (user_row.get('staff_name') or user_name or '').strip()
                clean_name = staff_name
                for p in ['Dr.', 'Dr', 'Doctor', 'Nurse', 'Surgeon', 'Physician']:
                    clean_name = clean_name.replace(p, '')
                clean_name = clean_name.strip()
            else:
                clean_name = raw_name
                cur.execute("""
                    SELECT id, display_name FROM doctors 
                    WHERE display_name ILIKE %s
                    LIMIT 1;
                """, (f"%{raw_name}%",))
                doc_row = cur.fetchone()
                if doc_row:
                    doctor_id = doc_row['id']
                    staff_name = doc_row['display_name']
        except Exception as e:
            clean_name = raw_name

    return {
        "is_admin": is_admin,
        "user_row": user_row,
        "doctor_id": doctor_id,
        "user_id": user_id,
        "staff_name": staff_name or user_name or '',
        "clean_name": clean_name
    }

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

for case in [
    ('Hospital Management', 'admin', 'System Admin'),
    ('Doctor', 'doctor_32', 'Dr. Venkat Reddy - Surgeon'),
    ('Doctor', 'doctor_1', 'Dr. Priya Patel'),
    ('Doctor', 'doctor_4', 'Dr. Vikram Singh'),
    ('Nurse', 'nurse.priya', 'Nurse Priya Narayanan'),
    ('Nurse', 'anitha.kumar', 'Nurse Anitha Kumar'),
]:
    ctx = resolve_user_context(cur, role=case[0], username=case[1], user_name=case[2])
    print(f"\nTesting {case[0]} ({case[2]}):")
    print(f"  is_admin: {ctx['is_admin']}, doctor_id: {ctx['doctor_id']}, user_id: {ctx['user_id']}, clean_name: '{ctx['clean_name']}'")
    
    # Check leaves query
    if ctx['is_admin']:
        cur.execute("SELECT id, staff_name, leave_type FROM employee_leave_requests WHERE is_read IS FALSE;")
    else:
        name_q = f"%{ctx['clean_name']}%" if ctx['clean_name'] else "%UNKNOWN%"
        cur.execute("""
            SELECT id, staff_name, leave_type FROM employee_leave_requests 
            WHERE is_read IS FALSE AND (%s IS NOT NULL AND user_id = %s OR staff_name ILIKE %s OR supervisor_name ILIKE %s);
        """, (ctx['user_id'], ctx['user_id'], name_q, name_q))
    leaves = cur.fetchall()
    print(f"  Pending Leaves: {len(leaves)} -> {[l['staff_name'] + ' (' + l['leave_type'] + ')' for l in leaves]}")

cur.close()
conn.close()
