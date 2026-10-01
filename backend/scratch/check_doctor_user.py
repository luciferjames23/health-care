import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import psycopg2
from psycopg2.extras import RealDictCursor
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT id, username, email, role, doctor_id FROM users WHERE doctor_id = 1017 OR role = 'DOCTOR';")
users = cur.fetchall()
print("Doctor Users in DB:", users)
conn.close()
