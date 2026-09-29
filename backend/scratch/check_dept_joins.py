import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.dashboard_routes import get_conn

def check_dept_joins():
    conn = get_conn()
    cur = conn.cursor()
    
    cur.execute("SELECT count(*) FROM doctors WHERE department_id IS NULL;")
    null_dept = cur.fetchone()[0]
    print(f"Doctors with NULL department_id: {null_dept}")
    
    cur.execute("""
        SELECT d.id, d.doctor_code, d.display_name, d.department_id 
        FROM doctors d 
        LEFT JOIN departments dept ON d.department_id = dept.id 
        WHERE dept.id IS NULL;
    """)
    unmatched_dept = cur.fetchall()
    print(f"Doctors with department_id that does NOT exist in departments table: {len(unmatched_dept)}")
    for d in unmatched_dept:
        print(d)
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_dept_joins()
