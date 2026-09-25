import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.dashboard_routes import get_conn

def inspect():
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("--- DEPARTMENTS ---")
    cur.execute("SELECT * FROM departments")
    depts = cur.fetchall()
    for d in depts:
        print(dict(d))
        
    print("\n--- DOCTORS ---")
    cur.execute("SELECT id, doctor_code, display_name, first_name, last_name, specialization, department_id, status FROM doctors")
    docs = cur.fetchall()
    print(f"Total doctors in DB: {len(docs)}")
    for doc in docs:
        print(dict(doc))
        
    print("\n--- TEST QUERY FROM dashboard_routes.py ---")
    cur.execute("""
        SELECT d.id, d.doctor_code, d.display_name, d.first_name, d.last_name,
               d.specialization, d.qualification, d.experience_years,
               d.phone, d.email, d.consultation_fee, d.status, d.created_at,
               dept.department_name,
               COUNT(a.id) FILTER (WHERE a.appointment_date = CURRENT_DATE) as today_appts,
               COUNT(a.id) FILTER (WHERE a.status NOT IN ('CANCELLED', 'RESCHEDULED')) as total_appts
        FROM doctors d
        JOIN departments dept ON d.department_id = dept.id
        LEFT JOIN appointments a ON d.id = a.doctor_id
        GROUP BY d.id, d.doctor_code, d.display_name, d.first_name, d.last_name,
                 d.specialization, d.qualification, d.experience_years,
                 d.phone, d.email, d.consultation_fee, d.status, d.created_at,
                 dept.department_name
        ORDER BY d.display_name;
    """)
    joined_docs = cur.fetchall()
    print(f"Joined doctors returned from SQL query: {len(joined_docs)}")
    for jd in joined_docs:
        print(dict(jd))
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    inspect()
