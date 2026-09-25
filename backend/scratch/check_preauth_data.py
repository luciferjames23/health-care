import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
from psycopg2.extras import RealDictCursor

def check_preauth_data():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check admissions table
    cur.execute("""
        SELECT a.admission_id, a.patient_id, a.admission_number, a.admission_date, 
               a.reason_for_admission, a.admission_type, a.department_id,
               p.first_name, p.last_name, p.date_of_birth, p.gender, p.patient_code,
               pi.insurance_provider, pi.policy_number, pi.coverage_limit
        FROM admissions a
        JOIN patients p ON a.patient_id = p.id
        LEFT JOIN patient_insurance pi ON p.id = pi.patient_id
        ORDER BY a.admission_id DESC
        LIMIT 5;
    """)
    print("SAMPLE ADMISSIONS WITH INSURANCE & PATIENT:")
    for r in cur.fetchall():
        print(dict(r))
        
    # Check insurance_claims procedures or amounts
    cur.execute("""
        SELECT c.claim_id, c.claim_number, c.patient_id, c.bill_id, c.insurance_provider, 
               c.claimed_amount, c.approved_amount, c.claim_status, c.claim_date,
               b.gross_amount, b.net_amount, b.admission_id,
               a.reason_for_admission,
               p.first_name, p.last_name, p.date_of_birth, p.gender, p.patient_code
        FROM insurance_claims c
        LEFT JOIN bills b ON c.bill_id = b.bill_id
        LEFT JOIN admissions a ON b.admission_id = a.admission_id
        LEFT JOIN patients p ON c.patient_id = p.id
        ORDER BY c.claim_id DESC
        LIMIT 5;
    """)
    print("\nSAMPLE CLAIMS JOINED WITH BILL & ADMISSION & PATIENT:")
    for r in cur.fetchall():
        print(dict(r))

    conn.close()

if __name__ == '__main__':
    check_preauth_data()
