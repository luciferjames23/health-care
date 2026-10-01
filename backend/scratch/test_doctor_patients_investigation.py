import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import psycopg2
from psycopg2.extras import RealDictCursor
import db_config

def main():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("--- DOCTORS ---")
    cur.execute("SELECT id, display_name, first_name, last_name, user_id FROM doctors WHERE display_name LIKE '%Edwin%';")
    doctors = cur.fetchall()
    print("Doctors found:", doctors)

    if doctors:
        doc_id = doctors[0]['id']
        print(f"\n--- APPOINTMENTS FOR DOCTOR {doc_id} ---")
        cur.execute("SELECT id, booking_id, patient_id, doctor_id, appointment_date, status, booking_source FROM appointments WHERE doctor_id = %s;", (doc_id,))
        appts = cur.fetchall()
        print(f"Appointments count: {len(appts)}")
        for a in appts:
            print("  ", a)

        print(f"\n--- PRE-ADMISSIONS FOR DOCTOR {doc_id} ---")
        cur.execute("SELECT id, patient_id, doctor_id, status FROM pre_admissions WHERE doctor_id = %s;", (doc_id,))
        pas = cur.fetchall()
        print(f"Pre-Admissions count: {len(pas)}")
        for pa in pas:
            print("  ", pa)

        if appts or pas:
            patient_ids = list(set([a['patient_id'] for a in appts if a['patient_id']] + [pa['patient_id'] for pa in pas if pa['patient_id']]))
            print(f"\n--- PATIENTS WITH IDs {patient_ids} ---")
            if patient_ids:
                cur.execute("SELECT id, patient_code, first_name, last_name, status FROM patients WHERE id IN %s;", (tuple(patient_ids),))
                pats = cur.fetchall()
                print("Patients in DB:", pats)
            else:
                print("No patient_ids associated!")

        # Let's test the EXISTS query from GET /api/dashboard/patients
        cur.execute("""
            SELECT id, patient_code, first_name, last_name, status FROM patients
            WHERE (EXISTS (
                SELECT 1 FROM appointments a WHERE a.patient_id = patients.id AND a.doctor_id = %s
            ) OR EXISTS (
                SELECT 1 FROM pre_admissions pa WHERE pa.patient_id = patients.id AND pa.doctor_id = %s
            ));
        """, (doc_id, doc_id))
        query_res = cur.fetchall()
        print(f"\n--- RESULT OF backend/api/dashboard_routes.py PATIENTS QUERY FOR DOC {doc_id} ---")
        print("Count:", len(query_res))
        for p in query_res:
            print("  ", p)

    conn.close()

if __name__ == "__main__":
    main()
