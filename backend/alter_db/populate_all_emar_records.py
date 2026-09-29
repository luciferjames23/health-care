import psycopg2
import os
import random
from dotenv import load_dotenv

load_dotenv('backend/.env')

conn = psycopg2.connect(
    host=os.getenv('POSTGRES_HOST', 'localhost'),
    port=os.getenv('POSTGRES_PORT', '5432'),
    dbname=os.getenv('POSTGRES_DB', 'healthcare_db'),
    user=os.getenv('POSTGRES_USER', 'postgres'),
    password=os.getenv('POSTGRES_PASSWORD', 'admin')
)
cur = conn.cursor()

# 1. Clear old dummy emar_records
cur.execute("TRUNCATE TABLE emar_records RESTART IDENTITY;")

# 2. Fetch all 202 active inpatients from dim_admission_inputs
cur.execute("""
    SELECT 
        admission_id,
        patient_number,
        first_name,
        last_name,
        ward_name,
        bed_number,
        primary_diagnosis,
        attending_doctor
    FROM dim_admission_inputs
    WHERE discharge_status != 'Discharged'
    ORDER BY admission_id ASC;
""")
admitted_patients = cur.fetchall()
print(f"Fetched {len(admitted_patients)} active admitted patients for eMAR creation.")

nurses = [
    "Anitha Kumar, RN",
    "Sneha Rao, RN",
    "Divya Kumar, RN",
    "Rajesh Nair, RN",
    "Pooja Sharma, RN",
    "Kavitha Sundaram, RN",
    "Priya Mohan, RN",
    "Deepa Krishnan, RN"
]

medications_catalog = {
    "cardiac": [
        ("Tab. Metoprolol Tartrate", "25 mg PO BID", False),
        ("Tab. Atorvastatin", "40 mg PO HS", False),
        ("Inj. Enoxaparin Sodium", "40 mg / 0.4 mL SC OD", True),
        ("Tab. Clopidogrel", "75 mg PO OD", False),
        ("Tab. Enalapril Maleate", "5 mg PO BD", False),
        ("Inj. Furosemide", "20 mg IV STAT", False),
        ("Tab. Digoxin", "0.25 mg PO OD", True)
    ],
    "icu": [
        ("Inj. Noradrenaline (Norepinephrine)", "4 mg in 50 mL NS IV Infusion (4 mcg/min)", True),
        ("Inj. Ceftriaxone Sodium", "1 g IV in 100 mL NS BD", False),
        ("Inj. Pantoprazole", "40 mg IV BD", False),
        ("Inj. Potassium Chloride (KCl)", "20 mEq in 500 mL NS IV Infusion", True),
        ("Inj. Human Actrapid Insulin", "8 Units SC Pre-Meals", True),
        ("Inj. Heparin Sodium", "5000 IU SC Q8H", True),
        ("Inj. Meropenem", "1 g IV TID", False)
    ],
    "surgery": [
        ("Inj. Tramadol HCl", "50 mg IV SOS (Max 300mg/day)", True),
        ("Inj. Cefuroxime", "1.5 g IV BD Post-Op", False),
        ("Tab. Paracetamol (Acetaminophen)", "650 mg PO Q6H", False),
        ("Inj. Ondansetron", "4 mg IV Q8H", False),
        ("Inj. Diclofenac Sodium", "75 mg IM SOS", False),
        ("Tab. Cefixime", "200 mg PO BD", False)
    ],
    "diabetes": [
        ("Inj. Insulin Glargine (Lantus)", "14 IU SC at 09:00 PM", True),
        ("Tab. Metformin HCl", "500 mg PO BD with Meals", False),
        ("Tab. Glimepiride", "1 mg PO Before Breakfast", False),
        ("Inj. Regular Human Insulin", "6 IU SC TID Pre-Meals", True)
    ],
    "respiratory": [
        ("Neb. Budesonide Respules", "0.5 mg Nebulization BD", False),
        ("Neb. Salbutamol (Albuterol)", "2.5 mg Nebulization Q6H", False),
        ("Tab. Azithromycin", "500 mg PO OD", False),
        ("Inj. Hydrocortisone", "100 mg IV Q8H", False),
        ("Tab. Doxofylline", "400 mg PO BD", False)
    ],
    "general": [
        ("Inj. Pantoprazole", "40 mg IV OD", False),
        ("Tab. Paracetamol", "500 mg PO TID", False),
        ("Inj. Multivitamin Infusion (MVI)", "10 mL in 500 mL RL IV OD", False),
        ("Tab. Calcium + Vitamin D3", "500 mg PO OD", False),
        ("Inj. Ondansetron", "4 mg IV SOS", False)
    ]
}

scheduled_times_morning = ["08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM"]
scheduled_times_afternoon = ["12:00 PM", "01:00 PM", "02:00 PM", "04:00 PM"]
scheduled_times_evening = ["06:00 PM", "08:00 PM", "09:00 PM", "10:00 PM"]

inserted = 0
for row in admitted_patients:
    aid, uhid, fname, lname, ward, bed, diag, doctor = row
    patient_name = f"{fname} {lname}".strip()
    bed_no = bed or f"BED-{random.randint(101, 299)}"
    doc = doctor or "Dr. Amit Sharma"
    diag_lower = (diag or "").lower()
    ward_lower = (ward or "").lower()
    
    # Pick category
    if "cardiac" in diag_lower or "ccu" in ward_lower or "coronary" in diag_lower:
        med_pool = medications_catalog["cardiac"] + medications_catalog["general"]
    elif "surg" in diag_lower or "sicu" in ward_lower or "post-op" in diag_lower:
        med_pool = medications_catalog["surgery"] + medications_catalog["general"]
    elif "icu" in ward_lower or "micu" in ward_lower:
        med_pool = medications_catalog["icu"] + medications_catalog["general"]
    elif "diabet" in diag_lower:
        med_pool = medications_catalog["diabetes"] + medications_catalog["general"]
    elif "resp" in diag_lower or "pneumon" in diag_lower or "asthma" in diag_lower:
        med_pool = medications_catalog["respiratory"] + medications_catalog["general"]
    else:
        med_pool = medications_catalog["general"] + random.choice([medications_catalog["cardiac"], medications_catalog["respiratory"]])
        
    # Prescribe 1 to 3 distinct medications for this patient
    chosen_meds = random.sample(med_pool, k=min(len(med_pool), random.choice([1, 2, 2, 3])))
    
    for med_name, dose_route, is_high in chosen_meds:
        # Determine realistic workflow stage & status
        r_stage = random.random()
        if r_stage < 0.45:
            # Completed / Given in morning round
            stage = "Completed"
            status = "Given"
            scheduled_time = random.choice(scheduled_times_morning)
            is_overdue = False
            nurse = random.choice(nurses)
            signed_at = f"{scheduled_time.replace('AM', '').strip()}:12 AM"
            verification = "Verified"
        elif r_stage < 0.85:
            # Scheduled for upcoming round
            stage = "Scheduled"
            status = "Scheduled"
            scheduled_time = random.choice(scheduled_times_afternoon + scheduled_times_evening)
            is_overdue = False
            nurse = None
            signed_at = None
            verification = "Verified"
        elif r_stage < 0.93:
            # Overdue / Critical STAT dose
            stage = "Critical"
            status = "Overdue"
            scheduled_time = random.choice(["10:00 AM", "10:30 AM", "11:00 AM"])
            is_overdue = True
            nurse = None
            signed_at = None
            verification = "Verified"
        else:
            # Newly ordered - Awaiting pharmacy verification/dispensing
            stage = "Awaiting pharmacy"
            status = "Scheduled"
            scheduled_time = random.choice(["12:30 PM", "02:00 PM"])
            is_overdue = False
            nurse = None
            signed_at = None
            verification = "Pending Verification"
            
        cur.execute("""
            INSERT INTO emar_records (
                scheduled_time, patient_name, bed_no, medication_name, dosage_route,
                status, administered_by, signed_at, stage, is_high_alert, is_overdue,
                prescribed_by, verification_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            scheduled_time, patient_name, bed_no, med_name, dose_route,
            status, nurse, signed_at, stage, is_high, is_overdue,
            doc, verification
        ))
        inserted += 1

conn.commit()
print(f"Successfully populated {inserted} realistic eMAR records across {len(admitted_patients)} admitted patients!")

cur.execute("""
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN stage = 'Scheduled' THEN 1 END) as scheduled_cnt,
        COUNT(CASE WHEN stage = 'Completed' THEN 1 END) as completed_cnt,
        COUNT(CASE WHEN stage = 'Critical' OR status = 'Overdue' THEN 1 END) as critical_cnt,
        COUNT(CASE WHEN stage = 'Awaiting pharmacy' THEN 1 END) as pharmacy_cnt,
        COUNT(CASE WHEN is_high_alert = true THEN 1 END) as high_alert_cnt
    FROM emar_records;
""")
summary = cur.fetchone()
print(f"eMAR Summary -> Total: {summary[0]}, Scheduled: {summary[1]}, Completed: {summary[2]}, Critical/Overdue: {summary[3]}, Awaiting Pharmacy: {summary[4]}, High-Alert: {summary[5]}")

cur.close()
conn.close()
