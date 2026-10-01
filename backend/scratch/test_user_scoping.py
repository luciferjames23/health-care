import sys
sys.path.append('.')
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

def test_scope(role, username, user_name):
    clean_doc = user_name.replace('Dr.', '').replace('Dr', '').strip() if user_name else ''
    cur.execute("""
        SELECT COUNT(*) as cnt FROM employee_leave_requests lr
        WHERE (lr.staff_name ILIKE %s OR lr.supervisor_name ILIKE %s)
          AND (lr.is_read IS FALSE OR lr.is_read IS NULL)
          AND lr.status = 'Pending';
    """, (f"%{clean_doc}%", f"%{clean_doc}%"))
    leaves = cur.fetchone()['cnt']
    print(f"Role={role}, User={user_name} -> Pending Leaves: {leaves}")

test_scope('Doctor', 'doctor_32', 'Dr. Venkat Reddy')
test_scope('Doctor', 'doctor_1', 'Dr. Priya Patel')
test_scope('Doctor', 'doctor_4', 'Dr. Vikram Singh')
test_scope('Nurse', 'nurse.priya', 'Nurse Priya Narayanan')
test_scope('Nurse', 'anitha.kumar', 'Nurse Anitha Kumar')

cur.close()
conn.close()
