import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import psycopg2
from psycopg2.extras import RealDictCursor
import db_config

def test():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT DISTINCT ON (apt.patient_id, apt.doctor_id)
            p.id AS patient_id,
            p.patient_code,
            p.first_name,
            p.last_name,
            (p.first_name || ' ' || COALESCE(p.last_name, '')) AS patient_name,
            p.date_of_birth,
            EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
            p.gender,
            p.phone,
            COALESCE(p.preferred_language, 'English') AS preferred_language,
            p.blood_group,
            NULL::int AS admission_id,
            apt.booking_id AS admission_number,
            apt.appointment_date AS admission_date,
            NULL::date AS discharge_date,
            apt.status AS discharge_status,
            COALESCE(apt.reason_for_visit, pv.chief_complaint, 'Routine Outpatient Follow-up') AS diagnosis,
            COALESCE(dep.department_name, 'Outpatient Clinic') AS department,
            'OPD Desk' AS bed_number,
            COALESCE(d.display_name, 'Consultant Doctor') AS doctor,
            'OP' AS patient_type,
            COALESCE(apt.status, 'CONFIRMED') AS status,
            'Direct / Outpatient' AS insurer
        FROM appointments apt
        JOIN patients p ON p.id = apt.patient_id
        LEFT JOIN doctors d ON d.id = apt.doctor_id
        LEFT JOIN departments dep ON dep.id = apt.department_id
        LEFT JOIN patient_visits pv ON pv.appointment_id = apt.id
        WHERE apt.status != 'CANCELLED'
        ORDER BY apt.patient_id, apt.doctor_id, apt.appointment_date DESC, apt.id DESC;
    """)
    rows = cur.fetchall()
    print("Total OP Patient-Doctor Pairs:", len(rows))
    
    edwin_patients = [r for r in rows if r['doctor'] == 'Dr. Edwin Stephano J']
    print(f"\nDr. Edwin Stephano J Patients ({len(edwin_patients)}):")
    for p in edwin_patients:
        print("  -", p['patient_id'], p['patient_code'], p['patient_name'], "Status:", p['status'])

    conn.close()

if __name__ == "__main__":
    test()
