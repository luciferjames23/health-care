import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Search for patient ID 111116 or similar
cur.execute("SELECT id, patient_code, first_name, last_name, phone FROM patients WHERE id IN (111116, 11116, 1000116, 11111, 111115, 111117) OR id >= 100000 LIMIT 10;")
print("Patients around 111116:")
for r in cur.fetchall():
    print(r)

cur.execute("SELECT * FROM patients WHERE id = 111116 OR patient_code LIKE '%111116%';")
row = cur.fetchone()
print("Exact patient 111116:", row)

# 2. Search notifications for 111116 or 'Patient #'
cur.execute("SELECT id, patient_id, notification_type, message FROM notifications WHERE patient_id = 111116 OR message LIKE '%111116%' OR message LIKE '%Patient #%' LIMIT 10;")
print("\nNotifications with 111116 or Patient #:")
for r in cur.fetchall():
    msg = (r['message'] or '').encode('ascii', 'replace').decode('ascii')
    print(f"ID: {r['id']}, PID: {r['patient_id']}, Type: {r['notification_type']}, Msg: {msg[:80]}")

# 3. Search escalations for 111116
cur.execute("SELECT * FROM escalations WHERE patient_id = 111116 OR escalation_reason LIKE '%111116%' OR patient_question LIKE '%111116%';")
print("\nEscalations with 111116:")
for r in cur.fetchall():
    print(r)

conn.close()
