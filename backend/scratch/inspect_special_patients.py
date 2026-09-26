import sys, os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
import db_config
from psycopg2.extras import RealDictCursor

def inspect_special_patients():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("=== RADIOLOGY ORDERS COLS ===")
    cur.execute("SELECT * FROM radiology_orders LIMIT 1;")
    r = cur.fetchone()
    print(r.keys() if r else "EMPTY")
    if r:
        print(r)

    print("=== PATIENTS WITH RADIOLOGY ORDERS ===")
    cur.execute("SELECT * FROM radiology_orders LIMIT 5;")
    for row in cur.fetchall():
        print(row)

    print("\n=== PATIENTS WITH RADIOLOGY SCANS ===")
    cur.execute("SELECT * FROM radiology_scan LIMIT 3;")
    for row in cur.fetchall():
        print(row)

    print("\n=== PATIENTS WITHOUT INSURANCE ===")
    cur.execute("""
        SELECT p.id, p.patient_code, p.first_name, p.last_name, 
               (SELECT count(*) FROM admissions a WHERE a.patient_id = p.id) as adm_c,
               (SELECT count(*) FROM bills b WHERE b.patient_id = p.id) as bill_c
        FROM patients p 
        WHERE NOT EXISTS (SELECT 1 FROM patient_insurance pi WHERE pi.patient_id = p.id)
          AND EXISTS (SELECT 1 FROM admissions a WHERE a.patient_id = p.id)
        LIMIT 5;
    """)
    for row in cur.fetchall():
        print(row)

    print("\n=== CURRENTLY ADMITTED PATIENTS ===")
    cur.execute("""
        SELECT a.admission_id, a.admission_number, a.patient_id, p.patient_code, p.first_name, p.last_name,
               a.admission_date, a.discharge_date, a.discharge_status, a.ward_id, a.bed_id
        FROM admissions a
        JOIN patients p ON p.id = a.patient_id
        WHERE a.discharge_date IS NULL OR a.discharge_status ILIKE '%admit%' OR a.discharge_status ILIKE '%active%'
        LIMIT 5;
    """)
    for row in cur.fetchall():
        print(row)

    print("\n=== DISCHARGED PATIENTS ===")
    cur.execute("""
        SELECT a.admission_id, a.admission_number, a.patient_id, p.patient_code, p.first_name, p.last_name,
               a.admission_date, a.discharge_date, a.discharge_status
        FROM admissions a
        JOIN patients p ON p.id = a.patient_id
        WHERE a.discharge_date IS NOT NULL AND a.discharge_status ILIKE '%discharge%'
        LIMIT 5;
    """)
    for row in cur.fetchall():
        print(row)

    cur.close()
    conn.close()

if __name__ == '__main__':
    inspect_special_patients()
