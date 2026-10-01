import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import psycopg2
from psycopg2.extras import RealDictCursor
import db_config
import requests

BASE_URL = "http://localhost:8000"

def investigate():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("============================================================")
    print("STEP 1: INVESTIGATE DOCTOR RECORD FOR 'Dr. Moorthy D'")
    print("============================================================")
    cur.execute("SELECT id, user_id, display_name, first_name, last_name, department_id, status FROM doctors WHERE display_name LIKE '%Moorthy%' OR first_name LIKE '%Moorthy%';")
    doctors = cur.fetchall()
    print("Doctors found:", doctors)

    if not doctors:
        print("ERROR: No doctor found matching 'Moorthy'")
        conn.close()
        return

    doc_id = doctors[0]['id']
    doc_user_id = doctors[0]['user_id']
    doc_name = doctors[0]['display_name']
    print(f"Target Doctor: ID={doc_id}, UserID={doc_user_id}, Name='{doc_name}'")

    print("\n============================================================")
    print("STEP 2: INVESTIGATE USER ACCOUNT FOR 'Dr. Moorthy D'")
    print("============================================================")
    cur.execute("""
        SELECT u.id, u.username, u.email, r.name as role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = %s;
    """, (doc_user_id,))
    users = cur.fetchall()
    print("User accounts found:", users)

    print("\n============================================================")
    print("STEP 3: INVESTIGATE APPOINTMENTS FOR DOCTOR ID =", doc_id)
    print("============================================================")
    cur.execute("SELECT id, booking_id, patient_id, doctor_id, appointment_date, status, booking_source FROM appointments WHERE doctor_id = %s;", (doc_id,))
    appts = cur.fetchall()
    print(f"Appointments count for doctor_id={doc_id}: {len(appts)}")
    for a in appts:
        print("  -", a)

    print("\n============================================================")
    print("STEP 4: INVESTIGATE ALL APPOINTMENTS WITH DOCTOR NAME LIKE 'Moorthy'")
    print("============================================================")
    cur.execute("""
        SELECT a.id, a.booking_id, a.patient_id, a.doctor_id, d.display_name, a.appointment_date, a.status 
        FROM appointments a 
        LEFT JOIN doctors d ON d.id = a.doctor_id 
        WHERE d.display_name LIKE '%Moorthy%';
    """)
    appts_by_name = cur.fetchall()
    print(f"Appointments count by doctor display_name: {len(appts_by_name)}")
    for a in appts_by_name:
        print("  -", a)

    print("\n============================================================")
    print("STEP 5: INVESTIGATE PRE-ADMISSIONS FOR DOCTOR ID =", doc_id)
    print("============================================================")
    cur.execute("SELECT id, patient_id, doctor_id, status FROM pre_admissions WHERE doctor_id = %s;", (doc_id,))
    pas = cur.fetchall()
    print(f"Pre-admissions count for doctor_id={doc_id}: {len(pas)}")
    for pa in pas:
        print("  -", pa)

    print("\n============================================================")
    print("STEP 6: INVESTIGATE ADMISSIONS FOR DOCTOR ID =", doc_id)
    print("============================================================")
    cur.execute("SELECT admission_id, patient_id, doctor_id, discharge_status FROM admissions WHERE doctor_id = %s;", (doc_id,))
    adms = cur.fetchall()
    print(f"Admissions count for doctor_id={doc_id}: {len(adms)}")
    for adm in adms:
        print("  -", adm)

    conn.close()

if __name__ == "__main__":
    investigate()
