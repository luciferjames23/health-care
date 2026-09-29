#!/usr/bin/env python3
"""
Setup and populate Pharmacy & Supply Chain tables with comprehensive database data.
Folder: backend/alter_db/setup_pharmacy_and_supply_chain.py
"""

import sys
import random
from pathlib import Path
from datetime import date, datetime, timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from api.dashboard_routes import get_conn
import psycopg2.extras

HOSPITAL_DRUGS = [
    # Cardiac
    ("MED-001", "Tab. Atorvastatin", "Atorvastatin", "Cardiovascular", "Tablet", "40 mg", "Sch H", "Oral", False, 18.50, "Clarithromycin, Ketoconazole", "Atorva 40", "Zydus Lifesciences"),
    ("MED-002", "Tab. Metoprolol Tartrate", "Metoprolol", "Cardiovascular", "Tablet", "25 mg", "Sch H", "Oral", False, 12.00, "Verapamil, Diltiazem", "Betaloc 25", "AstraZeneca"),
    ("MED-003", "Tab. Clopidogrel", "Clopidogrel", "Cardiovascular", "Tablet", "75 mg", "Sch H", "Oral", False, 15.20, "Omeprazole, NSAIDs", "Plavix 75", "Sanofi"),
    ("MED-004", "Inj. Enoxaparin Sodium", "Enoxaparin", "Cardiovascular", "Injection", "40 mg / 0.4 mL", "Sch H", "SC", True, 420.00, "Warfarin, Heparin, Aspirin", "Clexane 40", "Sanofi"),
    ("MED-005", "Tab. Enalapril Maleate", "Enalapril", "Cardiovascular", "Tablet", "5 mg", "Sch H", "Oral", False, 8.50, "Potassium supplements, Spironolactone", "Vasotec 5", "Merck"),
    ("MED-006", "Inj. Furosemide", "Furosemide", "Cardiovascular", "Injection", "20 mg / 2 mL", "Sch H", "IV", False, 22.00, "Aminoglycosides, Digoxin", "Lasix 20", "Sanofi"),
    ("MED-007", "Tab. Digoxin", "Digoxin", "Cardiovascular", "Tablet", "0.25 mg", "Sch H", "Oral", True, 6.50, "Amiodarone, Quinidine", "Lanoxin", "GlaxoSmithKline"),
    ("MED-008", "Tab. Telmisartan", "Telmisartan", "Cardiovascular", "Tablet", "40 mg", "Sch H", "Oral", False, 14.00, "Aliskiren, Lithium", "Telma 40", "Glenmark"),
    
    # Antibiotics & Antimicrobials
    ("MED-009", "Inj. Meropenem", "Meropenem", "Antibiotic", "Injection", "1 g", "Sch H1", "IV", True, 850.00, "Valproic acid, Probenecid", "Meronem 1g", "Pfizer"),
    ("MED-010", "Inj. Ceftriaxone Sodium", "Ceftriaxone", "Antibiotic", "Injection", "1 g", "Sch H1", "IV", False, 120.00, "Calcium IV infusions", "Monocef 1g", "Aristo Pharma"),
    ("MED-011", "Inj. Piperacillin + Tazobactam", "Piperacillin-Tazobactam", "Antibiotic", "Injection", "4.5 g", "Sch H1", "IV", True, 480.00, "Vancomycin, Tobramycin", "Pipzo 4.5g", "Cipla"),
    ("MED-012", "Inj. Vancomycin HCl", "Vancomycin", "Antibiotic", "Injection", "1 g", "Sch H1", "IV", True, 360.00, "Aminoglycosides, Furosemide", "Vancocin 1g", "Eli Lilly"),
    ("MED-013", "Tab. Amoxicillin + Clavulanate", "Amoxicillin-Clavulanic Acid", "Antibiotic", "Tablet", "625 mg", "Sch H", "Oral", False, 28.00, "Methotrexate, Warfarin", "Augmentin 625", "GlaxoSmithKline"),
    ("MED-014", "Tab. Azithromycin", "Azithromycin", "Antibiotic", "Tablet", "500 mg", "Sch H", "Oral", False, 24.50, "Antacids, Digoxin", "Azithral 500", "Alembic Pharma"),
    ("MED-015", "Tab. Cefixime", "Cefixime", "Antibiotic", "Tablet", "200 mg", "Sch H", "Oral", False, 19.00, "Carbamazepine, Warfarin", "Taxim-O 200", "Alkem Labs"),
    ("MED-016", "Inj. Cefuroxime", "Cefuroxime", "Antibiotic", "Injection", "1.5 g", "Sch H", "IV", False, 160.00, "Probenecid, Aminoglycosides", "Supacef 1.5g", "GlaxoSmithKline"),

    # Critical Care, Emergency & Anesthesia
    ("MED-017", "Inj. Noradrenaline", "Norepinephrine", "Critical Care", "Injection", "4 mg / 2 mL", "Sch H", "IV Infusion", True, 185.00, "MAO inhibitors, Tricyclic antidepressants", "Norad 4mg", "Neon Labs"),
    ("MED-018", "Inj. Potassium Chloride (KCl)", "Potassium Chloride", "Electrolytes", "Injection", "20 mEq / 10 mL", "Sch H", "IV Infusion", True, 35.00, "Potassium-sparing diuretics", "Potclor 10mL", "Troikaa"),
    ("MED-019", "Inj. Midazolam", "Midazolam", "Anesthesia", "Injection", "5 mg / 5 mL", "Sch X", "IV", True, 75.00, "Opioids, Ketoconazole", "Mezolam 5mg", "Neon Labs"),
    ("MED-020", "Inj. Propofol", "Propofol", "Anesthesia", "Injection", "20 mL (1%)", "Sch H", "IV", True, 210.00, "CNS depressants", "Neorof 1%", "Neon Labs"),
    ("MED-021", "Inj. Adrenaline (Epinephrine)", "Epinephrine", "Emergency", "Injection", "1 mg / mL", "Sch H", "IV/IM", True, 18.00, "Beta-blockers, Digoxin", "Vasocon 1mg", "Neon Labs"),
    ("MED-022", "Inj. Atropine Sulphate", "Atropine", "Emergency", "Injection", "0.6 mg / mL", "Sch H", "IV", False, 12.00, "Antihistamines, Phenothiazines", "Atropine 0.6mg", "Troikaa"),

    # Analgesics & Anti-inflammatory
    ("MED-023", "Inj. Tramadol HCl", "Tramadol", "Analgesic", "Injection", "50 mg / mL", "Sch H", "IV/IM", True, 45.00, "SSRIs, MAOIs, Warfarin", "Tramazac 50", "Zydus Lifesciences"),
    ("MED-024", "Tab. Paracetamol", "Acetaminophen", "Analgesic", "Tablet", "650 mg", "OTC", "Oral", False, 3.20, "Alcohol, Warfarin", "Dolo 650", "Micro Labs"),
    ("MED-025", "Inj. Paracetamol IV", "Acetaminophen", "Analgesic", "IV Infusion", "1000 mg / 100 mL", "Sch H", "IV", False, 180.00, "Enzyme inducers, Alcohol", "Paracip IV", "Cipla"),
    ("MED-026", "Inj. Diclofenac Sodium", "Diclofenac", "Analgesic", "Injection", "75 mg / 3 mL", "Sch H", "IM", False, 16.50, "ACE inhibitors, Lithium", "Voveran 75", "Novartis"),
    ("MED-027", "Tab. Ibuprofen", "Ibuprofen", "Analgesic", "Tablet", "400 mg", "OTC", "Oral", False, 4.50, "Aspirin, Anticoagulants", "Brufen 400", "Abbott India"),

    # Gastrointestinal & Antiemetic
    ("MED-028", "Inj. Pantoprazole", "Pantoprazole", "Gastrointestinal", "Injection", "40 mg", "Sch H", "IV", False, 65.00, "Ketoconazole, Methotrexate", "Pan 40 IV", "Alkem Labs"),
    ("MED-029", "Tab. Pantoprazole", "Pantoprazole", "Gastrointestinal", "Tablet", "40 mg", "Sch H", "Oral", False, 9.80, "Atazanavir, Clopidogrel", "Pantocid 40", "Sun Pharma"),
    ("MED-030", "Inj. Ondansetron", "Ondansetron", "Gastrointestinal", "Injection", "4 mg / 2 mL", "Sch H", "IV", False, 28.00, "Apomorphine, Tramadol", "Emeset 4mg", "Cipla"),
    ("MED-031", "Tab. Ondansetron", "Ondansetron", "Gastrointestinal", "Tablet", "4 mg", "Sch H", "Oral", False, 6.00, "Amiodarone, Haloperidol", "Vomitron 4mg", "Sun Pharma"),

    # Endocrine & Diabetes
    ("MED-032", "Inj. Human Actrapid Insulin", "Regular Insulin", "Endocrinology", "Injection", "100 IU / mL (10 mL)", "Sch H", "SC/IV", True, 220.00, "Corticosteroids, Beta-blockers", "Actrapid 100IU", "Novo Nordisk"),
    ("MED-033", "Inj. Insulin Glargine", "Insulin Glargine", "Endocrinology", "Injection", "100 IU / mL (3 mL Pen)", "Sch H", "SC", True, 680.00, "Oral hypoglycemics", "Lantus SoloStar", "Sanofi"),
    ("MED-034", "Tab. Metformin HCl", "Metformin", "Endocrinology", "Tablet", "500 mg", "Sch H", "Oral", False, 4.20, "Iodinated contrast media", "Glycomet 500", "USV Ltd"),
    ("MED-035", "Tab. Glimepiride", "Glimepiride", "Endocrinology", "Tablet", "2 mg", "Sch H", "Oral", False, 8.00, "Fluconazole, Salicylates", "Amaryl 2mg", "Sanofi"),

    # Respiratory
    ("MED-036", "Neb. Budesonide Respules", "Budesonide", "Respiratory", "Respules", "0.5 mg / 2 mL", "Sch H", "Inhalation", False, 32.00, "CYP3A4 inhibitors", "Budecort 0.5mg", "Cipla"),
    ("MED-037", "Neb. Salbutamol Respules", "Albuterol", "Respiratory", "Respules", "2.5 mg / 2.5 mL", "Sch H", "Inhalation", False, 18.00, "Beta-blockers, Diuretics", "Asthalin 2.5mg", "Cipla"),
    ("MED-038", "Inj. Hydrocortisone Sodium", "Hydrocortisone", "Respiratory", "Injection", "100 mg", "Sch H", "IV", False, 55.00, "NSAIDs, Antidiabetic drugs", "Efcorlin 100mg", "GlaxoSmithKline"),
    ("MED-039", "Tab. Doxofylline", "Doxofylline", "Respiratory", "Tablet", "400 mg", "Sch H", "Oral", False, 14.50, "Ciprofloxacin, Erythromycin", "Doxolin 400", "Zydus Lifesciences"),

    # IV Fluids
    ("MED-040", "Normal Saline 0.9% (NS)", "Sodium Chloride 0.9%", "IV Fluids", "IV Bottle", "500 mL", "OTC", "IV Infusion", False, 42.00, "Lithium, Corticosteroids", "NS 500mL", "Baxter Healthcare"),
    ("MED-041", "Ringer Lactate (RL)", "Balanced Electrolyte Solution", "IV Fluids", "IV Bottle", "500 mL", "OTC", "IV Infusion", False, 48.00, "Ceftriaxone, Citrated blood", "RL 500mL", "Fresenius Kabi"),
    ("MED-042", "Dextrose Normal Saline (DNS)", "Dextrose 5% + NaCl 0.9%", "IV Fluids", "IV Bottle", "500 mL", "OTC", "IV Infusion", False, 45.00, "Insulin, Corticosteroids", "DNS 500mL", "Otsuka Pharma"),

    # Oncology & Specialty
    ("MED-043", "Inj. Paclitaxel", "Paclitaxel", "Oncology", "Injection", "100 mg / 16.7 mL", "Sch H", "IV Infusion", True, 2800.00, "Cisplatin, Doxorubicin", "Taxol 100mg", "Bristol Myers Squibb"),
    ("MED-044", "Inj. Oxaliplatin", "Oxaliplatin", "Oncology", "Injection", "50 mg", "Sch H", "IV Infusion", True, 3400.00, "Aminoglycosides, Loop diuretics", "Eloxatin 50mg", "Sanofi"),
    ("MED-045", "Inj. Filgrastim (G-CSF)", "Filgrastim", "Oncology", "Injection", "300 mcg / 0.5 mL", "Sch H", "SC", True, 1450.00, "Bleomycin, Topotecan", "Neupogen 300mcg", "Amgen")
]

HOSPITAL_STORES = [
    ("STR-MAIN", "Central Medical Store (CMS)", "Central Warehouse", "Building A · Ground Floor Logistics Wing", "S. Radhakrishnan, Stores Incharge", "+91 98401 23901", 1240, 18500000.00, "2026-09-20", 99, "Active"),
    ("STR-PHARM", "Main Inpatient Pharmacy Store", "Dispense Pharmacy", "Building B · 1st Floor Clinical Hub", "K. Meena, Chief Pharmacist", "+91 98401 23902", 850, 6800000.00, "2026-09-22", 98, "Active"),
    ("STR-ER", "Emergency & Trauma Sub-Store", "Emergency Depot", "Ground Floor · Emergency & Trauma Wing", "Staff Nurse Vijay K", "+91 98401 23903", 210, 1450000.00, "2026-09-24", 97, "Active"),
    ("STR-OT", "OT Sterile Depot & Implant Store", "Surgical Store", "Building C · 3rd Floor OT Complex", "Sister Incharge Mary L", "+91 98401 23904", 420, 12500000.00, "2026-09-23", 100, "Active"),
    ("STR-ICU", "ICU Critical Care Drug Depot", "Critical Care Store", "Building B · 2nd Floor ICU", "Staff Nurse Deepa K", "+91 98401 23905", 160, 2100000.00, "2026-09-24", 99, "Active"),
    ("STR-ONC", "Oncology & Chemo Cleanroom Store", "Specialized Pharmacy", "Building D · 4th Floor Daycare", "R. Sundar, Oncology Pharmacist", "+91 98401 23906", 95, 8400000.00, "2026-09-21", 100, "Active"),
    ("STR-PED", "Pediatric & NICU Sub-Store", "Ward Depot", "Building B · 3rd Floor NICU Wing", "Sister Incharge Geetha P", "+91 98401 23907", 130, 950000.00, "2026-09-23", 98, "Active"),
    ("STR-GEN", "General Inpatient Wards Depot", "Ward Depot", "Building A · 3rd Floor Nursing Station", "Staff Nurse Anitha K", "+91 98401 23908", 180, 1100000.00, "2026-09-24", 96, "Active")
]

HOSPITAL_VENDORS = [
    ("VND-001", "Cipla Lifesciences Ltd.", "Pharmaceuticals", "Rajesh Sharma", "+91 98400 11001", "institutional@cipla.com", "33AABCC1234F1Z1", 98, "2027-03-31", "Net 30 Days", "Preferred Partner"),
    ("VND-002", "Sanofi India Healthcare", "Cardiovascular & Insulin", "Anand Verma", "+91 98400 11002", "hospital.sales@sanofi.com", "33AABCS4567G1Z2", 99, "2027-06-30", "Net 45 Days", "Active"),
    ("VND-003", "Sun Pharmaceutical Industries", "Broad-Spectrum Formulations", "Pooja Krishnan", "+91 98400 11003", "institutional@sunpharma.com", "33AABCS7890H1Z3", 96, "2027-01-31", "Net 30 Days", "Active"),
    ("VND-004", "Zydus Healthcare Pvt Ltd", "Critical Care & Analgesics", "Suresh Nair", "+91 98400 11004", "sales.tn@zyduslife.com", "33AABCZ3456J1Z4", 95, "2026-12-31", "Net 30 Days", "Under Renewal"),
    ("VND-005", "B. Braun Medical India", "IV Fluids & Infusion Systems", "Karthik Menon", "+91 98400 11005", "hospital@bbraun.com", "33AABCB9012K1Z5", 99, "2027-12-31", "Net 60 Days", "Preferred Partner"),
    ("VND-006", "Johnson & Johnson MedTech", "Surgical Sutures & Implants", "Divya Sundaram", "+91 98400 11006", "medtech.chennai@jnj.com", "33AABCJ5678L1Z6", 100, "2028-03-31", "Net 45 Days", "Preferred Partner"),
    ("VND-007", "Novo Nordisk India", "Endocrinology & Diabetology", "Dr. Vikram Joshi", "+91 98400 11007", "institutional@novonordisk.com", "33AABCN1234M1Z7", 98, "2027-08-31", "Net 30 Days", "Active"),
    ("VND-008", "Roche Diagnostics India", "Reagents & Lab Consumables", "Meenakshi Das", "+91 98400 11008", "orders.india@roche.com", "33AABCR8901N1Z8", 97, "2027-05-31", "Net 30 Days", "Active"),
    ("VND-009", "Linde India Medical Gases", "Liquid Medical Oxygen & Gas Cylinders", "Ganesh Murugan", "+91 98400 11009", "medgases@linde.in", "33AABCL4321P1Z9", 100, "2028-06-30", "Net 15 Days", "Preferred Partner"),
    ("VND-010", "Alkem Laboratories", "Antibiotics & Gastroenterology", "Ramesh Babu", "+91 98400 11010", "supply@alkem.com", "33AABCA8765Q1Z0", 94, "2026-11-30", "Net 30 Days", "Active")
]

PROCUREMENT_ORDERS = [
    ("PO-2026-0841", "Cipla Lifesciences Ltd.", "VND-001", "2026-09-18", "2026-09-25", "Pharmaceuticals", 14, 485000.00, "Dr. K. Senthil, Medical Director", "3-Way Invoice Matched", "Net 30 Days", "GRN-2026-0412"),
    ("PO-2026-0842", "Sanofi India Healthcare", "VND-002", "2026-09-19", "2026-09-26", "Critical Care & Insulin", 8, 720000.00, "Dr. K. Senthil, Medical Director", "Goods Received (GRN Verified)", "Net 45 Days", "GRN-2026-0418"),
    ("PO-2026-0843", "B. Braun Medical India", "VND-005", "2026-09-20", "2026-09-27", "IV Fluids & Infusions", 6, 215000.00, "Chief Pharmacist K. Meena", "Approved · Dispatched", "Net 60 Days", None),
    ("PO-2026-0844", "Johnson & Johnson MedTech", "VND-006", "2026-09-21", "2026-09-28", "Surgical Implants & Sutures", 22, 1450000.00, "Dr. K. Senthil, Medical Director", "Goods Received (GRN Verified)", "Net 45 Days", "GRN-2026-0425"),
    ("PO-2026-0845", "Novo Nordisk India", "VND-007", "2026-09-22", "2026-09-29", "Insulin Analogs", 5, 340000.00, "Chief Pharmacist K. Meena", "Approved · Dispatched", "Net 30 Days", None),
    ("PO-2026-0846", "Linde India Medical Gases", "VND-009", "2026-09-23", "2026-09-25", "Medical Gases & LMO", 2, 180000.00, "Hospital Operations Head", "3-Way Invoice Matched", "Net 15 Days", "GRN-2026-0430"),
    ("PO-2026-0847", "Sun Pharmaceutical Industries", "VND-003", "2026-09-24", "2026-10-01", "Oral Solid Dosages", 18, 520000.00, "Chief Pharmacist K. Meena", "Pending Approval", "Net 30 Days", None),
    ("PO-2026-0848", "Zydus Healthcare Pvt Ltd", "VND-004", "2026-09-24", "2026-10-02", "Emergency Injectables", 12, 290000.00, "Dr. K. Senthil, Medical Director", "Pending Approval", "Net 30 Days", None)
]

CSSD_RECORDS = [
    ("CSSD-2026-C0481", "Steam Autoclave Unit #1 (134°C)", "Major Orthopedic Trauma Instrument Set", "06:30 AM", 134.0, 2.15, "Passed · Negative", "Technician S. Murugan", "07:45 AM", "2026-10-24", "OT Complex · OT-1 (Ortho)", "Sterile · Released"),
    ("CSSD-2026-C0482", "Steam Autoclave Unit #2 (134°C)", "Laparoscopic Cholecystectomy Kit #3", "07:00 AM", 134.0, 2.10, "Passed · Negative", "Technician P. Kumar", "08:15 AM", "2026-10-24", "OT Complex · OT-2 (General)", "Sterile · Released"),
    ("CSSD-2026-C0483", "Plasma Sterilizer Unit #1 (H2O2 55°C)", "Rigid Neuro-Endoscopy & Optics Kit", "08:00 AM", 55.0, 0.85, "Passed · Negative", "Technician S. Murugan", "09:30 AM", "2026-10-24", "OT Complex · OT-4 (Neuro)", "Sterile · Released"),
    ("CSSD-2026-C0484", "Steam Autoclave Unit #1 (134°C)", "Emergency Trauma Cut-Down & Suture Trays (x4)", "09:15 AM", 134.0, 2.12, "Passed · Negative", "Technician R. Anitha", "10:30 AM", "2026-10-24", "Emergency & Trauma Bay", "Sterile · Released"),
    ("CSSD-2026-C0485", "Steam Autoclave Unit #3 (Flash OT)", "Emergency Vascular Graft Clamp Tray", "10:45 AM", 134.5, 2.20, "Passed · Negative", "Technician P. Kumar", "11:15 AM", "2026-10-24", "OT Complex · OT-3 (Cardiac)", "Sterile · Released"),
    ("CSSD-2026-C0486", "Steam Autoclave Unit #2 (134°C)", "Cesarean Section Obstetric Pack #2", "11:30 AM", 134.0, 2.10, "Passed · Negative", "Technician R. Anitha", "12:45 PM", "2026-10-24", "Labor & Delivery Suite", "Sterile · Released"),
    ("CSSD-2026-C0487", "Plasma Sterilizer Unit #1 (H2O2 55°C)", "Cardiac Catheterization Sheath Kit", "01:00 PM", 55.0, 0.88, "Passed · Negative", "Technician S. Murugan", "02:30 PM", "2026-10-24", "Cath Lab · Suite 1", "Sterile · Released"),
    ("CSSD-2026-C0488", "Steam Autoclave Unit #1 (134°C)", "Universal Major Laparotomy Instrument Set", "02:45 PM", 134.0, 2.15, "Incubating 24h", "Technician P. Kumar", None, "2026-10-24", "OT Complex Central Sterile Holding", "In Cycle · Sterilizing"),
    ("CSSD-2026-C0489", "Steam Autoclave Unit #2 (134°C)", "Spinal Pedicle Screw Instrumentation Tray", "03:15 PM", 134.2, 2.16, "Incubating 24h", "Technician R. Anitha", None, "2026-10-24", "OT Complex Central Sterile Holding", "In Cycle · Sterilizing"),
    ("CSSD-2026-C0490", "Flash Autoclave Unit #3 (Emergency)", "Emergency Bronchoscopy Biopsy Forceps", "03:30 PM", 134.0, 2.10, "Incubating 24h", "Technician S. Murugan", None, "2026-10-24", "Pulmonology Suite", "Quarantined · Biological Test Pending")
]

def main():
    conn = get_conn()
    cur = conn.cursor()

    print("Step 1: Expanding medications table schema and inserting hospital drug master...")
    cur.execute("""
        ALTER TABLE medications ADD COLUMN IF NOT EXISTS dosage_form VARCHAR(50);
        ALTER TABLE medications ADD COLUMN IF NOT EXISTS strength VARCHAR(50);
        ALTER TABLE medications ADD COLUMN IF NOT EXISTS schedule VARCHAR(20);
        ALTER TABLE medications ADD COLUMN IF NOT EXISTS route VARCHAR(30);
        ALTER TABLE medications ADD COLUMN IF NOT EXISTS is_high_alert BOOLEAN DEFAULT FALSE;
        ALTER TABLE medications ADD COLUMN IF NOT EXISTS interactions TEXT;
        ALTER TABLE medications ADD COLUMN IF NOT EXISTS brand_name VARCHAR(150);
        ALTER TABLE medications ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(150);
    """)

    # Truncate and re-seed medications cleanly
    # Note: Check if FK constraints exist
    try:
        cur.execute("TRUNCATE TABLE medications CASCADE;")
    except Exception as e:
        conn.rollback()
        cur.execute("DELETE FROM medications;")

    insert_med_sql = """
        INSERT INTO medications (
            medication_id, medication_code, medication_name, generic_name,
            category, dosage_form, strength, schedule, route, is_high_alert,
            unit_price, interactions, brand_name, manufacturer, status
        ) VALUES %s;
    """
    med_rows = []
    for idx, d in enumerate(HOSPITAL_DRUGS, 1):
        med_rows.append((
            idx, d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8],
            d[9], d[10], d[11], d[12], "Active"
        ))
    psycopg2.extras.execute_values(cur, insert_med_sql, med_rows)
    print(f"Inserted {len(med_rows)} hospital drugs into medications.")

    print("\nStep 2: Populating pharmacy_inventory with live batches for all medications...")
    cur.execute("""
        ALTER TABLE pharmacy_inventory ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT 100;
        ALTER TABLE pharmacy_inventory ADD COLUMN IF NOT EXISTS storage_condition VARCHAR(100);
        ALTER TABLE pharmacy_inventory ADD COLUMN IF NOT EXISTS location VARCHAR(100);
    """)
    try:
        cur.execute("TRUNCATE TABLE pharmacy_inventory CASCADE;")
    except Exception:
        conn.rollback()
        cur.execute("DELETE FROM pharmacy_inventory;")

    inv_rows = []
    inv_id = 1
    rnd = random.Random(202)

    suppliers = [
        "Cipla Lifesciences Ltd.", "Sanofi India Healthcare", "Sun Pharmaceutical Industries",
        "Zydus Healthcare Pvt Ltd", "B. Braun Medical India", "Novo Nordisk India"
    ]

    for idx, d in enumerate(HOSPITAL_DRUGS, 1):
        # 1 to 2 batches per drug
        num_batches = rnd.choice([1, 2])
        for b_i in range(num_batches):
            batch_no = f"B26-{idx:03d}-{b_i+1}"
            exp_days = rnd.randint(180, 720)
            exp_date = date.today() + timedelta(days=exp_days)
            
            # Distribution of stock
            r_stock = rnd.random()
            if r_stock < 0.10:
                qty = rnd.randint(5, 25)
                status = "Critical Stock"
            elif r_stock < 0.25:
                qty = rnd.randint(30, 80)
                status = "Low Stock"
            else:
                qty = rnd.randint(250, 4500)
                status = "In Stock"

            selling = float(d[9])
            cost = round(selling * 0.72, 2)
            sup = rnd.choice(suppliers)
            storage = "Cold Room 2°C - 8°C" if (d[7] in ("SC", "IV Infusion") and "Insulin" in d[1] or "Enoxaparin" in d[1]) else "Controlled Vault" if d[6] == "Sch X" else "Air Conditioned 15°C - 25°C"
            loc = f"Bay {chr(65 + (idx % 6))}-Shelf {((idx * 3 + b_i) % 8) + 1}"

            inv_rows.append((
                inv_id, idx, batch_no, exp_date, qty, cost, selling, sup, status,
                100, storage, loc
            ))
            inv_id += 1

    insert_inv_sql = """
        INSERT INTO pharmacy_inventory (
            inventory_id, medication_id, batch_number, expiry_date, available_quantity,
            unit_cost, selling_price, supplier, stock_status, reorder_level,
            storage_condition, location
        ) VALUES %s;
    """
    psycopg2.extras.execute_values(cur, insert_inv_sql, inv_rows)
    print(f"Inserted {len(inv_rows)} active stock batches into pharmacy_inventory.")

    print("\nStep 3: Creating and populating hospital_stores...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS hospital_stores (
            id SERIAL PRIMARY KEY,
            store_code VARCHAR(30) UNIQUE NOT NULL,
            store_name VARCHAR(150) NOT NULL,
            store_type VARCHAR(50) NOT NULL,
            location VARCHAR(150) NOT NULL,
            incharge_name VARCHAR(100) NOT NULL,
            contact_number VARCHAR(30),
            total_skus INT DEFAULT 0,
            total_valuation NUMERIC(14,2) DEFAULT 0,
            last_audit_date DATE,
            stock_health_pct INT DEFAULT 98,
            status VARCHAR(30) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("TRUNCATE TABLE hospital_stores RESTART IDENTITY;")
    insert_stores_sql = """
        INSERT INTO hospital_stores (
            store_code, store_name, store_type, location, incharge_name,
            contact_number, total_skus, total_valuation, last_audit_date,
            stock_health_pct, status
        ) VALUES %s;
    """
    store_tuples = [s for s in HOSPITAL_STORES]
    psycopg2.extras.execute_values(cur, insert_stores_sql, store_tuples)
    print(f"Inserted {len(store_tuples)} hospital depots into hospital_stores.")

    print("\nStep 4: Creating and populating hospital_vendors...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS hospital_vendors (
            id SERIAL PRIMARY KEY,
            vendor_code VARCHAR(30) UNIQUE NOT NULL,
            vendor_name VARCHAR(150) NOT NULL,
            category VARCHAR(100) NOT NULL,
            contact_person VARCHAR(100) NOT NULL,
            phone VARCHAR(30) NOT NULL,
            email VARCHAR(100) NOT NULL,
            gstin VARCHAR(30),
            compliance_score INT DEFAULT 95,
            contract_valid_until DATE NOT NULL,
            payment_terms VARCHAR(50) DEFAULT 'Net 30 Days',
            status VARCHAR(30) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("TRUNCATE TABLE hospital_vendors RESTART IDENTITY;")
    insert_vendors_sql = """
        INSERT INTO hospital_vendors (
            vendor_code, vendor_name, category, contact_person, phone,
            email, gstin, compliance_score, contract_valid_until, payment_terms, status
        ) VALUES %s;
    """
    vendor_tuples = [v for v in HOSPITAL_VENDORS]
    psycopg2.extras.execute_values(cur, insert_vendors_sql, vendor_tuples)
    print(f"Inserted {len(vendor_tuples)} certified vendors into hospital_vendors.")

    print("\nStep 5: Creating and populating procurement_orders...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS procurement_orders (
            id SERIAL PRIMARY KEY,
            po_number VARCHAR(50) UNIQUE NOT NULL,
            vendor_name VARCHAR(150) NOT NULL,
            vendor_code VARCHAR(30),
            order_date DATE NOT NULL,
            expected_delivery DATE NOT NULL,
            category VARCHAR(100) NOT NULL,
            items_count INT NOT NULL,
            total_amount NUMERIC(14,2) NOT NULL,
            approved_by VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL,
            payment_terms VARCHAR(50) DEFAULT 'Net 30 Days',
            grn_number VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("TRUNCATE TABLE procurement_orders RESTART IDENTITY;")
    insert_po_sql = """
        INSERT INTO procurement_orders (
            po_number, vendor_name, vendor_code, order_date, expected_delivery,
            category, items_count, total_amount, approved_by, status,
            payment_terms, grn_number
        ) VALUES %s;
    """
    po_tuples = [p for p in PROCUREMENT_ORDERS]
    psycopg2.extras.execute_values(cur, insert_po_sql, po_tuples)
    print(f"Inserted {len(po_tuples)} purchase orders into procurement_orders.")

    print("\nStep 6: Creating and populating cssd_sterilization_records...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS cssd_sterilization_records (
            id SERIAL PRIMARY KEY,
            cycle_number VARCHAR(50) UNIQUE NOT NULL,
            sterilizer_id VARCHAR(100) NOT NULL,
            pack_type VARCHAR(150) NOT NULL,
            load_time VARCHAR(30) NOT NULL,
            temperature_c NUMERIC(5,1) DEFAULT 134.0,
            pressure_bar NUMERIC(4,2) DEFAULT 2.10,
            biological_indicator VARCHAR(50) DEFAULT 'Passed · Negative',
            technician_name VARCHAR(100) NOT NULL,
            release_time VARCHAR(30),
            expiry_date DATE NOT NULL,
            destination_ward VARCHAR(100) NOT NULL,
            status VARCHAR(50) DEFAULT 'Sterile · Released',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("TRUNCATE TABLE cssd_sterilization_records RESTART IDENTITY;")
    insert_cssd_sql = """
        INSERT INTO cssd_sterilization_records (
            cycle_number, sterilizer_id, pack_type, load_time, temperature_c,
            pressure_bar, biological_indicator, technician_name, release_time,
            expiry_date, destination_ward, status
        ) VALUES %s;
    """
    cssd_tuples = [c for c in CSSD_RECORDS]
    psycopg2.extras.execute_values(cur, insert_cssd_sql, cssd_tuples)
    print(f"Inserted {len(cssd_tuples)} sterilization records into cssd_sterilization_records.")

    print("\nStep 7: Diversifying recent prescription_items and pharmacy_sale_items...")
    # Diversify the latest 10,000 prescription_items so they reference drugs 1..45 with realistic doses
    cur.execute("""
        UPDATE prescription_items
        SET medication_id = ((prescription_id * 7 + prescription_item_id) % 45) + 1
        WHERE prescription_id >= (SELECT MAX(prescription_id) - 15000 FROM prescription_items);
    """)
    print(f"Diversified {cur.rowcount} recent prescription_items across hospital drugs formulary.")

    cur.execute("""
        UPDATE pharmacy_sale_items
        SET medication_id = ((sale_id * 11 + sale_item_id) % 45) + 1
        WHERE sale_id >= (SELECT MAX(sale_id) - 15000 FROM pharmacy_sale_items);
    """)
    print(f"Diversified {cur.rowcount} recent pharmacy_sale_items across hospital drugs formulary.")

    conn.commit()
    cur.close()
    conn.close()
    print("\nAll Pharmacy & Supply Chain tables populated successfully!")

if __name__ == "__main__":
    main()
