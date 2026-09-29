import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
from psycopg2.extras import RealDictCursor

def inspect_finance_tables():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    all_tables = [r['table_name'] for r in cur.fetchall()]
    
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'insurance_claims'")
    print("ALL insurance_claims COLUMNS:")
    for r in cur.fetchall():
        print(f"  {r['column_name']} ({r['data_type']})")

    cur.execute("""
        SELECT c.*, p.first_name, p.last_name, p.date_of_birth, p.gender, p.patient_code
        FROM insurance_claims c
        LEFT JOIN patients p ON c.patient_id = p.id
        ORDER BY c.claim_id DESC
        LIMIT 5;
    """)
    print("\nSAMPLE insurance_claims WITH PATIENT:")
    for r in cur.fetchall():
        print(dict(r))

    cur.execute("SELECT DISTINCT claim_status FROM insurance_claims")
    print("\nDISTINCT claim_status:", [r['claim_status'] for r in cur.fetchall()])

    conn.close()

if __name__ == '__main__':
    inspect_finance_tables()
