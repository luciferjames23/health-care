import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.dashboard_routes import get_conn

def check_users():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.username, u.email, r.name as role_name 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id;
    """)
    rows = cur.fetchall()
    print("Users in DB:")
    for r in rows:
        print(r)
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_users()
