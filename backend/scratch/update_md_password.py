import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
from psycopg2.extras import RealDictCursor
from api.auth_helper import get_hashed_password

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("SELECT id, username, password_hash FROM users WHERE username = 'MD';")
user = cur.fetchone()
print("User MD:", user)

# Set valid password_hash for MD to 'password123' if needed so tests and login work smoothly
new_hash = get_hashed_password("password123")
cur.execute("UPDATE users SET password_hash = %s WHERE username = 'MD';", (new_hash,))
conn.commit()
print("Updated password for MD to password123")
conn.close()
