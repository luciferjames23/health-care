import sys, os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
import db_config
from psycopg2.extras import RealDictCursor

def inspect_patients():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT count(*) as null_pids FROM admissions WHERE patient_id IS NULL;")
    print("Admissions with NULL patient_id:", cur.fetchone()['null_pids'])

    cur.execute("SELECT count(*) as not_null_pids FROM admissions WHERE patient_id IS NOT NULL;")
    print("Admissions with NOT NULL patient_id:", cur.fetchone()['not_null_pids'])

    # Pick 20 distinct patient_ids from admissions WHERE patient_id IS NOT NULL
    cur.execute("""
        SELECT a.patient_id, count(*) as adm_count
        FROM admissions a
        WHERE a.patient_id IS NOT NULL
        GROUP BY a.patient_id
        ORDER BY adm_count DESC
        LIMIT 20;
    """)
    patient_ids = [r['patient_id'] for r in cur.fetchall()]
    print(f"Top non-null patient IDs from admissions: {patient_ids}")

    for pid in patient_ids[:15]:
        cur.execute("SELECT id, patient_code, first_name, last_name, gender, blood_group, status FROM patients WHERE id = %s", (pid,))
        p = cur.fetchone()
        if not p:
            print(f"PID: {pid} NOT FOUND in patients table!")
            continue

        cur.execute("SELECT COUNT(*) as c FROM admissions WHERE patient_id = %s", (pid,))
        adms = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM patient_visits WHERE patient_id = %s", (pid,))
        vis = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM diagnoses WHERE patient_id = %s", (pid,))
        diags = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM vital_signs WHERE patient_id = %s", (pid,))
        vits = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM prescriptions WHERE patient_id = %s", (pid,))
        rxs = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM pharmacy_sales WHERE patient_id = %s", (pid,))
        pss = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM lab_orders WHERE patient_id = %s", (pid,))
        labs = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM bills WHERE patient_id = %s", (pid,))
        bills = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM patient_insurance WHERE patient_id = %s", (pid,))
        inss = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM insurance_claims WHERE patient_id = %s", (pid,))
        claims = cur.fetchone()['c']

        cur.execute("SELECT COUNT(*) as c FROM discharge_summaries WHERE patient_id = %s", (pid,))
        discs = cur.fetchone()['c']

        print(f"PID: {pid} | Code: {p['patient_code']} | Name: {p['first_name']} {p['last_name']} | Adm: {adms} | Vis: {vis} | Diag: {diags} | Vit: {vits} | Rx: {rxs} | PS: {pss} | Lab: {labs} | Bill: {bills} | Ins: {inss} | Claim: {claims} | Disc: {discs}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    inspect_patients()
