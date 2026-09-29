import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.dashboard_routes import get_conn

def check_depts():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, department_name FROM departments ORDER BY id;")
    print("Departments in DB:")
    for row in cur.fetchall():
        print(row)
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_depts()
