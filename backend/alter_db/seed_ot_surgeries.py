import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("backend/.env")

conn = psycopg2.connect(
    dbname=os.getenv("POSTGRES_DB", "live_test"),
    user=os.getenv("POSTGRES_USER", "postgres"),
    password=os.getenv("POSTGRES_PASSWORD", "postgres"),
    host=os.getenv("POSTGRES_HOST", "localhost"),
    port=os.getenv("POSTGRES_PORT", "5432")
)
cur = conn.cursor()

# Ensure ot_surgeries table exists and has all required columns
cur.execute("""
    CREATE TABLE IF NOT EXISTS ot_surgeries (
        id SERIAL PRIMARY KEY,
        case_number VARCHAR(64) UNIQUE,
        ot_suite VARCHAR(64),
        patient_name VARCHAR(128),
        procedure_name VARCHAR(256),
        lead_surgeon VARCHAR(128),
        anesthetist VARCHAR(128),
        intraop_stage VARCHAR(128),
        stage VARCHAR(64),
        start_time VARCHAR(32),
        end_time VARCHAR(32),
        status VARCHAR(64),
        consent_status VARCHAR(64),
        is_emergency BOOLEAN DEFAULT FALSE,
        is_delayed BOOLEAN DEFAULT FALSE,
        blood_reserved VARCHAR(128),
        sterile_set_verified BOOLEAN DEFAULT TRUE,
        pacu_bed VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
""")
conn.commit()

# Clean existing records
cur.execute("TRUNCATE TABLE ot_surgeries RESTART IDENTITY;")
conn.commit()

# Dynamic Surgical Cases aligned with real patients from dim_admission_inputs & real doctors
surgical_cases = [
    {
        "case_number": "SUR-2026-401",
        "ot_suite": "OT-1 (Cardiac)",
        "patient_name": "Keviner Parthalan",
        "procedure_name": "CABG (Triple Vessel Bypass)",
        "lead_surgeon": "Dr. Priya Patel",
        "anesthetist": "Dr. Rahul Kumar",
        "intraop_stage": "Distal Anastomosis on CPB",
        "stage": "In progress",
        "start_time": "08:30 AM",
        "end_time": "01:00 PM",
        "status": "In OT",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "4 PRBC Cross-matched",
        "sterile_set_verified": True,
        "pacu_bed": "PACU-01"
    },
    {
        "case_number": "SUR-2026-402",
        "ot_suite": "OT-2 (General)",
        "patient_name": "Rohiter Parthalan",
        "procedure_name": "Laparoscopic Cholecystectomy",
        "lead_surgeon": "Dr. Suresh Menon",
        "anesthetist": "Dr. Deepak Singh",
        "intraop_stage": "Dissecting Calot Triangle",
        "stage": "In progress",
        "start_time": "10:00 AM",
        "end_time": "11:45 AM",
        "status": "In OT",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": True,
        "blood_reserved": "2 PRBC Reserved",
        "sterile_set_verified": True,
        "pacu_bed": "PACU-03"
    },
    {
        "case_number": "SUR-2026-403",
        "ot_suite": "Cath Lab 1",
        "patient_name": "Vijayer Parthalan",
        "procedure_name": "PTCA + Drug Eluting Stent (LAD)",
        "lead_surgeon": "Dr. Sanjay Jain",
        "anesthetist": "Dr. Arun Menon",
        "intraop_stage": "Post-PCI Hemostasis / Monitoring",
        "stage": "Recovery (PACU)",
        "start_time": "08:00 AM",
        "end_time": "09:45 AM",
        "status": "In PACU",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "None Required",
        "sterile_set_verified": True,
        "pacu_bed": "PACU-02"
    },
    {
        "case_number": "SUR-2026-404",
        "ot_suite": "OT-4 (Emergency)",
        "patient_name": "Luciferer Parthalan",
        "procedure_name": "Emergency Appendectomy (Perforated)",
        "lead_surgeon": "Dr. Rajesh Singh",
        "anesthetist": "Dr. Rahul Kumar",
        "intraop_stage": "PACU Recovery & Extubation Check",
        "stage": "Recovery (PACU)",
        "start_time": "07:15 AM",
        "end_time": "09:00 AM",
        "status": "In PACU",
        "consent_status": "Obtained",
        "is_emergency": True,
        "is_delayed": False,
        "blood_reserved": "2 PRBC Reserved",
        "sterile_set_verified": True,
        "pacu_bed": "PACU-04"
    },
    {
        "case_number": "SUR-2026-405",
        "ot_suite": "OT-3 (Ortho)",
        "patient_name": "Jameser Parthalan",
        "procedure_name": "Open Reduction & Internal Fixation (ORIF)",
        "lead_surgeon": "Dr. Ravi Reddy",
        "anesthetist": "Dr. Mahesh Reddy",
        "intraop_stage": "Pre-op Regional Spinal Block",
        "stage": "Pre-op",
        "start_time": "11:15 AM",
        "end_time": "01:30 PM",
        "status": "Pre-op",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "2 PRBC Reserved",
        "sterile_set_verified": True,
        "pacu_bed": None
    },
    {
        "case_number": "SUR-2026-406",
        "ot_suite": "OT-4 (Emergency)",
        "patient_name": "Adityaer Parthalan",
        "procedure_name": "Emergency Cesarean Section (LSCS)",
        "lead_surgeon": "Dr. Neha Nair",
        "anesthetist": "Dr. Arun Menon",
        "intraop_stage": "Pre-op Anesthesia & Fetal Monitoring",
        "stage": "Pre-op",
        "start_time": "11:30 AM",
        "end_time": "01:00 PM",
        "status": "Pre-op",
        "consent_status": "Awaiting consent",
        "is_emergency": True,
        "is_delayed": False,
        "blood_reserved": "2 PRBC Reserved",
        "sterile_set_verified": True,
        "pacu_bed": None
    },
    {
        "case_number": "SUR-2026-407",
        "ot_suite": "OT-3 (Ortho)",
        "patient_name": "Senthilel Parthalan",
        "procedure_name": "Total Hip Replacement (Left)",
        "lead_surgeon": "Dr. Amit Sharma",
        "anesthetist": "Dr. Mahesh Reddy",
        "intraop_stage": "Scheduled Next in OT-3",
        "stage": "Scheduled",
        "start_time": "02:00 PM",
        "end_time": "04:30 PM",
        "status": "Scheduled",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "2 PRBC Reserved",
        "sterile_set_verified": True,
        "pacu_bed": None
    },
    {
        "case_number": "SUR-2026-408",
        "ot_suite": "OT-2 (General)",
        "patient_name": "Samer Parthalan",
        "procedure_name": "Inguinal Hernia Mesh Repair",
        "lead_surgeon": "Dr. Suresh Menon",
        "anesthetist": "Dr. Deepak Singh",
        "intraop_stage": "Scheduled Afternoon Slotted",
        "stage": "Scheduled",
        "start_time": "01:30 PM",
        "end_time": "03:00 PM",
        "status": "Scheduled",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "None Required",
        "sterile_set_verified": True,
        "pacu_bed": None
    },
    {
        "case_number": "SUR-2026-409",
        "ot_suite": "Cath Lab 1",
        "patient_name": "Venkateshel Parthalan",
        "procedure_name": "Coronary Angiography + FFR",
        "lead_surgeon": "Dr. Sanjay Jain",
        "anesthetist": "Dr. Arun Menon",
        "intraop_stage": "Scheduled Next in Cath Lab",
        "stage": "Scheduled",
        "start_time": "12:30 PM",
        "end_time": "01:45 PM",
        "status": "Scheduled",
        "consent_status": "Awaiting consent",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "None Required",
        "sterile_set_verified": True,
        "pacu_bed": None
    },
    {
        "case_number": "SUR-2026-410",
        "ot_suite": "OT-3 (Ortho)",
        "patient_name": "Aaravel Parthalan",
        "procedure_name": "Arthroscopic ACL Reconstruction",
        "lead_surgeon": "Dr. Ravi Reddy",
        "anesthetist": "Dr. Mahesh Reddy",
        "intraop_stage": "Discharged to Inpatient Ward",
        "stage": "Completed",
        "start_time": "06:30 AM",
        "end_time": "08:30 AM",
        "status": "Completed",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "None Required",
        "sterile_set_verified": True,
        "pacu_bed": "PACU-05"
    },
    {
        "case_number": "SUR-2026-411",
        "ot_suite": "OT-2 (General)",
        "patient_name": "Meenakshiel Parthalan",
        "procedure_name": "Umbilical Hernia Repair",
        "lead_surgeon": "Dr. Suresh Menon",
        "anesthetist": "Dr. Deepak Singh",
        "intraop_stage": "Discharged to Ward · Stable",
        "stage": "Completed",
        "start_time": "07:00 AM",
        "end_time": "08:45 AM",
        "status": "Completed",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "None Required",
        "sterile_set_verified": True,
        "pacu_bed": "PACU-02"
    },
    {
        "case_number": "SUR-2026-412",
        "ot_suite": "OT-1 (Cardiac)",
        "patient_name": "Muruganel Parthalan",
        "procedure_name": "Aortic Valve Replacement",
        "lead_surgeon": "Dr. Priya Patel",
        "anesthetist": "Dr. Rahul Kumar",
        "intraop_stage": "Transferred to CCU Post-Op",
        "stage": "Completed",
        "start_time": "05:30 AM",
        "end_time": "08:15 AM",
        "status": "Completed",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "4 PRBC Cross-matched",
        "sterile_set_verified": True,
        "pacu_bed": "PACU-01"
    },
    {
        "case_number": "SUR-2026-413",
        "ot_suite": "OT-2 (General)",
        "patient_name": "Kavithael Parthalan",
        "procedure_name": "Diagnostic Laparoscopy & Adhesiolysis",
        "lead_surgeon": "Dr. Rajesh Singh",
        "anesthetist": "Dr. Deepak Singh",
        "intraop_stage": "Awaiting PAC Clearance & Blood Crossmatch",
        "stage": "Requested",
        "start_time": "03:30 PM",
        "end_time": "05:00 PM",
        "status": "Requested",
        "consent_status": "Awaiting consent",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "2 PRBC Reserved",
        "sterile_set_verified": False,
        "pacu_bed": None
    },
    {
        "case_number": "SUR-2026-414",
        "ot_suite": "OT-3 (Ortho)",
        "patient_name": "Saanvier Parthalan",
        "procedure_name": "Carpal Tunnel Release (Bilateral)",
        "lead_surgeon": "Dr. Amit Sharma",
        "anesthetist": "Dr. Mahesh Reddy",
        "intraop_stage": "Surgical Booking Approved · Awaiting Day Ward Call",
        "stage": "Approved",
        "start_time": "04:30 PM",
        "end_time": "05:45 PM",
        "status": "Approved",
        "consent_status": "Obtained",
        "is_emergency": False,
        "is_delayed": False,
        "blood_reserved": "None Required",
        "sterile_set_verified": True,
        "pacu_bed": None
    }
]

for c in surgical_cases:
    cur.execute("""
        INSERT INTO ot_surgeries (
            case_number, ot_suite, patient_name, procedure_name, lead_surgeon, anesthetist,
            intraop_stage, stage, start_time, end_time, status, consent_status,
            is_emergency, is_delayed, blood_reserved, sterile_set_verified, pacu_bed
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        c["case_number"], c["ot_suite"], c["patient_name"], c["procedure_name"],
        c["lead_surgeon"], c["anesthetist"], c["intraop_stage"], c["stage"],
        c["start_time"], c["end_time"], c["status"], c["consent_status"],
        c["is_emergency"], c["is_delayed"], c["blood_reserved"],
        c["sterile_set_verified"], c["pacu_bed"]
    ))

conn.commit()

cur.execute("SELECT COUNT(*) FROM ot_surgeries;")
print(f"Successfully populated ot_surgeries table. Total active cases: {cur.fetchone()[0]}")

cur.execute("SELECT id, case_number, ot_suite, patient_name, procedure_name, lead_surgeon, stage, status FROM ot_surgeries ORDER BY id;")
for r in cur.fetchall():
    print(r)

conn.close()
