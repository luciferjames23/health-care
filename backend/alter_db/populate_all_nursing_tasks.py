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

# 1. Clear old static dummy nursing tasks
cur.execute("TRUNCATE TABLE nursing_tasks RESTART IDENTITY;")

# 2. Fetch all active inpatients from dim_admission_inputs
cur.execute("""
    SELECT 
        admission_id,
        patient_number,
        first_name,
        last_name,
        ward_name,
        bed_number,
        primary_diagnosis,
        latest_heart_rate,
        latest_systolic_bp,
        latest_diastolic_bp,
        latest_oxygen_saturation,
        latest_temperature,
        age_at_admission,
        attending_doctor
    FROM dim_admission_inputs
    WHERE discharge_status != 'Discharged'
    ORDER BY admission_id ASC;
""")
admitted_patients = cur.fetchall()
print(f"Fetched {len(admitted_patients)} active inpatient admissions.")

nurses = [
    "Staff Nurse Sneha Rao",
    "Staff Nurse Anitha Menon",
    "Charge Nurse Divya Kumar",
    "Staff Nurse Rajesh Nair",
    "Staff Nurse Pooja Sharma",
    "Staff Nurse Kavitha Sundaram",
    "Staff Nurse Priya Mohan",
    "Staff Nurse Deepa Krishnan",
    "Staff Nurse Sunita Patil",
    "Staff Nurse Rahul Verma"
]

diets = [
    "Standard Hospital Diet",
    "Diabetic (1800 kcal)",
    "Low Sodium / Cardiac Diet",
    "High Protein / Post-Op",
    "Renal (Low Potassium/Phos)",
    "Soft Mechanical Diet",
    "NPO (Pre-procedure fasting)",
    "Full Liquid Diet"
]

tasks_by_diagnosis = {
    "cardiac": "Continuous ECG monitoring, Q2H vitals & troponin-I serial follow-up",
    "surgery": "Surgical site dressing check, Q4H drain output chart & pain control",
    "icu": "Strict hourly vitals & urine output, arterial line monitoring, central line care",
    "neuro": "Q4H GCS neurological observation, pupillary reflex & anti-epileptic timing",
    "resp": "Nebulization with Salbutamol Q4H, chest physiotherapy & SpO2 titrations",
    "gastro": "Abdominal girth charting, IV antiemetics & fluid balance tracking",
    "ortho": "Limb elevation, neurovascular bundle check & mobility assist",
    "default": "Routine Q4H vitals round, oral medication administration & intake/output chart"
}

overdue_med_options = [
    "Inj. Ceftriaxone 1g IV (Overdue 20m)",
    "Tab. Metoprolol 25mg (Overdue 15m)",
    "Inj. Pantoprazole 40mg IV (Overdue 30m)",
    "Tab. Enalapril 5mg (Overdue 25m)",
    "Inj. Enoxaparin 40mg SC (Overdue 10m)",
    "Neb. Budesonide 0.5mg (Overdue 15m)"
]

times = ["10:45", "11:00", "11:05", "11:15", "11:20", "11:30", "11:35", "11:40", "11:45", "11:50"]

inserted = 0
for row in admitted_patients:
    aid, uhid, fname, lname, ward, bed, diag, hr_raw, sbp_raw, dbp_raw, spo2_raw, temp_raw, age, doctor = row
    
    patient_name = f"{fname} {lname}".strip()
    bed_no = bed or f"BED-{random.randint(101, 299)}"
    ward_name = ward or "General Multi-Specialty Ward"
    uhid_code = uhid or f"UHID-{aid}"
    
    # Process vitals
    hr = int(hr_raw) if hr_raw else random.randint(68, 96)
    sbp = int(sbp_raw) if sbp_raw else random.randint(110, 138)
    dbp = int(dbp_raw) if dbp_raw else random.randint(65, 88)
    bp = f"{sbp}/{dbp}"
    
    # Convert SpO2: if float/Decimal, convert to rounded int
    if spo2_raw:
        spo2_val = float(spo2_raw)
        spo2 = int(round(spo2_val)) if spo2_val <= 100 else 98
    else:
        spo2 = random.choice([95, 96, 97, 98, 99])
        
    # Convert Temperature: if > 90, assume Fahrenheit and convert to Celsius
    if temp_raw:
        t_val = float(temp_raw)
        if t_val > 50:
            temp_c = round((t_val - 32) * 5 / 9, 1)
        else:
            temp_c = round(t_val, 1)
    else:
        temp_c = round(random.uniform(36.6, 37.4), 1)
        
    rr = random.randint(16, 24) if hr > 100 or spo2 < 95 else random.randint(14, 20)
    pain = random.randint(3, 7) if 'surgery' in (diag or '').lower() or 'fracture' in (diag or '').lower() else random.randint(0, 3)
    
    # Calculate EWS score
    ews = 0
    if hr > 110 or hr < 50:
        ews += 2
    elif hr > 95 or hr < 60:
        ews += 1
        
    if sbp < 90 or sbp > 170:
        ews += 2
    elif sbp < 100 or sbp > 150:
        ews += 1
        
    if spo2 < 92:
        ews += 3
    elif spo2 <= 94:
        ews += 2
    elif spo2 <= 95:
        ews += 1
        
    if temp_c > 38.2 or temp_c < 35.5:
        ews += 2
    elif temp_c > 37.8 or temp_c < 36.0:
        ews += 1
        
    if rr > 24 or rr < 10:
        ews += 2
    elif rr > 20:
        ews += 1
        
    # Flag Status
    if ews >= 3 or spo2 < 93 or hr > 115 or sbp < 90:
        flag = "Critical - escalate"
    elif ews == 2 or spo2 <= 95 or hr > 100 or pain >= 6:
        flag = "Pending - watch"
    else:
        flag = "Normal"
        
    # Fall / Pressure risk
    is_elderly = (age or 45) > 65
    is_icu = 'icu' in ward_name.lower() or 'critical' in ward_name.lower() or 'ccu' in ward_name.lower()
    if is_elderly or is_icu or pain >= 5:
        fall_risk = "High / High" if is_icu else "High / Low"
    elif is_elderly:
        fall_risk = "Medium / Low"
    else:
        fall_risk = "Low / Low"
        
    # Diet
    diag_lower = (diag or "").lower()
    if "diabet" in diag_lower:
        diet = "Diabetic (1800 kcal)"
    elif "cardiac" in diag_lower or "coronary" in diag_lower or "hypertens" in diag_lower:
        diet = "Low Sodium / Cardiac Diet"
    elif "renal" in diag_lower or "kidney" in diag_lower:
        diet = "Renal (Low Potassium/Phos)"
    elif is_icu and random.random() < 0.3:
        diet = "NPO (Pre-procedure fasting)"
    else:
        diet = random.choice(["Standard Hospital Diet", "High Protein / Post-Op", "Soft Mechanical Diet"])
        
    # Overdue Meds
    if random.random() < 0.12:  # ~12% have an overdue dose for realism
        overdue_meds = random.choice(overdue_med_options)
    else:
        overdue_meds = "—"
        
    # Task Description
    if "cardiac" in diag_lower or "ccu" in ward_name.lower():
        task = tasks_by_diagnosis["cardiac"]
    elif "surg" in diag_lower or "sicu" in ward_name.lower() or "post-op" in diag_lower:
        task = tasks_by_diagnosis["surgery"]
    elif "icu" in ward_name.lower():
        task = tasks_by_diagnosis["icu"]
    elif "neuro" in diag_lower or "stroke" in diag_lower:
        task = tasks_by_diagnosis["neuro"]
    elif "resp" in diag_lower or "pneumon" in diag_lower or "asthma" in diag_lower:
        task = tasks_by_diagnosis["resp"]
    else:
        task = tasks_by_diagnosis["default"]
        
    assigned_nurse = random.choice(nurses)
    last_vitals_time = random.choice(times)
    clinical_notes = f"Attending: {doctor or 'General Medical Consultant'}. Diagnosis: {diag or 'Inpatient Care'}. Patient resting in bed. Vitals monitored as scheduled."
    
    cur.execute("""
        INSERT INTO nursing_tasks (
            bed_no, patient_name, uhid, task_description, status, 
            assigned_nurse, clinical_notes, last_vitals_time, 
            hr, bp, spo2, temp, rr, pain_score, ews_score, 
            fall_risk, diet_type, overdue_meds, flag_status, ward_name
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s
        );
    """, (
        bed_no, patient_name, uhid_code, task, "Active",
        assigned_nurse, clinical_notes, last_vitals_time,
        hr, bp, spo2, temp_c, rr, pain, ews,
        fall_risk, diet, overdue_meds, flag, ward_name
    ))
    inserted += 1

conn.commit()
print(f"Successfully populated {inserted} active inpatient nursing task records!")

cur.execute("SELECT COUNT(*), COUNT(CASE WHEN flag_status LIKE '%escalate%' THEN 1 END), COUNT(CASE WHEN flag_status LIKE '%watch%' THEN 1 END) FROM nursing_tasks;")
total, esc, watch = cur.fetchone()
print(f"Total Census in Nursing Tasks: {total}, Escalate: {esc}, Watch: {watch}")

cur.close()
conn.close()
