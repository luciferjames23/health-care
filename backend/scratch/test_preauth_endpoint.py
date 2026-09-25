import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
from psycopg2.extras import RealDictCursor
from datetime import datetime

def test_preauth_query():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Stats
    cur.execute("""
        SELECT 
            COUNT(CASE WHEN claim_status ILIKE '%pending%' THEN 1 END) as pending,
            COUNT(CASE WHEN claim_status ILIKE '%awaiting%' OR claim_status ILIKE '%submitted%' THEN 1 END) as awaiting_insurer,
            COUNT(CASE WHEN claim_status ILIKE '%missing%' THEN 1 END) as missing_documents,
            COUNT(CASE WHEN claim_status ILIKE '%high denial%' THEN 1 END) as high_denial_risk,
            COUNT(CASE WHEN claim_status ILIKE '%approved%' AND claim_status NOT ILIKE '%partially%' THEN 1 END) as approved,
            COUNT(CASE WHEN claim_status ILIKE '%rejected%' THEN 1 END) as rejected,
            COUNT(*) as total_preauths
        FROM insurance_claims
    """)
    stats = dict(cur.fetchone())
    print("Computed Stats:", stats)
    
    # 2. Rows
    query = """
        SELECT 
            c.claim_id,
            c.claim_number,
            c.patient_id,
            c.bill_id,
            c.insurance_provider,
            c.policy_number,
            c.claim_date,
            c.claimed_amount,
            c.approved_amount,
            c.rejected_amount,
            c.claim_status,
            c.rejection_reason,
            p.patient_code,
            p.first_name,
            p.last_name,
            p.date_of_birth,
            p.gender,
            p.phone as patient_phone,
            b.bill_number,
            b.net_amount as bill_net,
            a.reason_for_admission,
            a.admission_number
        FROM insurance_claims c
        LEFT JOIN patients p ON c.patient_id = p.id
        LEFT JOIN bills b ON c.bill_id = b.bill_id
        LEFT JOIN admissions a ON b.admission_id = a.admission_id
        ORDER BY c.claim_id DESC
        LIMIT 10;
    """
    cur.execute(query)
    rows = cur.fetchall()
    print(f"Fetched {len(rows)} rows.")
    
    today = datetime.now().date()
    proc_map = {
        'Fracture': 'Patellar Tension Band Wiring / ORIF',
        'Stroke': 'Acute Ischemic Stroke Thrombolysis Protocol',
        'Cholelithiasis': 'Laparoscopic Cholecystectomy',
        'Preterm Labor': 'Emergency LSCS with Neonatal Support',
        'Gastroenteritis': 'Severe Dehydration & Electrolyte Rebalancing',
        'DKA': 'Diabetic Ketoacidosis Intensive Protocol',
        'High Fever': 'Acute Pyrexia of Unknown Origin Workup',
        'Abdominal Pain': 'Diagnostic Laparoscopy & Appendectomy'
    }
    
    formatted = []
    for r in rows:
        dob = r['date_of_birth']
        if dob:
            years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            g_char = (r['gender'] or 'M')[0].upper()
            patient_age = f"{years} Y · {g_char}"
            raw_age = f"{years} Y"
        else:
            patient_age = "48 Y · M"
            raw_age = "48 Y"
            
        p_name = f"{r.get('first_name') or ''} {r.get('last_name') or ''}".strip() or "Enrolled Beneficiary"
        req_amt = float(r.get('claimed_amount') or 0)
        appr_amt = float(r.get('approved_amount') or 0)
        status = r.get('claim_status') or 'Pending'
        
        proc = r.get('reason_for_admission')
        proc_str = proc_map.get(proc, proc or "Specialized Inpatient Treatment")
        
        completeness = 100 if 'Approved' in status else 65 if 'Missing' in status else 78 if 'Query' in status else 88
        risk = "3%" if 'Approved' in status else "31%" if 'High Denial' in status else "18%" if 'Additional' in status else "9%"
        owner = "R. Sundar" if (r['claim_id'] % 2 == 0) else "L. Fathima"
        
        c_date = r['claim_date'] or today
        days_ago = max(0, (today - c_date).days)
        elapsed = f"{days_ago} d 4 h" if days_ago > 0 else "4 h"
        
        formatted.append({
            "claim_id": r['claim_id'],
            "claim": r['claim_number'] or f"PA-2026-{r['claim_id']}",
            "patient": p_name,
            "patient_name": p_name,
            "patient_id": r['patient_id'],
            "uhid": r.get('patient_code') or f"MER-PAT-{str(r['patient_id'] or 0).zfill(7)}",
            "gender": r.get('gender') or 'Male',
            "patient_age": patient_age,
            "age": patient_age,             # DISPLAY PATIENT'S REAL AGE IN AGE COLUMN
            "case_age": elapsed,             # Case aging/TAT
            "tpa": r.get('insurance_provider') or 'Star Health Insurance',
            "procedure": proc_str,
            "requested": req_amt,
            "approved": appr_amt,
            "completeness": completeness,
            "risk": risk,
            "owner": owner,
            "status": status,
            "claim_date": c_date.strftime('%d %b %Y'),
            "bill_number": r.get('bill_number') or f"MER-BIL-{r.get('bill_id') or 1001}"
        })
        
    print("\nSAMPLE FORMATTED ROW:")
    print(formatted[0])
    conn.close()

if __name__ == '__main__':
    test_preauth_query()
