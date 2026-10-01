import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import psycopg2
from psycopg2.extras import RealDictCursor
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("""
    SELECT 
        u.id,
        u.username,
        r.name as role,
        COALESCE(d.display_name, u.staff_name, CONCAT(u.first_name, ' ', u.last_name)) as name,
        d.id as doctor_id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN doctors d ON d.user_id = u.id
    WHERE u.is_active = true;
""")
users = cur.fetchall()
print("Active Users:")
for u in users:
    print(" ", u)
conn.close()
