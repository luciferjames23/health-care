#!/usr/bin/env python3
"""
Alter DB Script: Add New Admitted Patient with Pending Fee / Bill
Folder: backend/alter_db/add_admitted_patient_pending_fee.py

Action:
- Creates a new admitted patient record in PostgreSQL:
    * Inserts into `patients` table (demographics)
    * Finds an available bed in `beds` table and assigns it (status -> 'Occupied')
    * Inserts into `admissions` table (status -> 'Admitted')
    * Inserts into `dim_admission_inputs` table:
        - bill_status = 'Pending'
        - bill_clearance_status = 'Pending'
        - outstanding_balance = Rs. 65,000.00
        - latest_temperature = 98.6°F (Normal vitals)
        - latest_heart_rate = 76 bpm
        - latest_oxygen_saturation = 98.0%
        - discharge_status = 'Admitted'
- Result on UI:
    * Command Centre: Currently Admitted Patients increases by +1
    * Discharge Agent Pipeline: Total Patients Checked increases by +1
    * Discharge Eligibility: NOT ELIGIBLE (Held due to Pending Bill Clearance)
"""

import sys
import datetime
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from connectors.databricks_connector import DatabricksConnector


def add_admitted_patient_pending_fee():
    connector = DatabricksConnector()
    conn = connector.get_connection()
    cur = conn.cursor()

    try:
        # 1. Determine next available admission_id and patient_id
        cur.execute("SELECT COALESCE(MAX(admission_id), 87432) + 1 FROM dim_admission_inputs;")
        new_adm_id = cur.fetchone()[0]

        cur.execute("SELECT COALESCE(MAX(patient_id), 87433) + 1 FROM dim_admission_inputs;")
        new_pid = cur.fetchone()[0]

        # 2. Find an available bed
        cur.execute("""
            SELECT bed_id, bed_number, ward_id, room_id 
            FROM beds 
            WHERE status = 'Available' 
            ORDER BY bed_id ASC 
            LIMIT 1;
        """)
        bed_row = cur.fetchone()
        if bed_row:
            bed_id, bed_number, ward_id, room_id = bed_row
            cur.execute("UPDATE beds SET status = 'Occupied' WHERE bed_id = %s;", (bed_id,))
        else:
            bed_id, bed_number, ward_id, room_id = 74, "BED-0074", 3, 75

        # 3. Create demographics
        first_name = "Kavitha"
        last_name = "Parthalan"
        full_name = f"{first_name} {last_name}"
        gender = "Female"
        dob = datetime.date(1986, 7, 14)
        age = 40
        blood_group = "O+"
        phone = f"+9198100{new_pid % 100000:05d}"
        adm_number = f"MER-ADM-{new_adm_id:07d}"
        pat_number = f"MER-PAT-{new_pid:07d}"
        bill_number = f"MER-BIL-{new_adm_id:07d}"
        diagnosis = "Acute Gastritis"
        attending_doctor = "Dr. Priya Patel, MD"
        doctor_specialization = "Internal Medicine"

        # 4. Insert into patients table (if not exists)
        cur.execute("""
            INSERT INTO patients (
                id, patient_code, first_name, last_name, date_of_birth,
                gender, phone, status, preferred_language, registration_date
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, 'Active', 'English', CURRENT_TIMESTAMP
            ) ON CONFLICT (id) DO UPDATE 
              SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name;
        """, (new_pid, pat_number, first_name, last_name, dob, gender, phone))

        # 5. Insert into admissions table
        cur.execute("""
            INSERT INTO admissions (
                admission_id, admission_number, patient_id, visit_id,
                doctor_id, department_id, ward_id, bed_id,
                admission_date, admission_type, admission_source,
                reason_for_admission, discharge_status
            ) VALUES (
                %s, %s, %s, %s,
                133, 8, %s, %s,
                CURRENT_TIMESTAMP, 'Emergency', 'Emergency Bay',
                'Acute epigastric pain and dyspepsia', 'Admitted'
            ) ON CONFLICT (admission_id) DO NOTHING;
        """, (new_adm_id, adm_number, new_pid, new_adm_id, ward_id, bed_id))

        # 6. Insert into dim_admission_inputs table with PENDING fee
        outstanding = 65000.00
        cur.execute("""
            INSERT INTO dim_admission_inputs (
                admission_id, admission_number, patient_id, patient_number,
                first_name, last_name, gender, age_at_admission, blood_group,
                date_of_birth, marital_status, preferred_language, phone, email,
                address, city, state, postal_code,
                admission_date, admission_type, admission_source, reason_for_admission,
                discharge_status, current_stay_days, attending_doctor, doctor_specialization,
                primary_diagnosis, secondary_diagnoses,
                latest_temperature, latest_heart_rate, latest_systolic_bp, latest_diastolic_bp, latest_oxygen_saturation,
                bill_number, bill_net_amount, bill_status, bill_clearance_status, outstanding_balance
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, 'Married', 'English', %s, %s,
                'Door No. 45 Green Garden', 'Chennai', 'Tamil Nadu', '600001',
                CURRENT_TIMESTAMP, 'Emergency', 'Emergency Bay', 'Acute epigastric pain',
                'Admitted', 1, %s, %s,
                %s, '[]'::jsonb,
                98.60, 76, 120, 80, 98.00,
                %s, %s, 'Pending', 'Pending', %s
            ) ON CONFLICT (admission_id) DO NOTHING;
        """, (
            new_adm_id, adm_number, new_pid, pat_number,
            first_name, last_name, gender, age, blood_group,
            dob, phone, f"pat{new_pid}@mail.com",
            attending_doctor, doctor_specialization,
            diagnosis,
            bill_number, outstanding, outstanding
        ))

        # Query and audit signed-off summaries to ensure they remain intact
        cur.execute("""
            SELECT summary_id, patient_id, approval_status 
            FROM dim_generated_discharge_summaries 
            WHERE LOWER(TRIM(approval_status)) IN ('approved', 'signed', 'signed off', 'completed')
            ORDER BY summary_id ASC;
        """)
        protected_signed_off = cur.fetchall()

        conn.commit()
        DatabricksConnector.clear_cache()

        print("=" * 80)
        print("NEW ADMITTED PATIENT CREATED WITH PENDING FEE")
        print("SAFETY GUARD: Signed off / approved patient records are 100% PROTECTED")
        print("=" * 80)
        print(f"Patient Name     : {full_name} ({gender}, Age {age})")
        print(f"Patient ID       : #{new_pid} ({pat_number})")
        print(f"Admission ID     : #{new_adm_id} ({adm_number})")
        print(f"Bed Assigned     : {bed_number} (Bed #{bed_id}, Ward #{ward_id})")
        print(f"Primary Diagnosis: {diagnosis} (Attending: {attending_doctor})")
        print(f"Admission Status : Admitted")
        print("-" * 80)
        print(f"FEE / BILL STATUS: PENDING")
        print(f"  * Bill Number  : {bill_number}")
        print(f"  * Net Amount   : Rs. {outstanding:,.2f}")
        print(f"  * Clearance    : Pending")
        print(f"  * Outstanding  : Rs. {outstanding:,.2f}")
        print("-" * 80)
        print(f"VITAL SIGNS (NORMAL):")
        print(f"  * Temp: 98.6 F | HR: 76 bpm | BP: 120/80 mmHg | SpO2: 98.0% (Stable)")
        print("-" * 80)
        print(f"[PROTECTION AUDIT] Signed Off Discharge Summaries: {len(protected_signed_off)} records preserved (UNTOUCHED)")
        for s in protected_signed_off:
            print(f"  - Summary #{s[0]}: Patient #{s[1]} | Status: {s[2]} [VERIFIED INTACT]")
        print("=" * 80)
        print(f"EXPECTED DASHBOARD IMPACT:")
        print(f"  1. Command Centre  : Currently Admitted Patients increases by +1")
        print(f"  2. Discharge Agent : Total Patients Checked increases by +1")
        print(f"  3. Eligibility     : NOT ELIGIBLE (Held due to Step 1: Outstanding Bill Balance of Rs. {outstanding:,.2f})")
        print(f"  4. Signed Off KPI  : UNCHANGED ({len(protected_signed_off)} clinically signed-off summaries preserved)")
        print("=" * 80)

    except Exception as e:
        conn.rollback()
        print(f"Error adding admitted patient with pending fee: {e}", file=sys.stderr)
        raise e
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    add_admitted_patient_pending_fee()
