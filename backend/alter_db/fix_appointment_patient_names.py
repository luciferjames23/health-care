#!/usr/bin/env python3
"""
Fix Appointments Patient Names & Missing Patients
Folder: backend/alter_db/fix_appointment_patient_names.py
"""

import sys
from pathlib import Path
import random

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from api.dashboard_routes import get_conn
import psycopg2.extras

FIRST_NAMES_MALE = [
    "Rajesh", "Suresh", "Ramesh", "Venkatesh", "Anand", "Murugan", "Karthik", "Sanjay",
    "Vikram", "Rahul", "Arun", "Manoj", "Deepak", "Amit", "Praveen", "Siddharth",
    "Aarav", "Rohan", "Devendra", "Vijay", "Ashok", "Ganesh", "Senthil", "Harish", "Manish"
]
FIRST_NAMES_FEMALE = [
    "Priya", "Ananya", "Deepika", "Kavitha", "Meenakshi", "Lakshmi", "Divya", "Pooja",
    "Sneha", "Shreya", "Harini", "Pranavi", "Swathi", "Sandhya", "Radhika", "Bhavani",
    "Aishwarya", "Revathi", "Sangeetha", "Nisha", "Rupali", "Anjali", "Sunita", "Malathi"
]
LAST_NAMES = [
    "Patel", "Kumar", "Sharma", "Iyer", "Nair", "Reddy", "Singh", "Gupta", "Rao",
    "Das", "Narayanan", "Sundaram", "Balaji", "Vaidya", "Bose", "Menon", "Pillai",
    "Chawla", "Mukherjee", "Krishnan", "Sundaresan", "Seshadri", "Joshi", "Verma"
]

def main():
    conn = get_conn()
    cur = conn.cursor()

    print("Step 1: Fixing appointments with patient_id >= 1,000,000...")
    cur.execute("""
        UPDATE appointments 
        SET patient_id = patient_id - 1000000 
        WHERE patient_id >= 1000000;
    """)
    print(f"Updated {cur.rowcount} appointments.")

    print("\nStep 2: Fixing pre_admissions with patient_id / appointment_id >= 1,000,000...")
    cur.execute("""
        UPDATE pre_admissions 
        SET patient_id = patient_id - 1000000 
        WHERE patient_id >= 1000000;
    """)
    pa_pat_count = cur.rowcount
    cur.execute("""
        UPDATE pre_admissions 
        SET appointment_id = appointment_id - 1000000 
        WHERE appointment_id >= 1000000;
    """)
    pa_apt_count = cur.rowcount
    print(f"Updated {pa_pat_count} pre_admissions patients, {pa_apt_count} appointment references.")

    print("\nStep 3: Checking missing patients in patients table (87471 to 142857)...")
    cur.execute("""
        SELECT DISTINCT a.patient_id 
        FROM appointments a 
        LEFT JOIN patients p ON a.patient_id = p.id 
        WHERE p.id IS NULL AND a.patient_id IS NOT NULL
        ORDER BY a.patient_id;
    """)
    missing_ids = [r[0] for r in cur.fetchall() if r[0] is not None]
    print(f"Found {len(missing_ids)} missing patient IDs in appointments.")

    if missing_ids:
        print(f"Inserting {len(missing_ids)} patients into patients table in batches...")
        batch_size = 5000
        patients_to_insert = []
        
        # Use deterministic random seed for repeatable realistic profiles
        rnd = random.Random(42)

        for pid in missing_ids:
            is_male = rnd.random() < 0.5
            gender = "Male" if is_male else "Female"
            fn = rnd.choice(FIRST_NAMES_MALE if is_male else FIRST_NAMES_FEMALE)
            ln = rnd.choice(LAST_NAMES)
            p_code = f"MER-PAT-{str(pid).zfill(7)}"
            phone = f"+91 98401 {str(pid % 100000).zfill(5)}"
            birth_year = rnd.randint(1955, 2010)
            birth_month = rnd.randint(1, 12)
            birth_day = rnd.randint(1, 28)
            dob = f"{birth_year}-{birth_month:02d}-{birth_day:02d}"
            blood = rnd.choice(["O+", "A+", "B+", "AB+", "O-", "A-", "B-"])
            
            patients_to_insert.append((
                pid, p_code, fn, ln, dob, gender, phone, phone,
                f"{fn.lower()}.{ln.lower()}{pid}@meridian-patient.com",
                "Chennai, Tamil Nadu", "Chennai", "Tamil Nadu", "600099",
                blood, "Active", "2026-01-01 00:00:00"
            ))

        insert_sql = """
            INSERT INTO patients (
                id, patient_code, first_name, last_name, date_of_birth, gender,
                phone, whatsapp_number, email, address, city, state, pincode,
                blood_group, status, created_at
            ) VALUES %s
            ON CONFLICT (id) DO NOTHING;
        """

        for i in range(0, len(patients_to_insert), batch_size):
            chunk = patients_to_insert[i:i+batch_size]
            psycopg2.extras.execute_values(cur, insert_sql, chunk)
            print(f"  Inserted batch {i // batch_size + 1} ({len(chunk)} patients)...")

    conn.commit()
    print("\nStep 4: Verifying appointments join with patients...")
    cur.execute("""
        SELECT 
            COUNT(*) as total_appointments,
            COUNT(p.id) as matched_patients,
            COUNT(*) - COUNT(p.id) as unmatched_patients
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id;
    """)
    total, matched, unmatched = cur.fetchone()
    print(f"Total Appointments: {total}")
    print(f"Matched Patients:   {matched} ({matched / total * 100:.2f}%)")
    print(f"Unmatched Patients: {unmatched}")

    print("\nSample top September 2026 appointments now:")
    cur.execute("""
        SELECT a.booking_id, p.first_name || ' ' || p.last_name as patient_name, p.patient_code, p.phone, d.display_name, a.appointment_date, a.appointment_time
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        WHERE a.appointment_date >= '2026-09-25' AND a.appointment_date <= '2026-09-30'
        ORDER BY a.appointment_date DESC, a.appointment_time DESC
        LIMIT 10;
    """)
    for r in cur.fetchall():
        print(f"  {r[0]}: {r[1]} ({r[2]}, {r[3]}) -> {r[4]} on {r[5]} at {r[6]}")

    cur.close()
    conn.close()
    print("\nCompleted successfully!")

if __name__ == "__main__":
    main()
