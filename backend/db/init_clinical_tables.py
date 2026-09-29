"""
PostgreSQL Schema Initializer and Seed Script for Clinical & Front-Office Modules:
- Emergency & Trauma Board (emergency_triage)
- Consultant Schedules (consultant_schedules)
- Inpatient Nursing Workspace (nursing_tasks)
- Medication Administration / eMAR (emar_records)
- OT & Surgery Cases (ot_surgeries)
- Blood Bank Component Inventory (blood_bank_inventory)
- Medico-Legal Cases (mlc_records)
- Statutory Death Registry (death_registry)
- Ward Handover SBAR (ward_sbar_handovers)
- OT Scheduling Slots (ot_schedules)
"""

import sys
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from db.postgres_connector import PostgresConnector

def init_clinical_tables():
    connector = PostgresConnector()
    conn = connector.get_connection()
    cur = conn.cursor()

    print("Creating clinical & front-office PostgreSQL tables (without dim_ prefix)...")

    # 1. Emergency & Trauma Triage Board
    cur.execute("""
        CREATE TABLE IF NOT EXISTS emergency_triage (
            id VARCHAR(50) PRIMARY KEY,
            bay VARCHAR(50) NOT NULL,
            patient_name VARCHAR(150) NOT NULL,
            age_gender VARCHAR(20),
            triage_level VARCHAR(20) NOT NULL, -- 'Red', 'Yellow', 'Green'
            chief_complaint TEXT,
            bp VARCHAR(30),
            hr INT,
            spo2 VARCHAR(20),
            doctor_name VARCHAR(150),
            elapsed_time VARCHAR(30),
            clinical_status VARCHAR(100),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. Consultant Schedules & Rosters
    cur.execute("""
        CREATE TABLE IF NOT EXISTS consultant_schedules (
            id SERIAL PRIMARY KEY,
            doctor_name VARCHAR(150) NOT NULL,
            specialty VARCHAR(100) NOT NULL,
            opd_hours VARCHAR(100),
            clinic_days VARCHAR(100),
            room_no VARCHAR(50),
            on_call_assignment VARCHAR(150),
            status VARCHAR(50) DEFAULT 'On Duty',
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 3. Inpatient Nursing Tasks
    cur.execute("""
        CREATE TABLE IF NOT EXISTS nursing_tasks (
            id SERIAL PRIMARY KEY,
            bed_no VARCHAR(50) NOT NULL,
            patient_name VARCHAR(150) NOT NULL,
            uhid VARCHAR(50),
            task_description TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'Due Now', -- 'Due Now', 'In Progress', 'Due in 30m', 'Completed'
            assigned_nurse VARCHAR(150),
            clinical_notes TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP WITHOUT TIME ZONE
        );
    """)

    # 4. Medication Administration / eMAR
    cur.execute("""
        CREATE TABLE IF NOT EXISTS emar_records (
            id SERIAL PRIMARY KEY,
            scheduled_time VARCHAR(50) NOT NULL,
            patient_name VARCHAR(150) NOT NULL,
            bed_no VARCHAR(50) NOT NULL,
            medication_name VARCHAR(200) NOT NULL,
            dosage_route VARCHAR(150) NOT NULL,
            status VARCHAR(50) DEFAULT 'Scheduled', -- 'Scheduled', 'Due Now', 'Given', 'Held'
            administered_by VARCHAR(150),
            signed_at VARCHAR(50),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 5. OT & Surgery Cases
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ot_surgeries (
            id SERIAL PRIMARY KEY,
            ot_suite VARCHAR(100) NOT NULL,
            patient_name VARCHAR(150) NOT NULL,
            procedure_name VARCHAR(250) NOT NULL,
            lead_surgeon VARCHAR(150) NOT NULL,
            anesthetist VARCHAR(150),
            intraop_stage VARCHAR(100), -- 'In PACU Recovery', 'Surgical Incision', 'Pre-op Anesthesia Induction', 'Scheduled Next'
            start_time VARCHAR(50),
            end_time VARCHAR(50),
            status VARCHAR(50) DEFAULT 'Active',
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 6. Blood Bank Inventory
    cur.execute("""
        CREATE TABLE IF NOT EXISTS blood_bank_inventory (
            blood_group VARCHAR(50) PRIMARY KEY,
            prbc_units INT DEFAULT 0,
            ffp_units INT DEFAULT 0,
            platelet_bags INT DEFAULT 0,
            reserved_units INT DEFAULT 0,
            stock_status VARCHAR(50) DEFAULT 'Adequate',
            last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 7. Medico-Legal Cases (MLC)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS mlc_records (
            mlc_number VARCHAR(50) PRIMARY KEY,
            registration_date VARCHAR(50),
            patient_name VARCHAR(150) NOT NULL,
            age_gender VARCHAR(20),
            incident_type VARCHAR(100),
            police_station VARCHAR(150),
            investigating_officer VARCHAR(150),
            injury_report TEXT,
            status VARCHAR(100),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 8. Statutory Death Registry
    cur.execute("""
        CREATE TABLE IF NOT EXISTS death_registry (
            death_reg_no VARCHAR(50) PRIMARY KEY,
            patient_name VARCHAR(150) NOT NULL,
            uhid VARCHAR(50),
            age_gender VARCHAR(20),
            date_time_of_death VARCHAR(100) NOT NULL,
            primary_cause_of_death TEXT NOT NULL,
            secondary_cause TEXT,
            certifying_doctor VARCHAR(150) NOT NULL,
            mccd_status VARCHAR(100) DEFAULT 'Form 4 Issued',
            mortuary_bay VARCHAR(50),
            body_handed_over_to VARCHAR(150),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 9. Ward Handover (SBAR)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ward_sbar_handovers (
            id SERIAL PRIMARY KEY,
            bed_no VARCHAR(50) NOT NULL,
            patient_name VARCHAR(150) NOT NULL,
            age_gender VARCHAR(20),
            from_nurse VARCHAR(150) NOT NULL,
            to_nurse VARCHAR(150) NOT NULL,
            situation TEXT NOT NULL,
            background TEXT NOT NULL,
            assessment TEXT NOT NULL,
            recommendation TEXT NOT NULL,
            acknowledged BOOLEAN DEFAULT FALSE,
            acknowledged_at TIMESTAMP WITHOUT TIME ZONE,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 10. OT Schedules & Room Booking
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ot_schedules (
            id SERIAL PRIMARY KEY,
            slot_date DATE DEFAULT CURRENT_DATE,
            ot_suite VARCHAR(50) NOT NULL,
            time_slot VARCHAR(50) NOT NULL,
            patient_name VARCHAR(150) NOT NULL,
            procedure_name VARCHAR(250) NOT NULL,
            lead_surgeon VARCHAR(150) NOT NULL,
            anesthetist VARCHAR(150),
            duration_minutes INT DEFAULT 90,
            booking_status VARCHAR(50) DEFAULT 'Booked',
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    conn.commit()
    print("Tables ensured. Copying existing data or seeding initial records if empty...")

    # --- Migrate from dim_* or Seed ---
    # 1. Emergency Triage
    cur.execute("SELECT COUNT(*) FROM emergency_triage;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_emergency_triage') THEN
                    INSERT INTO emergency_triage SELECT * FROM dim_emergency_triage ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM emergency_triage;")
        if cur.fetchone()[0] == 0:
            emergency_seed = [
                ('ER-401', 'Resus 1', 'Ravi Teja', '42M', 'Red', 'Acute STEMI, severe crushing chest pain', '84/52', 128, '89%', 'Dr. Arjun Menon', '8m', 'Immediate Resuscitation'),
                ('ER-402', 'Trauma 2', 'Sundaram K.', '28M', 'Red', 'RTA polytrauma, suspected pelvic fracture', '98/64', 114, '94%', 'Dr. Rajesh Sharma', '14m', 'FAST Scan in Progress'),
                ('ER-403', 'Bay 03', 'Malini G.', '65F', 'Yellow', 'Severe acute dyspnea, COPD exacerbation', '142/88', 98, '91%', 'Dr. Priya Narayanan', '22m', 'Nebulization & BiPAP'),
                ('ER-404', 'Bay 04', 'Karthik Raja', '34M', 'Yellow', 'Acute appendicular colic, guarding in RIF', '124/78', 82, '99%', 'Dr. Pooja Menon', '35m', 'IV Analgesia & USG Pending'),
                ('ER-405', 'Bay 05', 'Ayesha Banu', '19F', 'Green', 'Moderate laceration on right forearm, bleeding controlled', '116/74', 76, '99%', 'Dr. Vignesh K.', '41m', 'Suturing Planned'),
                ('ER-406', 'Bay 06', 'Natarajan P.', '71M', 'Yellow', 'Transient ischemic attack, left facial weakness resolved', '168/96', 78, '98%', 'Dr. Sanjay Gupta', '48m', 'Urgent NCCT Brain Done'),
            ]
            cur.executemany("""
                INSERT INTO emergency_triage (id, bay, patient_name, age_gender, triage_level, chief_complaint, bp, hr, spo2, doctor_name, elapsed_time, clinical_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING;
            """, emergency_seed)
        print("Seeded emergency_triage")

    # 2. Consultant Schedules
    cur.execute("SELECT COUNT(*) FROM consultant_schedules;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_consultant_schedules') THEN
                    INSERT INTO consultant_schedules SELECT * FROM dim_consultant_schedules ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM consultant_schedules;")
        if cur.fetchone()[0] == 0:
            roster_seed = [
                ('Dr. Arjun Menon', 'Cardiology', '09:00 AM - 01:00 PM', 'Mon, Wed, Fri', 'OPD 102', 'Tonight (20:00 - 08:00)', 'On Duty'),
                ('Dr. Priya Narayanan', 'Internal Medicine', '10:00 AM - 02:00 PM', 'Daily (Mon-Sat)', 'OPD 105', 'Weekend Coverage', 'On Duty'),
                ('Dr. Pooja Menon', 'General & Lap. Surgery', '11:00 AM - 03:00 PM', 'Tue, Thu, Sat', 'OPD 110', 'Emergency OT Call', 'In OT 2'),
                ('Dr. Rajesh Sharma', 'Orthopedics & Trauma', '09:30 AM - 01:30 PM', 'Mon, Tue, Thu, Fri', 'OPD 114', 'Primary Trauma Call', 'On Duty'),
                ('Dr. Sanjay Gupta', 'Neurology', '02:00 PM - 06:00 PM', 'Mon, Wed, Thu', 'OPD 108', 'Telestroke Active', 'Evening Clinic'),
                ('Dr. Anita Roy', 'Pediatrics', '09:00 AM - 01:00 PM', 'Mon-Fri', 'OPD 101', 'NICU Secondary', 'On Duty'),
                ('Dr. Meera Iyer', 'Pulmonology', '03:00 PM - 07:00 PM', 'Wed, Fri, Sat', 'OPD 107', 'ICU Bronchoscopy', 'On Leave'),
            ]
            cur.executemany("""
                INSERT INTO consultant_schedules (doctor_name, specialty, opd_hours, clinic_days, room_no, on_call_assignment, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
            """, roster_seed)
        print("Seeded consultant_schedules")

    # 3. Nursing Tasks
    cur.execute("SELECT COUNT(*) FROM nursing_tasks;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_nursing_tasks') THEN
                    INSERT INTO nursing_tasks SELECT * FROM dim_nursing_tasks ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM nursing_tasks;")
        if cur.fetchone()[0] == 0:
            nursing_seed = [
                ('Bed 201-A', 'Saanvier Parthalan', 'MER-PAT-0087227', 'Q4H Blood Glucose Monitoring (Pre-lunch check)', 'Due Now', 'Anitha Kumar', 'Target BG < 160 mg/dL'),
                ('Bed 202-B', 'Kavitha Raman', 'MER-PAT-0087221', 'Titrate IV Heparin @ 18 ml/hr & check aPTT', 'In Progress', 'K. Selvi', 'Check puncture site for hematoma'),
                ('Bed 204-A', 'Christoer Parthalan', 'MER-PAT-0087233', 'Post-op surgical dressing inspection & drain output', 'Completed', 'Anitha Kumar', 'Drain: 25ml serosanguinous'),
                ('Bed 205-C', 'Natarajan P.', 'MER-PAT-0087235', 'Turn & reposition Q2H + Fall Risk Precautions', 'Due in 30m', 'K. Selvi', 'Braden Score 13 - High Risk'),
                ('Bed 208-A', 'Lakshmi Narayanan', 'MER-PAT-0087230', 'Administer Inj. Cefoperazone-Sulbactam 1.5g IV', 'Due Now', 'Anitha Kumar', 'Skin test negative confirmed'),
            ]
            cur.executemany("""
                INSERT INTO nursing_tasks (bed_no, patient_name, uhid, task_description, status, assigned_nurse, clinical_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
            """, nursing_seed)
        print("Seeded nursing_tasks")

    # 4. eMAR Records
    cur.execute("SELECT COUNT(*) FROM emar_records;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_emar_records') THEN
                    INSERT INTO emar_records SELECT * FROM dim_emar_records ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM emar_records;")
        if cur.fetchone()[0] == 0:
            emar_seed = [
                ('08:00 AM', 'Saanvier Parthalan', 'Bed 201-A', 'Inj. Regular Human Insulin', '8 Units SubCut', 'Given', 'Anitha Kumar', '08:05 AM'),
                ('08:00 AM', 'Saanvier Parthalan', 'Bed 201-A', 'Tab. Pantoprazole 40mg', '1 Tab Oral before breakfast', 'Given', 'Anitha Kumar', '08:06 AM'),
                ('12:00 PM', 'Christoer Parthalan', 'Bed 204-A', 'Inj. Metronidazole 500mg', '100ml IV Infusion over 30 mins', 'Due Now', 'Anitha Kumar', '—'),
                ('02:00 PM', 'Kavitha Raman', 'Bed 202-B', 'Tab. Atorvastatin 40mg', '1 Tab Oral', 'Scheduled', 'K. Selvi', '—'),
                ('02:00 PM', 'Lakshmi Narayanan', 'Bed 208-A', 'Inj. Paracetamol 1000mg', '100ml IV Infusion SOS for fever', 'Scheduled', 'K. Selvi', '—'),
                ('08:00 PM', 'Saanvier Parthalan', 'Bed 201-A', 'Inj. Glargine Insulin (Lantus)', '14 Units SubCut at bedtime', 'Scheduled', 'Night Shift Nurse', '—'),
            ]
            cur.executemany("""
                INSERT INTO emar_records (scheduled_time, patient_name, bed_no, medication_name, dosage_route, status, administered_by, signed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
            """, emar_seed)
        print("Seeded emar_records")

    # 5. OT Surgeries
    cur.execute("SELECT COUNT(*) FROM ot_surgeries;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_ot_surgeries') THEN
                    INSERT INTO ot_surgeries SELECT * FROM dim_ot_surgeries ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM ot_surgeries;")
        if cur.fetchone()[0] == 0:
            surgery_seed = [
                ('OT-01 (Cardiac)', 'Kavitha Raman', 'Coronary Angiography & Stenting', 'Dr. Arjun Menon', 'Dr. K. Nair', 'In PACU Recovery', '08:30 AM', '10:15 AM', 'Active'),
                ('OT-02 (General)', 'Christoer Parthalan', 'Emergency Laparoscopic Appendectomy', 'Dr. Pooja Menon', 'Dr. K. Nair', 'Surgical Incision', '10:00 AM', 'Est 11:30 AM', 'Active'),
                ('OT-03 (Orthopedics)', 'Sundaram K.', 'ORIF Patella & Tension Band Wiring', 'Dr. Rajesh Sharma', 'Dr. Geetha V.', 'Pre-op Anesthesia Induction', '10:45 AM', 'Est 12:45 PM', 'Active'),
                ('OT-04 (Maternity/Gyn)', 'Revathi S.', 'Elective Lower Segment Cesarean Section', 'Dr. Anita Roy', 'Dr. Geetha V.', 'Scheduled Next (12:00 PM)', '12:00 PM', 'Est 01:15 PM', 'Active'),
            ]
            cur.executemany("""
                INSERT INTO ot_surgeries (ot_suite, patient_name, procedure_name, lead_surgeon, anesthetist, intraop_stage, start_time, end_time, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, surgery_seed)
        print("Seeded ot_surgeries")

    # 6. Blood Bank Inventory
    cur.execute("SELECT COUNT(*) FROM blood_bank_inventory;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_blood_bank_inventory') THEN
                    INSERT INTO blood_bank_inventory SELECT * FROM dim_blood_bank_inventory ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM blood_bank_inventory;")
        if cur.fetchone()[0] == 0:
            bb_seed = [
                ('O Positive (O+)', 18, 12, 6, 3, 'Adequate'),
                ('A Positive (A+)', 14, 8, 4, 2, 'Adequate'),
                ('B Positive (B+)', 16, 10, 5, 1, 'Adequate'),
                ('AB Positive (AB+)', 6, 4, 2, 0, 'Adequate'),
                ('O Negative (O-)', 3, 2, 1, 2, 'Critical Reserve'),
                ('A Negative (A-)', 4, 2, 1, 0, 'Low Stock'),
                ('B Negative (B-)', 2, 1, 0, 1, 'Critical Reserve'),
            ]
            cur.executemany("""
                INSERT INTO blood_bank_inventory (blood_group, prbc_units, ffp_units, platelet_bags, reserved_units, stock_status)
                VALUES (%s, %s, %s, %s, %s, %s);
            """, bb_seed)
        print("Seeded blood_bank_inventory")

    # 7. MLC Records
    cur.execute("SELECT COUNT(*) FROM mlc_records;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_mlc_records') THEN
                    INSERT INTO mlc_records SELECT * FROM dim_mlc_records ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM mlc_records;")
        if cur.fetchone()[0] == 0:
            mlc_seed = [
                ('MLC-2026-042', '14 Sept 2026', 'Sundaram K.', '28M', 'Road Traffic Accident', 'Yelagiri Hills PS', 'SI Karunakaran', 'Polytrauma, fracture patella, blunt chest injury', 'Police Intimated & Acknowledged'),
                ('MLC-2026-041', '11 Sept 2026', 'Ayesha Banu', '19F', 'Workplace Industrial Injury', 'Tirupattur Town PS', 'HC Natarajan', 'Deep flexor tendon laceration right forearm', 'Wound Certificate Issued'),
                ('MLC-2026-040', '06 Sept 2026', 'Ramesh V.', '52M', 'Suspected Accidental Poisoning', 'Jolarpettai PS', 'SI Murugan', 'Organophosphate compound smell, gastric lavage done', 'Discharged - Investigation Closed'),
            ]
            cur.executemany("""
                INSERT INTO mlc_records (mlc_number, registration_date, patient_name, age_gender, incident_type, police_station, investigating_officer, injury_report, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, mlc_seed)
        print("Seeded mlc_records")

    # 8. Death Registry
    cur.execute("SELECT COUNT(*) FROM death_registry;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_death_registry') THEN
                    INSERT INTO death_registry SELECT * FROM dim_death_registry ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM death_registry;")
        if cur.fetchone()[0] == 0:
            death_seed = [
                ('DTH-2026-018', 'Venkatesan M.', 'MER-PAT-0087190', '78M', '15 Sept 2026, 04:30 AM', 'Cardiogenic Shock secondary to Acute Extensive Anterior Wall MI', 'Severe CAD, Triple Vessel Disease', 'Dr. Arjun Menon', 'Form 4 & 4A Issued', 'Bay 02 (Refrigerated)', 'Son: V. Balaji'),
                ('DTH-2026-017', 'Kamala Devi', 'MER-PAT-0087182', '82F', '12 Sept 2026, 11:15 PM', 'Septic Shock with Multiorgan Failure (MODS)', 'Severe Urosepsis with Acute Kidney Injury', 'Dr. Priya Narayanan', 'Form 4 & 4A Issued', 'Released to Family', 'Daughter: S. Geetha'),
                ('DTH-2026-016', 'Mohammed Rafi', 'MER-PAT-0087175', '64M', '08 Sept 2026, 02:45 PM', 'Refractory Respiratory Failure in ARDS', 'Severe Bilateral Viral Pneumonia with Cytokine Storm', 'Dr. Meera Iyer', 'Form 4 & 4A Issued', 'Released to Family', 'Brother: M. Ibrahim'),
            ]
            cur.executemany("""
                INSERT INTO death_registry (death_reg_no, patient_name, uhid, age_gender, date_time_of_death, primary_cause_of_death, secondary_cause, certifying_doctor, mccd_status, mortuary_bay, body_handed_over_to)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, death_seed)
        print("Seeded death_registry")

    # 9. Ward Handover (SBAR)
    cur.execute("SELECT COUNT(*) FROM ward_sbar_handovers;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_ward_sbar_handovers') THEN
                    INSERT INTO ward_sbar_handovers SELECT * FROM dim_ward_sbar_handovers ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM ward_sbar_handovers;")
        if cur.fetchone()[0] == 0:
            sbar_seed = [
                ('Bed 201-A', 'Saanvier Parthalan', '84F', 'Anitha Kumar', 'Selvi K.',
                 'Type 2 DM with DKA, 3 days inpatient, blood sugar normalized (118 mg/dL).',
                 'Admitted with random BG 384 mg/dL. IV insulin infusion transitioned to subcutaneous regimen.',
                 'Hemodynamically stable, ketones negative. Billing cleared. Awaiting final discharge summary sign-off.',
                 'Ensure patient takes light breakfast. Deliver discharge medication package once physician signs summary.',
                 True),
                ('Bed 202-B', 'Kavitha Raman', '58F', 'Anitha Kumar', 'Selvi K.',
                 'Post-PTCA Day 2, femoral puncture site stable, dual antiplatelets active.',
                 'Presented with acute angina and hs-Troponin 53.2 pg/mL. Stented with drug-eluting stent in LAD.',
                 'No chest pain, puncture site clean. TPA final approval pending.',
                 'Maintain telemetry monitoring until noon. Follow up with MediAssist coordinator.',
                 False),
                ('Bed 204-A', 'Christoer Parthalan', '34M', 'Selvi K.', 'Anitha Kumar',
                 'Post-op Day 1 Laparoscopic Appendectomy. Vitals stable.',
                 'Presented with acute abdominal pain and leucocytosis. Appendix resected successfully.',
                 'Tolerating sips of water. Surgical dressing dry and intact. Mild incision site discomfort.',
                 'Start liquid diet by afternoon if bowel sounds present. Administer IV analgesics on schedule.',
                 False)
            ]
            cur.executemany("""
                INSERT INTO ward_sbar_handovers (bed_no, patient_name, age_gender, from_nurse, to_nurse, situation, background, assessment, recommendation, acknowledged)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, sbar_seed)
        print("Seeded ward_sbar_handovers")

    # 10. OT Schedules
    cur.execute("SELECT COUNT(*) FROM ot_schedules;")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dim_ot_schedules') THEN
                    INSERT INTO ot_schedules SELECT * FROM dim_ot_schedules ON CONFLICT DO NOTHING;
                END IF;
            END $$;
        """)
        cur.execute("SELECT COUNT(*) FROM ot_schedules;")
        if cur.fetchone()[0] == 0:
            ot_sched_seed = [
                ('OT-01 (Cardiac)', '08:30 AM - 10:30 AM', 'Kavitha Raman', 'Coronary Angiography & Stenting', 'Dr. Arjun Menon', 'Dr. K. Nair', 120, 'Booked'),
                ('OT-01 (Cardiac)', '11:00 AM - 01:30 PM', 'Nagarajan T.', 'Permanent Pacemaker Implantation', 'Dr. Arjun Menon', 'Dr. K. Nair', 150, 'Booked'),
                ('OT-02 (General)', '10:00 AM - 11:30 AM', 'Christoer Parthalan', 'Emergency Laparoscopic Appendectomy', 'Dr. Pooja Menon', 'Dr. K. Nair', 90, 'In Progress'),
                ('OT-02 (General)', '01:00 PM - 03:00 PM', 'Deepak Verma', 'Laparoscopic Cholecystectomy', 'Dr. Pooja Menon', 'Dr. Geetha V.', 120, 'Booked'),
                ('OT-03 (Orthopedics)', '10:45 AM - 01:00 PM', 'Sundaram K.', 'ORIF Patella & Tension Band Wiring', 'Dr. Rajesh Sharma', 'Dr. Geetha V.', 135, 'In Progress'),
                ('OT-04 (Maternity/Gyn)', '12:00 PM - 01:30 PM', 'Revathi S.', 'Elective Lower Segment Cesarean Section', 'Dr. Anita Roy', 'Dr. Geetha V.', 90, 'Booked'),
                ('OT-05 (Emergency Reserve)', '02:00 PM - 03:30 PM', 'Emergency Reserve Bay', 'Reserved for Level 1 Trauma', 'On-Call Surgeon', 'On-Call Anesthetist', 90, 'Available'),
            ]
            cur.executemany("""
                INSERT INTO ot_schedules (ot_suite, time_slot, patient_name, procedure_name, lead_surgeon, anesthetist, duration_minutes, booking_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
            """, ot_sched_seed)
        print("Seeded ot_schedules")

    conn.commit()

    # Drop old dim_* tables to clean up schema completely
    old_tables = [
        'dim_emergency_triage',
        'dim_consultant_schedules',
        'dim_nursing_tasks',
        'dim_emar_records',
        'dim_ot_surgeries',
        'dim_blood_bank_inventory',
        'dim_mlc_records',
        'dim_death_registry',
        'dim_ward_sbar_handovers',
        'dim_ot_schedules'
    ]
    for tbl in old_tables:
        cur.execute(f"DROP TABLE IF EXISTS {tbl} CASCADE;")
    conn.commit()
    conn.close()
    print("All clinical & front-office tables initialized without 'dim_' prefix, and legacy dim_ tables removed.")

if __name__ == "__main__":
    init_clinical_tables()
