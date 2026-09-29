import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

cur.execute("SELECT notification_type, status, COUNT(*) FROM notifications GROUP BY notification_type, status ORDER BY COUNT(*) DESC;")
print("Notification types and statuses:")
for r in cur.fetchall():
    print(r)

cur.execute("""
    SELECT n.id, n.patient_id, p.first_name, p.last_name, n.notification_type, n.channel, n.status, n.created_at, SUBSTRING(n.message FROM 1 FOR 60)
    FROM notifications n
    LEFT JOIN patients p ON n.patient_id = p.id
    ORDER BY n.id DESC
    LIMIT 10;
""")
for r in cur.fetchall():
    print(r)

conn.close()
