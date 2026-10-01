import sys
sys.path.append('.')
import db_config
import psycopg2.extras
from datetime import datetime

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def test_get_notifs(role, username, user_name):
    ADMIN_ROLES = {'hospital management', 'admin', 'system admin', 'ai administrator', 'governance officer', 'it administrator', 'auditor'}
    is_admin = (not role and not username) or (role and role.strip().lower() in ADMIN_ROLES) or (username and username.strip().lower() in ('admin', 'sysadmin'))
    
    user_row = None
    doc_id = None
    u_id = None
    clean_name = ''
    
    if not is_admin and (username or user_name):
        raw_name = (user_name or '').replace('Dr.', '').replace('Dr', '').replace('Surgeon', '').replace('Nurse', '').strip()
        cur.execute('''
            SELECT u.id, u.username, u.staff_name, u.first_name, u.last_name, u.staff_type,
                   d.id as doctor_id, d.doctor_code, d.display_name as doctor_display_name
            FROM users u
            LEFT JOIN doctors d ON (d.user_id = u.id OR d.id = u.id)
            WHERE (%s IS NOT NULL AND u.username = %s)
               OR (%s IS NOT NULL AND (u.staff_name ILIKE %s OR d.display_name ILIKE %s))
            LIMIT 1;
        ''', (username, username, user_name, f'%{raw_name}%', f'%{raw_name}%'))
        user_row = cur.fetchone()
        if user_row:
            doc_id = user_row.get('doctor_id')
            u_id = user_row.get('id')
            staff_name = (user_row.get('staff_name') or user_name or '').strip()
            clean_name = staff_name.replace('Dr.', '').replace('Dr', '').replace('Surgeon', '').replace('Nurse', '').strip()
        else:
            clean_name = (user_name or '').replace('Dr.', '').replace('Dr', '').replace('Surgeon', '').replace('Nurse', '').strip()

    # Leaves query
    if is_admin:
        cur.execute("SELECT id, staff_name, leave_type FROM employee_leave_requests ORDER BY id DESC LIMIT 10;")
    else:
        cur.execute('''
            SELECT id, staff_name, leave_type FROM employee_leave_requests
            WHERE (user_id = %s OR staff_name ILIKE %s OR supervisor_name ILIKE %s)
            ORDER BY id DESC LIMIT 10;
        ''', (u_id, f'%{clean_name}%', f'%{clean_name}%'))
    leaves = cur.fetchall()

    # Notifs query
    if is_admin:
        cur.execute("SELECT COUNT(*) FROM notifications;")
    elif doc_id:
        cur.execute('''
            SELECT COUNT(*) FROM notifications n
            JOIN appointments a ON n.appointment_id = a.id
            WHERE a.doctor_id = %s;
        ''', (doc_id,))
    else:
        cur.execute("SELECT 0 as count;")
    notifs_cnt = cur.fetchone()['count']

    print(f"Role: {role}, User: {user_name} -> Leaves returned: {[l['staff_name'] + ' (' + l['leave_type'] + ')' for l in leaves]}, Doc notifs: {notifs_cnt}")

test_get_notifs('Hospital Management', 'admin', 'System Admin')
test_get_notifs('Doctor', 'doctor_32', 'Dr. Venkat Reddy - Surgeon')
test_get_notifs('Doctor', 'doctor_1', 'Dr. Priya Patel')
test_get_notifs('Doctor', 'doctor_4', 'Dr. Vikram Singh')
test_get_notifs('Nurse', 'nurse.priya', 'Nurse Priya Narayanan')
test_get_notifs('Nurse', 'anitha.kumar', 'Nurse Anitha Kumar')

cur.close()
conn.close()
