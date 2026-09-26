import sys, os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
import db_config
from psycopg2.extras import RealDictCursor

def find_scenario_patients():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("=== 1. PATIENT WITH INSURANCE & CLAIMS ===")
    cur.execute("""
        SELECT p.id, p.patient_code, p.first_name, p.last_name, a.admission_id, a.admission_number,
               ic.claim_id, ic.claim_number, ic.insurance_provider, ic.claimed_amount, ic.approved_amount, ic.claim_status
        FROM patients p
        JOIN admissions a ON a.patient_id = p.id
        JOIN insurance_claims ic ON ic.patient_id = p.id
        LIMIT 3;
    """)
    for r in cur.fetchall():
        print(dict(r))

    print("\n=== 2. PATIENT WITH INSURANCE BUT NO CLAIMS ===")
    cur.execute("""
        SELECT p.id, p.patient_code, p.first_name, p.last_name, a.admission_id, a.admission_number,
               pi.insurance_id, pi.insurance_provider, pi.policy_number, pi.coverage_limit
        FROM patients p
        JOIN admissions a ON a.patient_id = p.id
        JOIN patient_insurance pi ON pi.patient_id = p.id
        WHERE NOT EXISTS (SELECT 1 FROM insurance_claims ic WHERE ic.patient_id = p.id)
        LIMIT 3;
    """)
    for r in cur.fetchall():
        print(dict(r))

    print("\n=== 3. PATIENT WITHOUT INSURANCE (SELF-PAY) ===")
    cur.execute("""
        SELECT p.id, p.patient_code, p.first_name, p.last_name, a.admission_id, a.admission_number,
               b.bill_id, b.net_amount, b.patient_amount, b.bill_status
        FROM patients p
        JOIN admissions a ON a.patient_id = p.id
        JOIN bills b ON b.patient_id = p.id
        WHERE NOT EXISTS (SELECT 1 FROM patient_insurance pi WHERE pi.patient_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM insurance_claims ic WHERE ic.patient_id = p.id)
        LIMIT 3;
    """)
    for r in cur.fetchall():
        print(dict(r))

    print("\n=== 4. CURRENTLY ADMITTED PATIENTS ===")
    cur.execute("""
        SELECT p.id, p.patient_code, p.first_name, p.last_name, a.admission_id, a.admission_number,
               a.admission_date, a.discharge_status, a.ward_id, a.bed_id
        FROM patients p
        JOIN admissions a ON a.patient_id = p.id
        WHERE a.discharge_date IS NULL AND a.discharge_status = 'Admitted'
        LIMIT 3;
    """)
    for r in cur.fetchall():
        print(dict(r))

    print("\n=== 5. DISCHARGED PATIENTS ===")
    cur.execute("""
        SELECT p.id, p.patient_code, p.first_name, p.last_name, a.admission_id, a.admission_number,
               a.admission_date, a.discharge_date, a.discharge_status, ds.summary_id
        FROM patients p
        JOIN admissions a ON a.patient_id = p.id
        JOIN discharge_summaries ds ON ds.admission_id = a.admission_id
        WHERE a.discharge_status = 'Discharged'
        LIMIT 3;
    """)
    for r in cur.fetchall():
        print(dict(r))

    print("\n=== 6. PATIENT WITH RADIOLOGY ORDERS ===")
    cur.execute("""
        SELECT p.id, p.patient_code, p.first_name, p.last_name, ro.order_id, ro.accession_number, ro.clinical_indication, ro.status
        FROM patients p
        JOIN radiology_orders ro ON ro.patient_id = p.id
        LIMIT 3;
    """)
    for r in cur.fetchall():
        print(dict(r))

    print("\n=== 7. OUTPATIENTS (OPD) ===")
    cur.execute("""
        SELECT p.id, p.patient_code, p.first_name, p.last_name, apt.id as apt_id, apt.booking_id, apt.appointment_date, apt.status
        FROM appointments apt
        JOIN patients p ON p.id = apt.patient_id
        LIMIT 3;
    """)
    for r in cur.fetchall():
        print(dict(r))

    cur.close()
    conn.close()

if __name__ == '__main__':
    find_scenario_patients()
