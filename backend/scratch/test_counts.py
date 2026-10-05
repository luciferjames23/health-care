import sys
sys.path.append('.')
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def get_counts_test(role, username, user_name):
    ADMIN_ROLES = {'hospital management', 'admin', 'system admin', 'ai administrator', 'governance officer', 'it administrator', 'auditor'}
    is_admin = (not role and not username) or (role and role.strip().lower() in ADMIN_ROLES) or (username and username.strip().lower() in ('admin', 'sysadmin'))
    
    if is_admin:
        cur.execute("SELECT COUNT(*) FROM notifications WHERE status NOT IN ('READ', 'DELIVERED');")
        un_notifs = cur.fetchone()['count']
        cur.execute("SELECT COUNT(*) FROM escalations WHERE status NOT IN ('RESOLVED');")
        un_escs = cur.fetchone()['count']
        cur.execute("SELECT COUNT(*) FROM employee_leave_requests WHERE (is_read IS FALSE OR is_read IS NULL) AND status = 'Pending';")
        un_leaves = cur.fetchone()['count']
        cur.execute("SELECT COUNT(*) FROM notifications;")
        tot = cur.fetchone()['count'] + un_leaves
        return {'role': role, 'user': user_name, 'unread': un_notifs + un_escs + un_leaves, 'total': tot, 'leaves': un_leaves}

    # User resolution
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
    
    doc_id = user_row.get('doctor_id') if user_row else None
    u_id = user_row.get('id') if user_row else None
    staff_name = (user_row.get('staff_name') or user_name or '').strip()
    clean_name = staff_name.replace('Dr.', '').replace('Dr', '').replace('Surgeon', '').replace('Nurse', '').strip()

    # Leaves
    cur.execute('''
        SELECT COUNT(*) FROM employee_leave_requests 
        WHERE (is_read IS FALSE OR is_read IS NULL) AND status = 'Pending'
          AND (user_id = %s OR staff_name ILIKE %s OR supervisor_name ILIKE %s);
    ''', (u_id, f'%{clean_name}%', f'%{clean_name}%'))
    un_leaves = cur.fetchone()['count']

    # Doctor notifs
    if doc_id:
        cur.execute('''
            SELECT COUNT(*) FROM notifications n
            JOIN appointments a ON n.appointment_id = a.id
            WHERE a.doctor_id = %s AND n.status NOT IN ('READ', 'DELIVERED');
        ''', (doc_id,))
        un_notifs = cur.fetchone()['count']
    else:
        un_notifs = 0

    return {'role': role, 'user': user_name, 'unread': un_notifs + un_leaves, 'leaves': un_leaves}

print('Admin:', get_counts_test('Hospital Management', 'admin', 'System Admin'))
print('Dr. Venkat Reddy:', get_counts_test('Doctor', 'doctor_32', 'Dr. Venkat Reddy - Surgeon'))
print('Dr. Priya Patel:', get_counts_test('Doctor', 'doctor_1', 'Dr. Priya Patel'))
print('Dr. Vikram Singh:', get_counts_test('Doctor', 'doctor_4', 'Dr. Vikram Singh'))
print('Nurse Priya:', get_counts_test('Nurse', 'nurse.priya', 'Nurse Priya Narayanan'))
print('Nurse Anitha:', get_counts_test('Nurse', 'anitha.kumar', 'Nurse Anitha Kumar'))

cur.close()
conn.close()
