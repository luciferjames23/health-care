import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT 
        n.id,
        n.patient_id,
        n.appointment_id,
        n.notification_type,
        n.channel,
        n.message,
        n.reason,
        n.status,
        n.created_at,
        n.sent_at,
        n.delivered_at,
        p.first_name,
        p.last_name,
        p.patient_code,
        p.phone,
        a.appointment_date,
        a.appointment_time,
        dept.department_name,
        d.display_name as doctor_name
    FROM notifications n
    LEFT JOIN patients p ON n.patient_id = p.id
    LEFT JOIN appointments a ON n.appointment_id = a.id
    LEFT JOIN departments dept ON a.department_id = dept.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    ORDER BY n.id DESC
    LIMIT 10;
""")
rows = cur.fetchall()
print(f"Fetched {len(rows)} notifications:")
for r in rows:
    msg = (r['message'] or '').encode('ascii', 'replace').decode('ascii')
    print(f"ID: {r['id']}, Type: {r['notification_type']}, Status: {r['status']}, Patient: {r['first_name']} {r['last_name']}, Msg: {msg[:50]}")

conn.close()
