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

# -----------------------------------------------------------------------------
# 1. SYNC BLOOD BANK UNITS & REQUISITIONS
# -----------------------------------------------------------------------------
cur.execute("TRUNCATE TABLE blood_bank_units RESTART IDENTITY;")

blood_units = [
    # Requisitions tied to real surgical patients & real surgeons
    {
        "unit_id": "BR-2026-081",
        "blood_group": "A+",
        "component_type": "PRBC",
        "collected_info": "REQUEST · 4 units",
        "expiry_info": "08:30 AM",
        "screening_notes": "CABG (Triple Vessel Bypass) · Dr. Priya Patel",
        "storage_location": "—",
        "reserved_for": "Keviner Parthalan",
        "status": "Cross-matched · reserved"
    },
    {
        "unit_id": "BR-2026-082",
        "blood_group": "AB+",
        "component_type": "PRBC",
        "collected_info": "REQUEST · 2 units",
        "expiry_info": "10:00 AM",
        "screening_notes": "Laparoscopic Cholecystectomy · Dr. Suresh Menon",
        "storage_location": "—",
        "reserved_for": "Rohiter Parthalan",
        "status": "Cross-matched · reserved"
    },
    {
        "unit_id": "BR-2026-083",
        "blood_group": "A-",
        "component_type": "PRBC",
        "collected_info": "REQUEST · 2 units",
        "expiry_info": "07:15 AM",
        "screening_notes": "Emergency Appendectomy · Dr. Rajesh Singh",
        "storage_location": "—",
        "reserved_for": "Luciferer Parthalan",
        "status": "Completed"
    },
    {
        "unit_id": "BR-2026-084",
        "blood_group": "A+",
        "component_type": "PRBC",
        "collected_info": "REQUEST · 2 units",
        "expiry_info": "11:30 AM",
        "screening_notes": "Emergency LSCS · Post-partum hemorrhage risk · Dr. Neha Nair",
        "storage_location": "—",
        "reserved_for": "Adityaer Parthalan",
        "status": "Pending · requested"
    },
    {
        "unit_id": "BR-2026-085",
        "blood_group": "A-",
        "component_type": "PRBC",
        "collected_info": "REQUEST · 2 units",
        "expiry_info": "11:15 AM",
        "screening_notes": "Open Reduction & Internal Fixation (ORIF) · Dr. Ravi Reddy",
        "storage_location": "—",
        "reserved_for": "Jameser Parthalan",
        "status": "Cross-matched · reserved"
    },
    {
        "unit_id": "BR-2026-086",
        "blood_group": "B+",
        "component_type": "Platelets",
        "collected_info": "REQUEST · 1 units",
        "expiry_info": "02:00 PM",
        "screening_notes": "Thrombocytopenia in Sepsis · Dr. Rahul Kumar",
        "storage_location": "—",
        "reserved_for": "Davider Parthalan",
        "status": "Cross-matched · reserved"
    },
    # Inventory Stock Units
    {
        "unit_id": "BU-70200",
        "blood_group": "A+",
        "component_type": "PRBC",
        "collected_info": "1 Aug 2026",
        "expiry_info": "30 Sep 2026",
        "screening_notes": "Negative (HIV, HBV, HCV, syphilis, malaria)",
        "storage_location": "Fridge 1",
        "reserved_for": "—",
        "status": "Active · available"
    },
    {
        "unit_id": "BU-70201",
        "blood_group": "A+",
        "component_type": "PRBC",
        "collected_info": "5 Aug 2026",
        "expiry_info": "28 Sep 2026",
        "screening_notes": "Cross-matched with Patient Keviner Parthalan",
        "storage_location": "Fridge 1",
        "reserved_for": "Keviner Parthalan",
        "status": "Cross-matched · reserved"
    },
    {
        "unit_id": "BU-70202",
        "blood_group": "AB+",
        "component_type": "PRBC",
        "collected_info": "8 Aug 2026",
        "expiry_info": "01 Oct 2026",
        "screening_notes": "Cross-matched with Patient Rohiter Parthalan",
        "storage_location": "Fridge 2",
        "reserved_for": "Rohiter Parthalan",
        "status": "Cross-matched · reserved"
    },
    {
        "unit_id": "BU-70203",
        "blood_group": "O-",
        "component_type": "PRBC",
        "collected_info": "12 Aug 2026",
        "expiry_info": "05 Oct 2026",
        "screening_notes": "Negative (HIV, HBV, HCV, syphilis, malaria)",
        "storage_location": "Fridge 1 (Universal Emergency)",
        "reserved_for": "—",
        "status": "Active · available"
    },
    {
        "unit_id": "BU-70204",
        "blood_group": "O-",
        "component_type": "PRBC",
        "collected_info": "15 Aug 2026",
        "expiry_info": "08 Oct 2026",
        "screening_notes": "Negative (HIV, HBV, HCV, syphilis, malaria)",
        "storage_location": "Fridge 1 (Universal Emergency)",
        "reserved_for": "—",
        "status": "Active · available"
    },
    {
        "unit_id": "BU-70205",
        "blood_group": "AB+",
        "component_type": "FFP",
        "collected_info": "10 Jul 2026",
        "expiry_info": "10 Jul 2027",
        "screening_notes": "Negative (HIV, HBV, HCV, syphilis, malaria)",
        "storage_location": "Deep Freezer -40C",
        "reserved_for": "—",
        "status": "Active · available"
    },
    {
        "unit_id": "BU-70206",
        "blood_group": "A+",
        "component_type": "Platelets",
        "collected_info": "22 Sep 2026",
        "expiry_info": "27 Sep 2026",
        "screening_notes": "Negative (HIV, HBV, HCV, syphilis, malaria)",
        "storage_location": "Agitator 1",
        "reserved_for": "—",
        "status": "Active · available"
    },
    {
        "unit_id": "BU-70207",
        "blood_group": "B+",
        "component_type": "Platelets",
        "collected_info": "23 Sep 2026",
        "expiry_info": "28 Sep 2026",
        "screening_notes": "Cross-matched with Patient Davider Parthalan",
        "storage_location": "Agitator 1",
        "reserved_for": "Davider Parthalan",
        "status": "Cross-matched · reserved"
    },
    {
        "unit_id": "BU-70208",
        "blood_group": "O+",
        "component_type": "FFP",
        "collected_info": "14 Jul 2026",
        "expiry_info": "14 Jul 2027",
        "screening_notes": "Negative (HIV, HBV, HCV, syphilis, malaria)",
        "storage_location": "Deep Freezer -40C",
        "reserved_for": "—",
        "status": "Active · available"
    },
    {
        "unit_id": "BU-70209",
        "blood_group": "A-",
        "component_type": "PRBC",
        "collected_info": "18 Aug 2026",
        "expiry_info": "02 Oct 2026",
        "screening_notes": "Cross-matched with Patient Jameser Parthalan",
        "storage_location": "Fridge 2",
        "reserved_for": "Jameser Parthalan",
        "status": "Cross-matched · reserved"
    },
    {
        "unit_id": "BU-70210",
        "blood_group": "B-",
        "component_type": "PRBC",
        "collected_info": "20 Aug 2026",
        "expiry_info": "04 Oct 2026",
        "screening_notes": "Negative (HIV, HBV, HCV, syphilis, malaria)",
        "storage_location": "Fridge 2",
        "reserved_for": "—",
        "status": "Active · available"
    },
    {
        "unit_id": "BU-70211",
        "blood_group": "AB-",
        "component_type": "FFP",
        "collected_info": "18 Jul 2026",
        "expiry_info": "18 Jul 2027",
        "screening_notes": "Negative (HIV, HBV, HCV, syphilis, malaria)",
        "storage_location": "Deep Freezer -40C",
        "reserved_for": "—",
        "status": "Active · available"
    },
    {
        "unit_id": "BU-70212",
        "blood_group": "O+",
        "component_type": "PRBC",
        "collected_info": "23 Sep 2026",
        "expiry_info": "04 Nov 2026",
        "screening_notes": "Serology in progress",
        "storage_location": "Quarantine Bay",
        "reserved_for": "—",
        "status": "Quarantine"
    },
    {
        "unit_id": "BU-70213",
        "blood_group": "A+",
        "component_type": "PRBC",
        "collected_info": "24 Sep 2026",
        "expiry_info": "05 Nov 2026",
        "screening_notes": "Serology in progress",
        "storage_location": "Quarantine Bay",
        "reserved_for": "—",
        "status": "Quarantine"
    },
    {
        "unit_id": "BU-70214",
        "blood_group": "B+",
        "component_type": "Platelets",
        "collected_info": "24 Sep 2026",
        "expiry_info": "29 Sep 2026",
        "screening_notes": "NAT testing pending",
        "storage_location": "Quarantine Bay",
        "reserved_for": "—",
        "status": "Quarantine"
    },
    {
        "unit_id": "BU-70180",
        "blood_group": "A+",
        "component_type": "Platelets",
        "collected_info": "12 Sep 2026",
        "expiry_info": "17 Sep 2026",
        "screening_notes": "Expired beyond 5-day shelf life",
        "storage_location": "Discard Bay",
        "reserved_for": "—",
        "status": "Expired"
    },
    {
        "unit_id": "BU-70181",
        "blood_group": "B+",
        "component_type": "PRBC",
        "collected_info": "01 Aug 2026",
        "expiry_info": "12 Sep 2026",
        "screening_notes": "Expired 42-day shelf life",
        "storage_location": "Discard Bay",
        "reserved_for": "—",
        "status": "Expired"
    },
    {
        "unit_id": "BU-70182",
        "blood_group": "O+",
        "component_type": "PRBC",
        "collected_info": "03 Aug 2026",
        "expiry_info": "14 Sep 2026",
        "screening_notes": "Expired 42-day shelf life",
        "storage_location": "Discard Bay",
        "reserved_for": "—",
        "status": "Expired"
    },
    {
        "unit_id": "BU-70183",
        "blood_group": "AB+",
        "component_type": "FFP",
        "collected_info": "10 Jun 2026",
        "expiry_info": "10 Jun 2027",
        "screening_notes": "Cold chain breach during transit (Discarded)",
        "storage_location": "Discard Bay",
        "reserved_for": "—",
        "status": "Discarded"
    }
]

for b in blood_units:
    cur.execute("""
        INSERT INTO blood_bank_units (
            unit_id, blood_group, component_type, collected_info, expiry_info,
            screening_notes, storage_location, reserved_for, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        b["unit_id"], b["blood_group"], b["component_type"], b["collected_info"],
        b["expiry_info"], b["screening_notes"], b["storage_location"],
        b["reserved_for"], b["status"]
    ))

conn.commit()
print("Updated blood_bank_units with real patient surgical requests and verified stock.")


# -----------------------------------------------------------------------------
# 2. SYNC DEATH REGISTRY WITH REAL PATIENTS & REAL DOCTORS
# -----------------------------------------------------------------------------
cur.execute("TRUNCATE TABLE death_registry;")

deaths = [
    {
        "death_reg_no": "DTH-2026-018",
        "patient_name": "Tejas Kulkarni",
        "uhid": "MER-PAT-0087467",
        "age_gender": "74M",
        "date_time_of_death": "18 Sept 2026, 04:30 AM",
        "primary_cause_of_death": "Cardiogenic Shock secondary to Acute Extensive Anterior Wall MI",
        "secondary_cause": "Severe Triple Vessel Coronary Artery Disease",
        "certifying_doctor": "Dr. Priya Patel",
        "mccd_status": "Form 4 & 4A Issued",
        "mortuary_bay": "Bay 02 (Refrigerated)",
        "body_handed_over_to": "Son: T. Balaji",
        "department": "Coronary Care CCU",
        "is_mlc": False,
        "mlc_details": "No",
        "bill_status": "Compassionate Review · Closed"
    },
    {
        "death_reg_no": "DTH-2026-017",
        "patient_name": "Sunita Bhattacharya",
        "uhid": "MER-PAT-0087468",
        "age_gender": "81F",
        "date_time_of_death": "14 Sept 2026, 11:15 PM",
        "primary_cause_of_death": "Septic Shock with Multiple Organ Dysfunction Syndrome (MODS)",
        "secondary_cause": "Urosepsis with Acute Kidney Injury",
        "certifying_doctor": "Dr. Rahul Kumar",
        "mccd_status": "Form 4 & 4A Issued",
        "mortuary_bay": "Released to Family",
        "body_handed_over_to": "Daughter: S. Geetha",
        "department": "Medical Intensive Care MICU",
        "is_mlc": False,
        "mlc_details": "No",
        "bill_status": "Compassionate Review · Closed"
    },
    {
        "death_reg_no": "DTH-2026-016",
        "patient_name": "Vidyadhar Joshi",
        "uhid": "MER-PAT-0087456",
        "age_gender": "67M",
        "date_time_of_death": "10 Sept 2026, 02:45 PM",
        "primary_cause_of_death": "Refractory Respiratory Failure in ARDS",
        "secondary_cause": "Bilateral Bronchopneumonia",
        "certifying_doctor": "Dr. Arun Menon",
        "mccd_status": "Form 4 & 4A Issued",
        "mortuary_bay": "Released to Family",
        "body_handed_over_to": "Brother: V. Narayanan",
        "department": "Surgical Intensive Care SICU",
        "is_mlc": False,
        "mlc_details": "No",
        "bill_status": "Compassionate Review · Closed"
    },
    {
        "death_reg_no": "DTH-2026-019",
        "patient_name": "Abhishek Nambiar",
        "uhid": "MER-PAT-0087460",
        "age_gender": "32M",
        "date_time_of_death": "21 Sept 2026, 06:15 AM",
        "primary_cause_of_death": "Severe Traumatic Brain Injury with Brainstem Herniation",
        "secondary_cause": "High-velocity Road Traffic Collision with Diffuse Axonal Injury",
        "certifying_doctor": "Dr. Divya Verma",
        "mccd_status": "Post-Mortem Requisitioned",
        "mortuary_bay": "Bay 01 (Refrigerated) · MLC Hold",
        "body_handed_over_to": "Police Custody (SI Karunakaran)",
        "department": "Emergency",
        "is_mlc": True,
        "mlc_details": "MLC-2026-043 · Inquest Pending",
        "bill_status": "Compassionate Review · Closed"
    }
]

for d in deaths:
    cur.execute("""
        INSERT INTO death_registry (
            death_reg_no, patient_name, uhid, age_gender, date_time_of_death,
            primary_cause_of_death, secondary_cause, certifying_doctor,
            mccd_status, mortuary_bay, body_handed_over_to, department,
            is_mlc, mlc_details, bill_status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        d["death_reg_no"], d["patient_name"], d["uhid"], d["age_gender"],
        d["date_time_of_death"], d["primary_cause_of_death"], d["secondary_cause"],
        d["certifying_doctor"], d["mccd_status"], d["mortuary_bay"],
        d["body_handed_over_to"], d["department"], d["is_mlc"],
        d["mlc_details"], d["bill_status"]
    ))

conn.commit()
print("Updated death_registry with real patients, UHIDs, and registered doctors.")


# -----------------------------------------------------------------------------
# 3. SYNC MLC RECORDS WITH REAL PATIENTS
# -----------------------------------------------------------------------------
cur.execute("TRUNCATE TABLE mlc_records;")

mlcs = [
    {
        "mlc_number": "MLC-2026-043",
        "registration_date": "21 Sept 2026",
        "patient_name": "Abhishek Nambiar",
        "age_gender": "32M",
        "incident_type": "Road Traffic Collision (Hit & Run)",
        "police_station": "Anna Nagar Traffic PS",
        "investigating_officer": "SI Karunakaran",
        "injury_report": "Severe TBI, polytrauma, multiple rib fractures, hemorrhagic shock",
        "status": "Post-Mortem & Inquest Conducted"
    },
    {
        "mlc_number": "MLC-2026-042",
        "registration_date": "18 Sept 2026",
        "patient_name": "Chirag Singhania",
        "age_gender": "29M",
        "incident_type": "Road Traffic Accident (Two-Wheeler)",
        "police_station": "Central Law & Order PS",
        "investigating_officer": "HC Natarajan",
        "injury_report": "Compound fracture right femur, blunt abdominal trauma, stable",
        "status": "Police Intimated & Acknowledged"
    },
    {
        "mlc_number": "MLC-2026-041",
        "registration_date": "14 Sept 2026",
        "patient_name": "Lavanya Srinivasan",
        "age_gender": "24F",
        "incident_type": "Workplace Industrial Injury",
        "police_station": "Industrial Area PS",
        "investigating_officer": "SI Murugan",
        "injury_report": "Deep flexor tendon laceration right hand, primary repair done",
        "status": "Wound Certificate Issued"
    },
    {
        "mlc_number": "MLC-2026-040",
        "registration_date": "08 Sept 2026",
        "patient_name": "Raghavan Natesan",
        "age_gender": "54M",
        "incident_type": "Suspected Accidental Chemical Exposure",
        "police_station": "Harbour PS",
        "investigating_officer": "SI Anbarasu",
        "injury_report": "Inhalation chemical injury, gastric lavage & oxygen therapy, recovered",
        "status": "Discharged · Investigation Closed"
    }
]

for m in mlcs:
    cur.execute("""
        INSERT INTO mlc_records (
            mlc_number, registration_date, patient_name, age_gender,
            incident_type, police_station, investigating_officer,
            injury_report, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        m["mlc_number"], m["registration_date"], m["patient_name"],
        m["age_gender"], m["incident_type"], m["police_station"],
        m["investigating_officer"], m["injury_report"], m["status"]
    ))

conn.commit()
print("Updated mlc_records with real patient directory entries.")

conn.close()
