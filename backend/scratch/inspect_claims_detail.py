import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
from psycopg2.extras import RealDictCursor

def test_claims_stats():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT count(*) as total, 
               count(p.date_of_birth) as with_dob,
               count(p.gender) as with_gender,
               count(a.reason_for_admission) as with_reason
        FROM insurance_claims c
        LEFT JOIN patients p ON c.patient_id = p.id
        LEFT JOIN bills b ON c.bill_id = b.bill_id
        LEFT JOIN admissions a ON b.admission_id = a.admission_id
    """)
    print(dict(cur.fetchone()))
    conn.close()

if __name__ == '__main__':
    test_claims_stats()
