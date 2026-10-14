import sys
sys.path.insert(0, 'backend')
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
SELECT u.id, u.username, r.name as role, d.id as doctor_id, d.display_name, d.qualification, d.specialization, dept.department_name
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN doctors d ON d.user_id = u.id
LEFT JOIN departments dept ON dept.id = COALESCE(d.department_id, u.department_id)
WHERE LOWER(r.name) = 'doctor'
ORDER BY u.id
LIMIT 5;
""")
for r in cur.fetchall():
    print(dict(r))

conn.close()
