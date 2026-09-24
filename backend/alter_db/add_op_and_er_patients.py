#!/usr/bin/env python3
"""
Alter DB Script: Add 12 Outpatient (OP) and 8 Emergency (ER) Patients
Folder: backend/alter_db/add_op_and_er_patients.py

Action:
- Adds 12 new OP (Outpatient / Appointment) patients to PostgreSQL:
    * Inserted into `patients` table (unique realistic names, strictly 'Male' or 'Female')
    * Inserted into `appointments` table (OPD consultations for today with attending doctors)
    * Inserted into `patient_visits` table (visit_type: 'OPD')
    * Inserted into `vital_signs` table (baseline outpatient vitals)
- Adds 8 new ER (Emergency Room / Trauma) patients to PostgreSQL:
    * Inserted into `patients` table (unique realistic names, strictly 'Male' or 'Female')
    * Inserted into `emergency_triage` table (allocated to ER Bays with triage levels and vitals)
    * Inserted into `patient_visits` table (visit_type: 'EMERGENCY')
    * Inserted into `vital_signs` table (emergency triage vitals)
- Clears query caches so the new patients immediately reflect in the live hospital platform.
"""

import sys
import os
import datetime
from pathlib import Path

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from connectors.databricks_connector import DatabricksConnector


# 12 Unique OP (Outpatient) Patients (Gender strictly Male or Female)
OP_PATIENTS_DATA = [
    {
        "first_name": "Pranavi",
        "last_name": "Krishnan",
        "gender": "Female",
        "dob": "1994-06-14",
        "blood_group": "O+",
        "phone": "+91 98401 23101",
        "email": "pranavi.krishnan@example.com",
        "doctor_id": 1,  # Dr. Priya Patel (Cardiology)
        "dept_id": 2,
        "doctor_name": "Dr. Priya Patel",
        "complaint": "Palpitations and exertion fatigue",
        "time": "09:00:00",
        "bp": "118/76",
        "hr": 74,
        "spo2": 99.0,
        "temp": 98.4
    },
    {
        "first_name": "Devendra",
        "last_name": "Chawla",
        "gender": "Male",
        "dob": "1982-11-23",
        "blood_group": "B+",
        "phone": "+91 98401 23102",
        "email": "devendra.chawla@example.com",
        "doctor_id": 2,  # Dr. Ravi Reddy (Orthopedics)
        "dept_id": 3,
        "doctor_name": "Dr. Ravi Reddy",
        "complaint": "Right knee joint stiffness and chronic pain",
        "time": "09:30:00",
        "bp": "126/82",
        "hr": 78,
        "spo2": 98.5,
        "temp": 98.6
    },
    {
        "first_name": "Harini",
        "last_name": "Sundaresan",
        "gender": "Female",
        "dob": "1998-03-19",
        "blood_group": "A+",
        "phone": "+91 98401 23103",
        "email": "harini.sundaresan@example.com",
        "doctor_id": 5,  # Dr. Neha Nair (Gynecology)
        "dept_id": 6,
        "doctor_name": "Dr. Neha Nair",
        "complaint": "Routine antenatal trimester check-up",
        "time": "10:00:00",
        "bp": "112/70",
        "hr": 72,
        "spo2": 99.5,
        "temp": 98.2
    },
    {
        "first_name": "Rohan",
        "last_name": "Mukherjee",
        "gender": "Male",
        "dob": "1976-08-11",
        "blood_group": "AB+",
        "phone": "+91 98401 23104",
        "email": "rohan.mukherjee@example.com",
        "doctor_id": 4,  # Dr. Vikram Singh (Neurology)
        "dept_id": 5,
        "doctor_name": "Dr. Vikram Singh",
        "complaint": "Tension migraine and recurrent occipital headaches",
        "time": "10:30:00",
        "bp": "130/85",
        "hr": 80,
        "spo2": 98.0,
        "temp": 98.7
    },
    {
        "first_name": "Ananya",
        "last_name": "Sengupta",
        "gender": "Female",
        "dob": "2001-01-28",
        "blood_group": "O-",
        "phone": "+91 98401 23105",
        "email": "ananya.sengupta@example.com",
        "doctor_id": 9,  # Dr. Sneha Das (Pathology / General)
        "dept_id": 1,
        "doctor_name": "Dr. Sneha Das",
        "complaint": "Seasonal allergic rhinitis and cough",
        "time": "11:00:00",
        "bp": "110/72",
        "hr": 70,
        "spo2": 99.0,
        "temp": 98.4
    },
    {
        "first_name": "Vidyadhar",
        "last_name": "Joshi",
        "gender": "Male",
        "dob": "1968-05-15",
        "blood_group": "A-",
        "phone": "+91 98401 23106",
        "email": "vidyadhar.joshi@example.com",
        "doctor_id": 1,  # Dr. Priya Patel (Cardiology)
        "dept_id": 2,
        "doctor_name": "Dr. Priya Patel",
        "complaint": "Post-angioplasty lipid follow-up",
        "time": "11:30:00",
        "bp": "122/78",
        "hr": 68,
        "spo2": 98.2,
        "temp": 98.5
    },
    {
        "first_name": "Tanvi",
        "last_name": "Deshmukh",
        "gender": "Female",
        "dob": "1991-09-07",
        "blood_group": "B-",
        "phone": "+91 98401 23107",
        "email": "tanvi.deshmukh@example.com",
        "doctor_id": 5,  # Dr. Neha Nair
        "dept_id": 6,
        "doctor_name": "Dr. Neha Nair",
        "complaint": "Pelvic ultrasound hormonal review",
        "time": "12:00:00",
        "bp": "116/74",
        "hr": 76,
        "spo2": 99.1,
        "temp": 98.6
    },
    {
        "first_name": "Bhargav",
        "last_name": "Hegde",
        "gender": "Male",
        "dob": "1985-04-30",
        "blood_group": "O+",
        "phone": "+91 98401 23108",
        "email": "bhargav.hegde@example.com",
        "doctor_id": 2,  # Dr. Ravi Reddy (Orthopedics)
        "dept_id": 3,
        "doctor_name": "Dr. Ravi Reddy",
        "complaint": "Lumbar disc strain post workout",
        "time": "14:00:00",
        "bp": "124/80",
        "hr": 75,
        "spo2": 98.8,
        "temp": 98.3
    },
    {
        "first_name": "Kalyani",
        "last_name": "Iyer",
        "gender": "Female",
        "dob": "1962-12-10",
        "blood_group": "AB-",
        "phone": "+91 98401 23109",
        "email": "kalyani.iyer@example.com",
        "doctor_id": 9,  # Dr. Sneha Das (General Medicine)
        "dept_id": 1,
        "doctor_name": "Dr. Sneha Das",
        "complaint": "Type-2 diabetes HbA1c review",
        "time": "14:30:00",
        "bp": "128/82",
        "hr": 73,
        "spo2": 97.9,
        "temp": 98.6
    },
    {
        "first_name": "Abhishek",
        "last_name": "Nambiar",
        "gender": "Male",
        "dob": "1996-07-22",
        "blood_group": "A+",
        "phone": "+91 98401 23110",
        "email": "abhishek.nambiar@example.com",
        "doctor_id": 6,  # Dr. Suresh Menon (Surgery)
        "dept_id": 7,
        "doctor_name": "Dr. Suresh Menon",
        "complaint": "Post-op appendectomy stitch check",
        "time": "15:00:00",
        "bp": "120/78",
        "hr": 76,
        "spo2": 99.2,
        "temp": 98.4
    },
    {
        "first_name": "Swetha",
        "last_name": "Ramachandran",
        "gender": "Female",
        "dob": "1988-10-03",
        "blood_group": "B+",
        "phone": "+91 98401 23111",
        "email": "swetha.ramachandran@example.com",
        "doctor_id": 4,  # Dr. Vikram Singh (Neurology)
        "dept_id": 5,
        "doctor_name": "Dr. Vikram Singh",
        "complaint": "Peripheral numbness in left hand",
        "time": "15:30:00",
        "bp": "115/75",
        "hr": 72,
        "spo2": 98.7,
        "temp": 98.5
    },
    {
        "first_name": "Girish",
        "last_name": "Mahadevan",
        "gender": "Male",
        "dob": "1973-02-18",
        "blood_group": "O+",
        "phone": "+91 98401 23112",
        "email": "girish.mahadevan@example.com",
        "doctor_id": 1,  # Dr. Priya Patel (Cardiology)
        "dept_id": 2,
        "doctor_name": "Dr. Priya Patel",
        "complaint": "Hypertension screening follow-up",
        "time": "16:00:00",
        "bp": "135/88",
        "hr": 82,
        "spo2": 98.0,
        "temp": 98.6
    }
]


# 8 Unique ER (Emergency Room) Patients (Gender strictly Male or Female)
ER_PATIENTS_DATA = [
    {
        "first_name": "Raghavan",
        "last_name": "Natesan",
        "gender": "Male",
        "dob": "1965-03-12",
        "blood_group": "O+",
        "phone": "+91 98401 24201",
        "email": "raghavan.natesan@example.com",
        "bay": "Bay 14",
        "triage_level": "Red",
        "acuity": "Resuscitation / Critical",
        "complaint": "Acute severe substernal crushing chest pain with diaphoresis",
        "bp": "165/105",
        "hr": 112,
        "spo2": "92%",
        "doctor_name": "Dr. Divya Verma",
        "elapsed_time": "12m ago",
        "clinical_status": "Active Resuscitation",
        "mlc_flag": False
    },
    {
        "first_name": "Lavanya",
        "last_name": "Srinivasan",
        "gender": "Female",
        "dob": "1992-09-25",
        "blood_group": "A+",
        "phone": "+91 98401 24202",
        "email": "lavanya.srinivasan@example.com",
        "bay": "Bay 15",
        "triage_level": "Yellow",
        "acuity": "Emergent",
        "complaint": "Acute severe right lower quadrant abdominal pain, suspected appendicitis",
        "bp": "115/78",
        "hr": 96,
        "spo2": "98%",
        "doctor_name": "Dr. Suresh Menon",
        "elapsed_time": "25m ago",
        "clinical_status": "Surgical Workup",
        "mlc_flag": False
    },
    {
        "first_name": "Madhavan",
        "last_name": "Swaminathan",
        "gender": "Male",
        "dob": "1980-06-18",
        "blood_group": "B+",
        "phone": "+91 98401 24203",
        "email": "madhavan.swaminathan@example.com",
        "bay": "Bay 16",
        "triage_level": "Red",
        "acuity": "Emergent / Trauma",
        "complaint": "Two-wheeler road traffic accident with open right tibial fracture",
        "bp": "138/90",
        "hr": 105,
        "spo2": "96%",
        "doctor_name": "Dr. Ravi Reddy",
        "elapsed_time": "18m ago",
        "clinical_status": "Orthopedic Stabilization",
        "mlc_flag": True
    },
    {
        "first_name": "Geetha",
        "last_name": "Sundaram",
        "gender": "Female",
        "dob": "1958-11-04",
        "blood_group": "AB+",
        "phone": "+91 98401 24204",
        "email": "geetha.sundaram@example.com",
        "bay": "Bay 17",
        "triage_level": "Red",
        "acuity": "Resuscitation / Neurological",
        "complaint": "Sudden onset right-sided hemiparesis and dysarthria (Acute Stroke)",
        "bp": "178/110",
        "hr": 88,
        "spo2": "94%",
        "doctor_name": "Dr. Vikram Singh",
        "elapsed_time": "8m ago",
        "clinical_status": "CT Stroke Protocol Active",
        "mlc_flag": False
    },
    {
        "first_name": "Tejas",
        "last_name": "Kulkarni",
        "gender": "Male",
        "dob": "2003-04-16",
        "blood_group": "O-",
        "phone": "+91 98401 24205",
        "email": "tejas.kulkarni@example.com",
        "bay": "Bay 18",
        "triage_level": "Yellow",
        "acuity": "Urgent",
        "complaint": "Acute severe bronchospasm with wheezing, non-responsive to inhaler",
        "bp": "125/82",
        "hr": 102,
        "spo2": "91%",
        "doctor_name": "Dr. Divya Verma",
        "elapsed_time": "30m ago",
        "clinical_status": "Nebulization & Oxygenation",
        "mlc_flag": False
    },
    {
        "first_name": "Sunita",
        "last_name": "Bhattacharya",
        "gender": "Female",
        "dob": "1975-01-29",
        "blood_group": "B-",
        "phone": "+91 98401 24206",
        "email": "sunita.bhattacharya@example.com",
        "bay": "Bay 19",
        "triage_level": "Yellow",
        "acuity": "Urgent",
        "complaint": "Severe dehydration and orthostatic dizziness secondary to gastroenteritis",
        "bp": "95/60",
        "hr": 108,
        "spo2": "97%",
        "doctor_name": "Dr. Sneha Das",
        "elapsed_time": "45m ago",
        "clinical_status": "IV Fluid Resuscitation",
        "mlc_flag": False
    },
    {
        "first_name": "Chirag",
        "last_name": "Singhania",
        "gender": "Male",
        "dob": "1989-12-08",
        "blood_group": "A-",
        "phone": "+91 98401 24207",
        "email": "chirag.singhania@example.com",
        "bay": "Bay 20",
        "triage_level": "Red",
        "acuity": "Emergent / Allergic",
        "complaint": "Acute anaphylactoid reaction with facial angioedema and stridor",
        "bp": "90/55",
        "hr": 120,
        "spo2": "93%",
        "doctor_name": "Dr. Divya Verma",
        "elapsed_time": "5m ago",
        "clinical_status": "Inj. Adrenaline & Airway Monitor",
        "mlc_flag": False
    },
    {
        "first_name": "Deepika",
        "last_name": "Chandrasekhar",
        "gender": "Female",
        "dob": "1995-07-17",
        "blood_group": "O+",
        "phone": "+91 98401 24208",
        "email": "deepika.chandrasekhar@example.com",
        "bay": "Bay 21",
        "triage_level": "Yellow",
        "acuity": "Urgent / Trauma",
        "complaint": "Domestic burn injury to left forearm and thermal blistering",
        "bp": "120/80",
        "hr": 84,
        "spo2": "99%",
        "doctor_name": "Dr. Suresh Menon",
        "elapsed_time": "35m ago",
        "clinical_status": "Wound Dressing & Analgesia",
        "mlc_flag": False
    }
]


def add_op_and_er_patients():
    connector = DatabricksConnector()
    conn = connector.get_connection()
    cur = conn.cursor()

    try:
        print("=" * 85)
        print("CLINICAL DATABASE ALTERATION: ADDING 12 OP AND 8 ER PATIENTS")
        print("GENDER RULE: Strictly 'Male' or 'Female' | NAMES: 100% Unique Indian Names")
        print("=" * 85)

        # 1. Fetch current max IDs
        cur.execute("SELECT COALESCE(MAX(id), 87450) FROM patients;")
        next_pat_id = cur.fetchone()[0] + 1

        cur.execute("SELECT COALESCE(MAX(id), 1000660) FROM appointments;")
        next_apt_id = cur.fetchone()[0] + 1

        cur.execute("SELECT COALESCE(MAX(visit_id), 277100) FROM patient_visits;")
        next_visit_id = cur.fetchone()[0] + 1

        cur.execute("SELECT COALESCE(MAX(vital_id), 277108) FROM vital_signs;")
        next_vital_id = cur.fetchone()[0] + 1

        inserted_op = []
        inserted_er = []

        # ---------------------------------------------------------------------
        # 2. Insert 12 Outpatient (OP) Patients
        # ---------------------------------------------------------------------
        print("\n--- INSERTING 12 OUTPATIENT (OP) PATIENTS ---")
        for idx, p in enumerate(OP_PATIENTS_DATA, start=1):
            pid = next_pat_id
            next_pat_id += 1
            apt_id = next_apt_id
            next_apt_id += 1
            vid = next_visit_id
            next_visit_id += 1
            vital_id = next_vital_id
            next_vital_id += 1

            pat_code = f"MER-PAT-{pid:07d}"
            booking_id = f"APT-2026-{apt_id % 10000:04d}"

            # A. Insert into patients
            cur.execute("""
                INSERT INTO patients (
                    id, patient_code, first_name, last_name, date_of_birth, gender,
                    phone, whatsapp_number, email, address, city, state, pincode,
                    blood_group, status, preferred_language, registration_date, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                ) ON CONFLICT (id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    gender = EXCLUDED.gender;
            """, (
                pid, pat_code, p["first_name"], p["last_name"], p["dob"], p["gender"],
                p["phone"], p["phone"], p["email"], "12 Greams Road, Thousand Lights", "Chennai", "Tamil Nadu", "600006",
                p["blood_group"], "Active", "English", "2026-09-24 08:30:00", "2026-09-24 08:30:00"
            ))

            # B. Insert into appointments
            cur.execute("""
                INSERT INTO appointments (
                    id, booking_id, patient_id, doctor_id, department_id,
                    appointment_date, appointment_time, status, booking_source,
                    appointment_type, reason_for_visit, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    '2026-09-24', %s, 'CONFIRMED', 'OPD_DESK',
                    'OPD', %s, '2026-09-24 08:30:00'
                ) ON CONFLICT (id) DO NOTHING;
            """, (
                apt_id, booking_id, pid, p["doctor_id"], p["dept_id"],
                p["time"], p["complaint"]
            ))

            # C. Insert into patient_visits
            cur.execute("""
                INSERT INTO patient_visits (
                    visit_id, patient_id, doctor_id, department_id,
                    appointment_id, visit_date, visit_type, chief_complaint, visit_status
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, '2026-09-24 09:00:00', 'OPD', %s, 'In Consultation'
                ) ON CONFLICT (visit_id) DO NOTHING;
            """, (
                vid, pid, p["doctor_id"], p["dept_id"],
                apt_id, p["complaint"]
            ))

            # D. Insert baseline vitals into vital_signs
            sbp, dbp = map(int, p["bp"].split("/"))
            cur.execute("""
                INSERT INTO vital_signs (
                    vital_id, patient_id, visit_id, admission_id,
                    recorded_by, recorded_at, temperature, heart_rate,
                    systolic_bp, diastolic_bp, respiratory_rate, oxygen_saturation
                ) VALUES (
                    %s, %s, %s, NULL,
                    1, '2026-09-24 09:00:00', %s, %s,
                    %s, %s, 18, %s
                ) ON CONFLICT (vital_id) DO NOTHING;
            """, (
                vital_id, pid, vid,
                p["temp"], p["hr"], sbp, dbp, p["spo2"]
            ))

            full_name = f"{p['first_name']} {p['last_name']}"
            inserted_op.append((pid, pat_code, full_name, p["gender"], p["doctor_name"], p["complaint"], p["time"]))
            print(f"[OP #{idx:02d}] Added Patient #{pid} ({full_name}, {p['gender']}) -> Dr. {p['doctor_name']} at {p['time']}")

        # ---------------------------------------------------------------------
        # 3. Insert 8 Emergency Room (ER) Patients
        # ---------------------------------------------------------------------
        print("\n--- INSERTING 8 EMERGENCY ROOM (ER) PATIENTS ---")
        for idx, p in enumerate(ER_PATIENTS_DATA, start=1):
            pid = next_pat_id
            next_pat_id += 1
            vid = next_visit_id
            next_visit_id += 1
            vital_id = next_vital_id
            next_vital_id += 1

            pat_code = f"MER-PAT-{pid:07d}"
            er_id = f"ER-2026-{4420 + idx:04d}"

            # Calculate Age
            birth_year = int(p["dob"].split("-")[0])
            age = 2026 - birth_year
            age_gender = f"{age}{p['gender'][0]}"

            # A. Insert into patients
            cur.execute("""
                INSERT INTO patients (
                    id, patient_code, first_name, last_name, date_of_birth, gender,
                    phone, whatsapp_number, email, address, city, state, pincode,
                    blood_group, status, preferred_language, registration_date, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                ) ON CONFLICT (id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    gender = EXCLUDED.gender;
            """, (
                pid, pat_code, p["first_name"], p["last_name"], p["dob"], p["gender"],
                p["phone"], p["phone"], p["email"], "Emergency Trauma Unit, Sector 4", "Chennai", "Tamil Nadu", "600006",
                p["blood_group"], "Active", "English", "2026-09-24 07:45:00", "2026-09-24 07:45:00"
            ))

            # B. Insert into emergency_triage
            cur.execute("""
                INSERT INTO emergency_triage (
                    id, bay, patient_name, age_gender, triage_level, chief_complaint,
                    bp, hr, spo2, doctor_name, elapsed_time, clinical_status,
                    created_at, arrival_time, waiting_time, acuity, critical_alert, mlc_flag
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    '2026-09-24 08:00:00', '08:00 AM', '4m', %s, %s, %s
                ) ON CONFLICT (id) DO UPDATE SET
                    bay = EXCLUDED.bay,
                    patient_name = EXCLUDED.patient_name,
                    clinical_status = EXCLUDED.clinical_status;
            """, (
                er_id, p["bay"], f"{p['first_name']} {p['last_name']}", age_gender, p["triage_level"], p["complaint"],
                p["bp"], p["hr"], p["spo2"], p["doctor_name"], p["elapsed_time"], p["clinical_status"],
                p["acuity"], "Critical Alert" if p["triage_level"] == "Red" else "Monitoring", p["mlc_flag"]
            ))

            # C. Insert into patient_visits
            cur.execute("""
                INSERT INTO patient_visits (
                    visit_id, patient_id, doctor_id, department_id,
                    appointment_id, visit_date, visit_type, chief_complaint, visit_status
                ) VALUES (
                    %s, %s, 7, 8,
                    NULL, '2026-09-24 08:00:00', 'EMERGENCY', %s, 'Under Triage'
                ) ON CONFLICT (visit_id) DO NOTHING;
            """, (
                vid, pid, p["complaint"][:50]
            ))

            # D. Insert into vital_signs
            sbp, dbp = map(int, p["bp"].split("/"))
            spo2_val = float(p["spo2"].replace("%", ""))
            cur.execute("""
                INSERT INTO vital_signs (
                    vital_id, patient_id, visit_id, admission_id,
                    recorded_by, recorded_at, temperature, heart_rate,
                    systolic_bp, diastolic_bp, respiratory_rate, oxygen_saturation
                ) VALUES (
                    %s, %s, %s, NULL,
                    1, '2026-09-24 08:15:00', 98.6, %s,
                    %s, %s, 22, %s
                ) ON CONFLICT (vital_id) DO NOTHING;
            """, (
                vital_id, pid, vid,
                p["hr"], sbp, dbp, spo2_val
            ))

            full_name = f"{p['first_name']} {p['last_name']}"
            inserted_er.append((pid, er_id, full_name, p["gender"], p["bay"], p["triage_level"], p["complaint"]))
            print(f"[ER #{idx:02d}] Added Patient #{pid} ({full_name}, {p['gender']}) -> {p['bay']} [{p['triage_level']}] - {p['clinical_status']}")

        # 4. Commit all operations
        conn.commit()
        DatabricksConnector.clear_cache()
        print("\n[OK] Transaction committed and DatabricksConnector cache cleared.")

        print("\n" + "=" * 85)
        print("SUMMARY OF DATABASE UPDATES:")
        print(f"  - Total New Outpatient (OP) Patients Inserted : {len(inserted_op)}")
        print(f"  - Total New Emergency (ER) Patients Inserted  : {len(inserted_er)}")
        print("=" * 85)
        return True

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Database insertion failed: {e}", file=sys.stderr)
        return False
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    add_op_and_er_patients()
