"""
Database Migration Script: Add All Role Users
Path: backend/alter_db/add_all_role_users.py

Populates 4 to 5 users for every system role displayed in the application header:
- Nurse (5 users)
- Front Office (5 users)
- Billing (5 users)
- Finance Manager (5 users)
- Insurance (5 users)
- Radiologist (5 users total including existing)
- Laboratory (5 users)
- Pathologist (5 users)
- Pharmacy (5 users)
- Store Manager (5 users)
- Procurement Officer (5 users)
- HR Manager (5 users)
- Canteen Manager (5 users)
- Hospital Management (5 users)
- AI Administrator (5 users)
- Governance Officer (5 users)
- IT Administrator (5 users)
- Auditor (5 users)
- Patient (ensures 5 active patient accounts)
(Doctors and Admin are preserved/skipped as requested)

Default Password for all seeded users: Hospital@2026
"""

import sys
import os
from pathlib import Path
import datetime
import bcrypt

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import db_config

DEFAULT_PASSWORD = "Hospital@2026"

def hash_password(plain_password: str) -> str:
    """Generate bcrypt password hash."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode('utf-8'), salt).decode('utf-8')

# ── Role Definitions & Departments ──────────────────────────────────────────

DEPARTMENTS_DATA = [
    ("MER-NURS", "Nursing Services", "Inpatient, ICU, Emergency and general ward nursing care", "Clinical"),
    ("MER-FDESK", "Front Office", "Patient reception, registration, appointments, and general inquiries", "Administrative"),
    ("MER-BILL", "Billing & Cashier", "OPD & IP billing, clearance, tariff management, and settlements", "Finance"),
    ("MER-FIN", "Finance & Accounts", "Financial management, accounting, budgeting, and revenue cycle", "Finance"),
    ("MER-INSR", "Insurance & TPA", "Pre-authorization, claims processing, and insurance coordination", "Administrative"),
    ("MER-RADL", "Radiology", "X-Ray, CT Scan, MRI, Ultrasound and diagnostic imaging", "Diagnostic"),
    ("MER-LAB", "Laboratory", "Clinical pathology, biochemistry, microbiology, and hematology", "Diagnostic"),
    ("MER-PATH", "Pathology", "Histopathology, cytopathology, and molecular diagnostics", "Diagnostic"),
    ("MER-PHRM", "Pharmacy", "Central pharmacy, inpatient medication dispensing, and clinical supply", "Support"),
    ("MER-STRS", "Central Stores", "Inventory storage, material management, and ward replenishment", "Support"),
    ("MER-PROC", "Procurement", "Vendor management, purchasing, contracts, and medical supply chain", "Support"),
    ("MER-HR", "Human Resources", "Staff recruitment, credentialing, payroll, and employee services", "Administrative"),
    ("MER-CANT", "Dietary Services", "Patient therapeutic meals, hospital canteen, and food hygiene", "Support"),
    ("MER-ADMN", "Administration", "Hospital executive leadership, operational management, and medical directorate", "Management"),
    ("MER-AI", "AI Systems Governance", "AI agent configuration, clinical AI models, and RAG architectures", "Technology"),
    ("MER-GOV", "Clinical Governance", "Quality assurance, compliance, ethics, and hospital accreditation (NABH/JCI)", "Governance"),
    ("MER-IT", "IT Infrastructure", "Hospital Information Systems, network, security, and integration", "Technology"),
    ("MER-AUDT", "Internal Audit", "Clinical audit, revenue assurance, statutory and forensic compliance", "Governance"),
]

# Role catalog mapping: role name -> description
ROLES_TO_ENSURE = [
    ("Nurse", "Nursing and clinical care staff"),
    ("Front Office", "Front desk, registration and reception"),
    ("Billing", "Billing, tariff and discharge clearance"),
    ("Finance Manager", "Financial management and accounting"),
    ("Insurance", "TPA and insurance coordination"),
    ("Radiologist", "Diagnostic imaging specialist"),
    ("Laboratory", "Clinical laboratory technologist"),
    ("Pathologist", "Consultant pathologist"),
    ("Pharmacy", "Central and inpatient pharmacy"),
    ("Store Manager", "Hospital material and stores lead"),
    ("Procurement Officer", "Procurement and supply chain lead"),
    ("HR Manager", "Human resources and personnel lead"),
    ("Canteen Manager", "Dietary and kitchen services lead"),
    ("Hospital Management", "Hospital leadership and administration"),
    ("AI Administrator", "AI system engineering and governance"),
    ("Governance Officer", "Clinical quality and compliance officer"),
    ("IT Administrator", "IT systems and infrastructure admin"),
    ("Auditor", "Internal clinical and financial auditor"),
    ("Patient", "Registered patient account"),
]

# User seeds: 5 users per role (Doctors and Admin are preserved)
USERS_TO_SEED = [
    # ── 1. Nurse (5 users) ──────────────────────────────────────────────────
    {
        "role": "Nurse",
        "username": "anitha.kumar",
        "first_name": "Anitha",
        "last_name": "Kumar",
        "staff_name": "Nurse Anitha Kumar",
        "email": "anitha.kumar@meridian.com",
        "phone": "9840100101",
        "dept_code": "MER-NURS",
        "staff_type": "Head Nurse · Inpatient Wards",
        "experience": 9,
        "salary": 55000
    },
    {
        "role": "Nurse",
        "username": "k.selvi",
        "first_name": "K.",
        "last_name": "Selvi",
        "staff_name": "Nurse K. Selvi",
        "email": "k.selvi@meridian.com",
        "phone": "9840100102",
        "dept_code": "MER-NURS",
        "staff_type": "Charge Nurse · Intensive Care Unit",
        "experience": 7,
        "salary": 48000
    },
    {
        "role": "Nurse",
        "username": "sneha.rao",
        "first_name": "Sneha",
        "last_name": "Rao",
        "staff_name": "Nurse Sneha Rao",
        "email": "sneha.rao@meridian.com",
        "phone": "9840100103",
        "dept_code": "MER-NURS",
        "staff_type": "Senior Staff Nurse · Emergency",
        "experience": 5,
        "salary": 42000
    },
    {
        "role": "Nurse",
        "username": "rajesh.nair",
        "first_name": "Rajesh",
        "last_name": "Nair",
        "staff_name": "Nurse Rajesh Nair",
        "email": "rajesh.nair@meridian.com",
        "phone": "9840100104",
        "dept_code": "MER-NURS",
        "staff_type": "Staff Nurse · Surgical Ward",
        "experience": 4,
        "salary": 38000
    },
    {
        "role": "Nurse",
        "username": "divya.kumar",
        "first_name": "Divya",
        "last_name": "Kumar",
        "staff_name": "Nurse Divya Kumar",
        "email": "divya.kumar@meridian.com",
        "phone": "9840100105",
        "dept_code": "MER-NURS",
        "staff_type": "Clinical Nurse Specialist · Pediatrics",
        "experience": 6,
        "salary": 45000
    },

    # ── 2. Front Office (5 users) ───────────────────────────────────────────
    {
        "role": "Front Office",
        "username": "bhavani.kumar",
        "first_name": "Bhavani",
        "last_name": "Kumar",
        "staff_name": "Bhavani Kumar",
        "email": "bhavani.kumar@meridian.com",
        "phone": "9840100201",
        "dept_code": "MER-FDESK",
        "staff_type": "Front Desk Lead · Reception",
        "experience": 8,
        "salary": 40000
    },
    {
        "role": "Front Office",
        "username": "senthil.kumar",
        "first_name": "Senthil",
        "last_name": "Kumar",
        "staff_name": "Senthil Kumar",
        "email": "senthil.kumar@meridian.com",
        "phone": "9840100202",
        "dept_code": "MER-FDESK",
        "staff_type": "Admissions Desk Coordinator",
        "experience": 5,
        "salary": 34000
    },
    {
        "role": "Front Office",
        "username": "kavitha.fo",
        "first_name": "Kavitha",
        "last_name": "Sundaram",
        "staff_name": "Kavitha Sundaram",
        "email": "kavitha.fo@meridian.com",
        "phone": "9840100203",
        "dept_code": "MER-FDESK",
        "staff_type": "Patient Registration Executive",
        "experience": 4,
        "salary": 32000
    },
    {
        "role": "Front Office",
        "username": "mohan.das",
        "first_name": "Mohan",
        "last_name": "Das",
        "staff_name": "Mohan Das",
        "email": "mohan.das@meridian.com",
        "phone": "9840100204",
        "dept_code": "MER-FDESK",
        "staff_type": "OPD Flow & Token Supervisor",
        "experience": 6,
        "salary": 36000
    },
    {
        "role": "Front Office",
        "username": "preethi.raj",
        "first_name": "Preethi",
        "last_name": "Raj",
        "staff_name": "Preethi Raj",
        "email": "preethi.raj@meridian.com",
        "phone": "9840100205",
        "dept_code": "MER-FDESK",
        "staff_type": "Concierge & Appointment Executive",
        "experience": 3,
        "salary": 30000
    },

    # ── 3. Billing (5 users) ────────────────────────────────────────────────
    {
        "role": "Billing",
        "username": "k.meena",
        "first_name": "K.",
        "last_name": "Meena",
        "staff_name": "K. Meena",
        "email": "k.meena@meridian.com",
        "phone": "9840100301",
        "dept_code": "MER-BILL",
        "staff_type": "Billing Executive · OPD / IP",
        "experience": 7,
        "salary": 45000
    },
    {
        "role": "Billing",
        "username": "divya.prakash",
        "first_name": "Divya",
        "last_name": "Prakash",
        "staff_name": "Divya Prakash",
        "email": "divya.prakash@meridian.com",
        "phone": "9840100302",
        "dept_code": "MER-BILL",
        "staff_type": "Chief Billing Officer · Discharge Clearance",
        "experience": 10,
        "salary": 60000
    },
    {
        "role": "Billing",
        "username": "arun.pandian",
        "first_name": "Arun",
        "last_name": "Pandian",
        "staff_name": "Arun Pandian",
        "email": "arun.pandian@meridian.com",
        "phone": "9840100303",
        "dept_code": "MER-BILL",
        "staff_type": "Cashier & Settlement Officer",
        "experience": 4,
        "salary": 35000
    },
    {
        "role": "Billing",
        "username": "sandhya.rani",
        "first_name": "Sandhya",
        "last_name": "Rani",
        "staff_name": "Sandhya Rani",
        "email": "sandhya.rani@meridian.com",
        "phone": "9840100304",
        "dept_code": "MER-BILL",
        "staff_type": "Inpatient Tariff & Audit Specialist",
        "experience": 6,
        "salary": 42000
    },
    {
        "role": "Billing",
        "username": "karthik.billing",
        "first_name": "Karthik",
        "last_name": "Venkatesh",
        "staff_name": "Karthik Venkatesh",
        "email": "karthik.billing@meridian.com",
        "phone": "9840100305",
        "dept_code": "MER-BILL",
        "staff_type": "Financial Counselor & Estimation Desk",
        "experience": 5,
        "salary": 38000
    },

    # ── 4. Finance Manager (5 users) ────────────────────────────────────────
    {
        "role": "Finance Manager",
        "username": "t.venkat",
        "first_name": "T.",
        "last_name": "Venkat",
        "staff_name": "T. Venkat",
        "email": "t.venkat@meridian.com",
        "phone": "9840100401",
        "dept_code": "MER-FIN",
        "staff_type": "Head of Finance & Treasury",
        "experience": 14,
        "salary": 110000
    },
    {
        "role": "Finance Manager",
        "username": "ramesh.babu",
        "first_name": "Ramesh",
        "last_name": "Babu",
        "staff_name": "Ramesh Babu",
        "email": "ramesh.babu@meridian.com",
        "phone": "9840100402",
        "dept_code": "MER-FIN",
        "staff_type": "Financial Controller",
        "experience": 12,
        "salary": 95000
    },
    {
        "role": "Finance Manager",
        "username": "murugan.finance",
        "first_name": "S.",
        "last_name": "Murugan",
        "staff_name": "S. Murugan",
        "email": "murugan.finance@meridian.com",
        "phone": "9840100403",
        "dept_code": "MER-FIN",
        "staff_type": "Revenue Cycle & Accounts Manager",
        "experience": 9,
        "salary": 80000
    },
    {
        "role": "Finance Manager",
        "username": "nalini.sridhar",
        "first_name": "Nalini",
        "last_name": "Sridhar",
        "staff_name": "Nalini Sridhar",
        "email": "nalini.sridhar@meridian.com",
        "phone": "9840100404",
        "dept_code": "MER-FIN",
        "staff_type": "Senior Cost & Budget Analyst",
        "experience": 8,
        "salary": 72000
    },
    {
        "role": "Finance Manager",
        "username": "anand.swami",
        "first_name": "Anand",
        "last_name": "Swaminathan",
        "staff_name": "Anand Swaminathan",
        "email": "anand.swami@meridian.com",
        "phone": "9840100405",
        "dept_code": "MER-FIN",
        "staff_type": "Treasury & Tax Accounting Manager",
        "experience": 11,
        "salary": 88000
    },

    # ── 5. Insurance (5 users) ──────────────────────────────────────────────
    {
        "role": "Insurance",
        "username": "r.sundar",
        "first_name": "R.",
        "last_name": "Sundar",
        "staff_name": "R. Sundar",
        "email": "r.sundar@meridian.com",
        "phone": "9840100501",
        "dept_code": "MER-INSR",
        "staff_type": "TPA & Insurance Coordinator",
        "experience": 10,
        "salary": 58000
    },
    {
        "role": "Insurance",
        "username": "jayashree.nathan",
        "first_name": "Jayashree",
        "last_name": "Nathan",
        "staff_name": "Jayashree Nathan",
        "email": "jayashree.nathan@meridian.com",
        "phone": "9840100502",
        "dept_code": "MER-INSR",
        "staff_type": "Pre-Authorization Specialist",
        "experience": 6,
        "salary": 44000
    },
    {
        "role": "Insurance",
        "username": "vignesh.insurance",
        "first_name": "Vignesh",
        "last_name": "Raman",
        "staff_name": "Vignesh Raman",
        "email": "vignesh.insurance@meridian.com",
        "phone": "9840100503",
        "dept_code": "MER-INSR",
        "staff_type": "Claims Adjudication Lead",
        "experience": 7,
        "salary": 48000
    },
    {
        "role": "Insurance",
        "username": "malathi.chandran",
        "first_name": "Malathi",
        "last_name": "Chandran",
        "staff_name": "Malathi Chandran",
        "email": "malathi.chandran@meridian.com",
        "phone": "9840100504",
        "dept_code": "MER-INSR",
        "staff_type": "Cashless Hospitalization Desk Officer",
        "experience": 5,
        "salary": 40000
    },
    {
        "role": "Insurance",
        "username": "praveen.tpa",
        "first_name": "Praveen",
        "last_name": "Kumar",
        "staff_name": "Praveen Kumar",
        "email": "praveen.tpa@meridian.com",
        "phone": "9840100505",
        "dept_code": "MER-INSR",
        "staff_type": "Govt Schemes & ECHS Coordinator",
        "experience": 8,
        "salary": 50000
    },

    # ── 6. Radiologist (4 users to add to existing dr.vilsonty.m = 5 total) ──
    {
        "role": "Radiologist",
        "username": "jancy.selvam",
        "first_name": "Jancy",
        "last_name": "Selvam",
        "staff_name": "Dr. Jancy Selvam",
        "email": "jancy.selvam@meridian.com",
        "phone": "9840100601",
        "dept_code": "MER-RADL",
        "staff_type": "Senior Radiologist · MRI / CT",
        "experience": 11,
        "salary": 140000,
        "is_doctor_profile": True,
        "qualification": "MBBS, MD (Radiodiagnosis)",
        "specialization": "Radiology"
    },
    {
        "role": "Radiologist",
        "username": "dr.vikram.rad",
        "first_name": "Vikram",
        "last_name": "Nair",
        "staff_name": "Dr. Vikram Nair",
        "email": "dr.vikram.rad@meridian.com",
        "phone": "9840100602",
        "dept_code": "MER-RADL",
        "staff_type": "Consultant Radiologist · Ultrasound & Doppler",
        "experience": 13,
        "salary": 150000,
        "is_doctor_profile": True,
        "qualification": "MBBS, DMRD, DNB",
        "specialization": "Radiology"
    },
    {
        "role": "Radiologist",
        "username": "dr.deepa.rad",
        "first_name": "Deepa",
        "last_name": "Sundaram",
        "staff_name": "Dr. Deepa Sundaram",
        "email": "dr.deepa.rad@meridian.com",
        "phone": "9840100603",
        "dept_code": "MER-RADL",
        "staff_type": "Diagnostic Radiologist · Women's Imaging",
        "experience": 9,
        "salary": 130000,
        "is_doctor_profile": True,
        "qualification": "MBBS, MD",
        "specialization": "Radiology"
    },
    {
        "role": "Radiologist",
        "username": "dr.harish.rad",
        "first_name": "Harish",
        "last_name": "Balan",
        "staff_name": "Dr. Harish Balan",
        "email": "dr.harish.rad@meridian.com",
        "phone": "9840100604",
        "dept_code": "MER-RADL",
        "staff_type": "Interventional Radiologist",
        "experience": 10,
        "salary": 160000,
        "is_doctor_profile": True,
        "qualification": "MBBS, MD, FVIR",
        "specialization": "Radiology"
    },

    # ── 7. Laboratory (5 users) ─────────────────────────────────────────────
    {
        "role": "Laboratory",
        "username": "m.ganesh",
        "first_name": "M.",
        "last_name": "Ganesh",
        "staff_name": "M. Ganesh",
        "email": "m.ganesh@meridian.com",
        "phone": "9840100701",
        "dept_code": "MER-LAB",
        "staff_type": "Senior Lab Technician · Biochemistry",
        "experience": 8,
        "salary": 45000
    },
    {
        "role": "Laboratory",
        "username": "preethi.lab",
        "first_name": "Preethi",
        "last_name": "Sharma",
        "staff_name": "Preethi Sharma",
        "email": "preethi.lab@meridian.com",
        "phone": "9840100702",
        "dept_code": "MER-LAB",
        "staff_type": "Hematology Technologist",
        "experience": 6,
        "salary": 40000
    },
    {
        "role": "Laboratory",
        "username": "saravanan.lab",
        "first_name": "Saravanan",
        "last_name": "Kandasamy",
        "staff_name": "Saravanan Kandasamy",
        "email": "saravanan.lab@meridian.com",
        "phone": "9840100703",
        "dept_code": "MER-LAB",
        "staff_type": "Microbiology Specialist",
        "experience": 7,
        "salary": 42000
    },
    {
        "role": "Laboratory",
        "username": "jayanthi.lab",
        "first_name": "Jayanthi",
        "last_name": "Natarajan",
        "staff_name": "Jayanthi Natarajan",
        "email": "jayanthi.lab@meridian.com",
        "phone": "9840100704",
        "dept_code": "MER-LAB",
        "staff_type": "Quality Control Lab Technologist",
        "experience": 9,
        "salary": 48000
    },
    {
        "role": "Laboratory",
        "username": "vignesh.lab",
        "first_name": "Vigneshwaran",
        "last_name": "Subramanian",
        "staff_name": "Vigneshwaran S.",
        "email": "vignesh.lab@meridian.com",
        "phone": "9840100705",
        "dept_code": "MER-LAB",
        "staff_type": "Phlebotomy & Sample Reception Lead",
        "experience": 5,
        "salary": 38000
    },

    # ── 8. Pathologist (5 users) ────────────────────────────────────────────
    {
        "role": "Pathologist",
        "username": "senthil.nathan",
        "first_name": "Senthil",
        "last_name": "Nathan",
        "staff_name": "Dr. Senthil Nathan",
        "email": "senthil.nathan@meridian.com",
        "phone": "9840100801",
        "dept_code": "MER-PATH",
        "staff_type": "Consultant Pathologist · Histopathology",
        "experience": 14,
        "salary": 145000,
        "is_doctor_profile": True,
        "qualification": "MBBS, MD (Pathology)",
        "specialization": "Pathology"
    },
    {
        "role": "Pathologist",
        "username": "shanthi.devi",
        "first_name": "Shanthi",
        "last_name": "Devi",
        "staff_name": "Dr. Shanthi Devi",
        "email": "shanthi.devi@meridian.com",
        "phone": "9840100802",
        "dept_code": "MER-PATH",
        "staff_type": "Chief Pathologist · Cytopathology",
        "experience": 16,
        "salary": 160000,
        "is_doctor_profile": True,
        "qualification": "MBBS, MD, FRCPath",
        "specialization": "Pathology"
    },
    {
        "role": "Pathologist",
        "username": "dr.arvind.path",
        "first_name": "Arvind",
        "last_name": "Swamy",
        "staff_name": "Dr. Arvind Swamy",
        "email": "dr.arvind.path@meridian.com",
        "phone": "9840100803",
        "dept_code": "MER-PATH",
        "staff_type": "Clinical Pathologist · Molecular Diagnostics",
        "experience": 10,
        "salary": 135000,
        "is_doctor_profile": True,
        "qualification": "MBBS, MD",
        "specialization": "Pathology"
    },
    {
        "role": "Pathologist",
        "username": "dr.mythili.path",
        "first_name": "Mythili",
        "last_name": "Radhakrishnan",
        "staff_name": "Dr. Mythili Radhakrishnan",
        "email": "dr.mythili.path@meridian.com",
        "phone": "9840100804",
        "dept_code": "MER-PATH",
        "staff_type": "Hematopathologist",
        "experience": 12,
        "salary": 140000,
        "is_doctor_profile": True,
        "qualification": "MBBS, MD",
        "specialization": "Pathology"
    },
    {
        "role": "Pathologist",
        "username": "dr.vasanth.path",
        "first_name": "Vasanth",
        "last_name": "Kumar",
        "staff_name": "Dr. Vasanth Kumar",
        "email": "dr.vasanth.path@meridian.com",
        "phone": "9840100805",
        "dept_code": "MER-PATH",
        "staff_type": "Surgical Pathologist",
        "experience": 9,
        "salary": 125000,
        "is_doctor_profile": True,
        "qualification": "MBBS, MD",
        "specialization": "Pathology"
    },

    # ── 9. Pharmacy (5 users) ───────────────────────────────────────────────
    {
        "role": "Pharmacy",
        "username": "s.devi",
        "first_name": "S.",
        "last_name": "Devi",
        "staff_name": "S. Devi",
        "email": "s.devi@meridian.com",
        "phone": "9840100901",
        "dept_code": "MER-PHRM",
        "staff_type": "Chief Pharmacist · Central Pharmacy",
        "experience": 12,
        "salary": 65000
    },
    {
        "role": "Pharmacy",
        "username": "naveen.pharm",
        "first_name": "Naveen",
        "last_name": "Kumar",
        "staff_name": "Naveen Kumar",
        "email": "naveen.pharm@meridian.com",
        "phone": "9840100902",
        "dept_code": "MER-PHRM",
        "staff_type": "Dispensing Pharmacist · Inpatient Pharmacy",
        "experience": 5,
        "salary": 40000
    },
    {
        "role": "Pharmacy",
        "username": "kavitha.pharm",
        "first_name": "Kavitha",
        "last_name": "Subramani",
        "staff_name": "Kavitha Subramani",
        "email": "kavitha.pharm@meridian.com",
        "phone": "9840100903",
        "dept_code": "MER-PHRM",
        "staff_type": "Clinical Pharmacist · ICU Satellite",
        "experience": 7,
        "salary": 48000
    },
    {
        "role": "Pharmacy",
        "username": "suresh.pharm",
        "first_name": "Suresh",
        "last_name": "Gopalan",
        "staff_name": "Suresh Gopalan",
        "email": "suresh.pharm@meridian.com",
        "phone": "9840100904",
        "dept_code": "MER-PHRM",
        "staff_type": "Inventory Pharmacist · OPD Pharmacy",
        "experience": 6,
        "salary": 42000
    },
    {
        "role": "Pharmacy",
        "username": "anjali.pharm",
        "first_name": "Anjali",
        "last_name": "Menon",
        "staff_name": "Anjali Menon",
        "email": "anjali.pharm@meridian.com",
        "phone": "9840100905",
        "dept_code": "MER-PHRM",
        "staff_type": "Compounding & Chemotherapy Pharmacist",
        "experience": 8,
        "salary": 52000
    },

    # ── 10. Store Manager (5 users) ─────────────────────────────────────────
    {
        "role": "Store Manager",
        "username": "a.murugan",
        "first_name": "A.",
        "last_name": "Murugan",
        "staff_name": "A. Murugan",
        "email": "a.murugan@meridian.com",
        "phone": "9840101001",
        "dept_code": "MER-STRS",
        "staff_type": "Central Store Manager",
        "experience": 14,
        "salary": 68000
    },
    {
        "role": "Store Manager",
        "username": "vijay.stores",
        "first_name": "Vijay",
        "last_name": "Anand",
        "staff_name": "Vijay Anand",
        "email": "vijay.stores@meridian.com",
        "phone": "9840101002",
        "dept_code": "MER-STRS",
        "staff_type": "General Stores & Material Supervisor",
        "experience": 8,
        "salary": 45000
    },
    {
        "role": "Store Manager",
        "username": "sathish.stores",
        "first_name": "Sathish",
        "last_name": "Kumar",
        "staff_name": "Sathish Kumar",
        "email": "sathish.stores@meridian.com",
        "phone": "9840101003",
        "dept_code": "MER-STRS",
        "staff_type": "Medical Consumables In-Charge",
        "experience": 6,
        "salary": 40000
    },
    {
        "role": "Store Manager",
        "username": "gayathri.stores",
        "first_name": "Gayathri",
        "last_name": "Sundar",
        "staff_name": "Gayathri Sundar",
        "email": "gayathri.stores@meridian.com",
        "phone": "9840101004",
        "dept_code": "MER-STRS",
        "staff_type": "Surgical Implants & Equipment Stores Officer",
        "experience": 7,
        "salary": 44000
    },
    {
        "role": "Store Manager",
        "username": "prabhakaran.stores",
        "first_name": "Prabhakaran",
        "last_name": "Mani",
        "staff_name": "Prabhakaran M.",
        "email": "prabhakaran.stores@meridian.com",
        "phone": "9840101005",
        "dept_code": "MER-STRS",
        "staff_type": "Receiving & Quarantine Supervisor",
        "experience": 5,
        "salary": 38000
    },

    # ── 11. Procurement Officer (5 users) ───────────────────────────────────
    {
        "role": "Procurement Officer",
        "username": "n.ramesh",
        "first_name": "N.",
        "last_name": "Ramesh",
        "staff_name": "N. Ramesh",
        "email": "n.ramesh@meridian.com",
        "phone": "9840101101",
        "dept_code": "MER-PROC",
        "staff_type": "Procurement Lead · Capital & Medical",
        "experience": 11,
        "salary": 75000
    },
    {
        "role": "Procurement Officer",
        "username": "geetha.rani",
        "first_name": "Geetha",
        "last_name": "Rani",
        "staff_name": "Geetha Rani",
        "email": "geetha.rani@meridian.com",
        "phone": "9840101102",
        "dept_code": "MER-PROC",
        "staff_type": "Senior Purchase Officer · Pharma Supplies",
        "experience": 8,
        "salary": 58000
    },
    {
        "role": "Procurement Officer",
        "username": "rajesh.procure",
        "first_name": "Rajesh",
        "last_name": "Kannan",
        "staff_name": "Rajesh Kannan",
        "email": "rajesh.procure@meridian.com",
        "phone": "9840101103",
        "dept_code": "MER-PROC",
        "staff_type": "Vendor Relations & Contract Officer",
        "experience": 6,
        "salary": 48000
    },
    {
        "role": "Procurement Officer",
        "username": "usha.procure",
        "first_name": "Usha",
        "last_name": "Nandhini",
        "staff_name": "Usha Nandhini",
        "email": "usha.procure@meridian.com",
        "phone": "9840101104",
        "dept_code": "MER-PROC",
        "staff_type": "Tenders & Rate Contracts Officer",
        "experience": 7,
        "salary": 52000
    },
    {
        "role": "Procurement Officer",
        "username": "dinesh.procure",
        "first_name": "Dinesh",
        "last_name": "Babu",
        "staff_name": "Dinesh Babu",
        "email": "dinesh.procure@meridian.com",
        "phone": "9840101105",
        "dept_code": "MER-PROC",
        "staff_type": "Supply Chain Sourcing Specialist",
        "experience": 5,
        "salary": 44000
    },

    # ── 12. HR Manager (5 users) ────────────────────────────────────────────
    {
        "role": "HR Manager",
        "username": "l.revathi",
        "first_name": "L.",
        "last_name": "Revathi",
        "staff_name": "L. Revathi",
        "email": "l.revathi@meridian.com",
        "phone": "9840101201",
        "dept_code": "MER-HR",
        "staff_type": "HR Manager · Operations & Talent",
        "experience": 12,
        "salary": 80000
    },
    {
        "role": "HR Manager",
        "username": "sridhar.hr",
        "first_name": "Sridhar",
        "last_name": "Varadhan",
        "staff_name": "Sridhar Varadhan",
        "email": "sridhar.hr@meridian.com",
        "phone": "9840101202",
        "dept_code": "MER-HR",
        "staff_type": "Payroll & Benefits Specialist",
        "experience": 9,
        "salary": 60000
    },
    {
        "role": "HR Manager",
        "username": "manju.hr",
        "first_name": "Manju",
        "last_name": "Varma",
        "staff_name": "Manju Varma",
        "email": "manju.hr@meridian.com",
        "phone": "9840101203",
        "dept_code": "MER-HR",
        "staff_type": "Clinical Staff Recruiter",
        "experience": 6,
        "salary": 48000
    },
    {
        "role": "HR Manager",
        "username": "karpagam.hr",
        "first_name": "Karpagam",
        "last_name": "Sundaram",
        "staff_name": "Karpagam Sundaram",
        "email": "karpagam.hr@meridian.com",
        "phone": "9840101204",
        "dept_code": "MER-HR",
        "staff_type": "Staff Credentialing & Compliance Lead",
        "experience": 8,
        "salary": 55000
    },
    {
        "role": "HR Manager",
        "username": "karthikeyan.hr",
        "first_name": "Karthikeyan",
        "last_name": "Balaji",
        "staff_name": "Karthikeyan Balaji",
        "email": "karthikeyan.hr@meridian.com",
        "phone": "9840101205",
        "dept_code": "MER-HR",
        "staff_type": "Training & Employee Engagement Lead",
        "experience": 5,
        "salary": 45000
    },

    # ── 13. Canteen Manager (5 users) ───────────────────────────────────────
    {
        "role": "Canteen Manager",
        "username": "p.ganesan",
        "first_name": "P.",
        "last_name": "Ganesan",
        "staff_name": "P. Ganesan",
        "email": "p.ganesan@meridian.com",
        "phone": "9840101301",
        "dept_code": "MER-CANT",
        "staff_type": "Dietary & Canteen Lead",
        "experience": 13,
        "salary": 55000
    },
    {
        "role": "Canteen Manager",
        "username": "latha.murugan",
        "first_name": "Latha",
        "last_name": "Murugan",
        "staff_name": "Latha Murugan",
        "email": "latha.murugan@meridian.com",
        "phone": "9840101302",
        "dept_code": "MER-CANT",
        "staff_type": "Therapeutic Kitchen Supervisor",
        "experience": 8,
        "salary": 42000
    },
    {
        "role": "Canteen Manager",
        "username": "selvam.canteen",
        "first_name": "Selvam",
        "last_name": "Ramasamy",
        "staff_name": "Selvam Ramasamy",
        "email": "selvam.canteen@meridian.com",
        "phone": "9840101303",
        "dept_code": "MER-CANT",
        "staff_type": "Canteen Store & Inventory In-Charge",
        "experience": 6,
        "salary": 38000
    },
    {
        "role": "Canteen Manager",
        "username": "chitra.canteen",
        "first_name": "Chitra",
        "last_name": "Kalyani",
        "staff_name": "Chitra Kalyani",
        "email": "chitra.canteen@meridian.com",
        "phone": "9840101304",
        "dept_code": "MER-CANT",
        "staff_type": "Patient Diet Distribution Coordinator",
        "experience": 5,
        "salary": 34000
    },
    {
        "role": "Canteen Manager",
        "username": "balakrishnan.canteen",
        "first_name": "Balakrishnan",
        "last_name": "Mani",
        "staff_name": "Balakrishnan Mani",
        "email": "balakrishnan.canteen@meridian.com",
        "phone": "9840101305",
        "dept_code": "MER-CANT",
        "staff_type": "F&B Hygiene & Quality Inspector",
        "experience": 9,
        "salary": 45000
    },

    # ── 14. Hospital Management (5 users) ───────────────────────────────────
    {
        "role": "Hospital Management",
        "username": "meera.iyer",
        "first_name": "Meera",
        "last_name": "Iyer",
        "staff_name": "Meera Iyer",
        "email": "meera.iyer@meridian.com",
        "phone": "9840101401",
        "dept_code": "MER-ADMN",
        "staff_type": "Hospital Administrator / COO",
        "experience": 18,
        "salary": 180000
    },
    {
        "role": "Hospital Management",
        "username": "dr.radhakrishnan",
        "first_name": "K.",
        "last_name": "Radhakrishnan",
        "staff_name": "Dr. K. Radhakrishnan",
        "email": "dr.radhakrishnan@meridian.com",
        "phone": "9840101402",
        "dept_code": "MER-ADMN",
        "staff_type": "Medical Superintendent",
        "experience": 22,
        "salary": 220000
    },
    {
        "role": "Hospital Management",
        "username": "jayanthi.ops",
        "first_name": "Jayanthi",
        "last_name": "Sundaram",
        "staff_name": "Jayanthi Sundaram",
        "email": "jayanthi.ops@meridian.com",
        "phone": "9840101403",
        "dept_code": "MER-ADMN",
        "staff_type": "Director of Clinical Operations",
        "experience": 16,
        "salary": 160000
    },
    {
        "role": "Hospital Management",
        "username": "ramanathan.gm",
        "first_name": "V.",
        "last_name": "Ramanathan",
        "staff_name": "V. Ramanathan",
        "email": "ramanathan.gm@meridian.com",
        "phone": "9840101404",
        "dept_code": "MER-ADMN",
        "staff_type": "General Manager · Healthcare Services",
        "experience": 17,
        "salary": 170000
    },
    {
        "role": "Hospital Management",
        "username": "shobhana.ops",
        "first_name": "Shobhana",
        "last_name": "Narayan",
        "staff_name": "Shobhana Narayan",
        "email": "shobhana.ops@meridian.com",
        "phone": "9840101405",
        "dept_code": "MER-ADMN",
        "staff_type": "Director of Patient Experience & Ops",
        "experience": 14,
        "salary": 150000
    },

    # ── 15. AI Administrator (5 users) ──────────────────────────────────────
    {
        "role": "AI Administrator",
        "username": "sanjay.gupta",
        "first_name": "Sanjay",
        "last_name": "Gupta",
        "staff_name": "Dr. Sanjay Gupta",
        "email": "sanjay.gupta@meridian.com",
        "phone": "9840101501",
        "dept_code": "MER-AI",
        "staff_type": "Chief AI Architect",
        "experience": 15,
        "salary": 190000
    },
    {
        "role": "AI Administrator",
        "username": "karthik.rao",
        "first_name": "Karthik",
        "last_name": "Rao",
        "staff_name": "Karthik Rao",
        "email": "karthik.rao@meridian.com",
        "phone": "9840101502",
        "dept_code": "MER-AI",
        "staff_type": "AI Platform & RAG Systems Admin",
        "experience": 8,
        "salary": 120000
    },
    {
        "role": "AI Administrator",
        "username": "ananya.ai",
        "first_name": "Ananya",
        "last_name": "Deshmukh",
        "staff_name": "Ananya Deshmukh",
        "email": "ananya.ai@meridian.com",
        "phone": "9840101503",
        "dept_code": "MER-AI",
        "staff_type": "Clinical NLP & Model Evaluator",
        "experience": 6,
        "salary": 105000
    },
    {
        "role": "AI Administrator",
        "username": "vikram.ai",
        "first_name": "Vikramaditya",
        "last_name": "Chowdhury",
        "staff_name": "Vikramaditya C.",
        "email": "vikram.ai@meridian.com",
        "phone": "9840101504",
        "dept_code": "MER-AI",
        "staff_type": "Hospital AI Systems Integration Specialist",
        "experience": 7,
        "salary": 115000
    },
    {
        "role": "AI Administrator",
        "username": "swetha.ai",
        "first_name": "Swetha",
        "last_name": "Natarajan",
        "staff_name": "Swetha Natarajan",
        "email": "swetha.ai@meridian.com",
        "phone": "9840101505",
        "dept_code": "MER-AI",
        "staff_type": "AI Agent Orchestration & Guardrails Engineer",
        "experience": 5,
        "salary": 98000
    },

    # ── 16. Governance Officer (5 users) ────────────────────────────────────
    {
        "role": "Governance Officer",
        "username": "v.lakshmi",
        "first_name": "V.",
        "last_name": "Lakshmi",
        "staff_name": "V. Lakshmi",
        "email": "v.lakshmi@meridian.com",
        "phone": "9840101601",
        "dept_code": "MER-GOV",
        "staff_type": "Ethics & Compliance Officer",
        "experience": 13,
        "salary": 95000
    },
    {
        "role": "Governance Officer",
        "username": "dr.lakshmi.gov",
        "first_name": "Lakshmi",
        "last_name": "Narayanan",
        "staff_name": "Dr. Lakshmi Narayanan",
        "email": "dr.lakshmi.gov@meridian.com",
        "phone": "9840101602",
        "dept_code": "MER-GOV",
        "staff_type": "Clinical Governance Director",
        "experience": 19,
        "salary": 165000
    },
    {
        "role": "Governance Officer",
        "username": "raghavan.gov",
        "first_name": "S.",
        "last_name": "Raghavan",
        "staff_name": "Advocate S. Raghavan",
        "email": "raghavan.gov@meridian.com",
        "phone": "9840101603",
        "dept_code": "MER-GOV",
        "staff_type": "Legal & Regulatory Compliance Head",
        "experience": 15,
        "salary": 130000
    },
    {
        "role": "Governance Officer",
        "username": "priyadarshini.gov",
        "first_name": "Priyadarshini",
        "last_name": "Muthusamy",
        "staff_name": "Priyadarshini M.",
        "email": "priyadarshini.gov@meridian.com",
        "phone": "9840101604",
        "dept_code": "MER-GOV",
        "staff_type": "NABH / JCI Accreditation Lead",
        "experience": 10,
        "salary": 85000
    },
    {
        "role": "Governance Officer",
        "username": "ashok.gov",
        "first_name": "Ashok",
        "last_name": "Chari",
        "staff_name": "Dr. Ashok Chari",
        "email": "ashok.gov@meridian.com",
        "phone": "9840101605",
        "dept_code": "MER-GOV",
        "staff_type": "Patient Safety & Incident Review Officer",
        "experience": 12,
        "salary": 110000
    },

    # ── 17. IT Administrator (5 users) ──────────────────────────────────────
    {
        "role": "IT Administrator",
        "username": "s.prabhu",
        "first_name": "S.",
        "last_name": "Prabhu",
        "staff_name": "S. Prabhu",
        "email": "s.prabhu@meridian.com",
        "phone": "9840101701",
        "dept_code": "MER-IT",
        "staff_type": "IT Systems Admin",
        "experience": 11,
        "salary": 85000
    },
    {
        "role": "IT Administrator",
        "username": "manoj.it",
        "first_name": "Manoj",
        "last_name": "Kumar",
        "staff_name": "Manoj Kumar",
        "email": "manoj.it@meridian.com",
        "phone": "9840101702",
        "dept_code": "MER-IT",
        "staff_type": "Database & Infrastructure Engineer",
        "experience": 8,
        "salary": 78000
    },
    {
        "role": "IT Administrator",
        "username": "vignesh.it",
        "first_name": "Vignesh",
        "last_name": "Sundar",
        "staff_name": "Vignesh Sundar",
        "email": "vignesh.it@meridian.com",
        "phone": "9840101703",
        "dept_code": "MER-IT",
        "staff_type": "Hospital Information System (HIS) Admin",
        "experience": 7,
        "salary": 72000
    },
    {
        "role": "IT Administrator",
        "username": "divya.it",
        "first_name": "Divya",
        "last_name": "Bharathi",
        "staff_name": "Divya Bharathi",
        "email": "divya.it@meridian.com",
        "phone": "9840101704",
        "dept_code": "MER-IT",
        "staff_type": "Network Security & Access Control Lead",
        "experience": 9,
        "salary": 82000
    },
    {
        "role": "IT Administrator",
        "username": "rajeshwari.it",
        "first_name": "Rajeshwari",
        "last_name": "Parthiban",
        "staff_name": "Rajeshwari P.",
        "email": "rajeshwari.it@meridian.com",
        "phone": "9840101705",
        "dept_code": "MER-IT",
        "staff_type": "HL7 / FHIR Integration Specialist",
        "experience": 6,
        "salary": 68000
    },

    # ── 18. Auditor (5 users) ───────────────────────────────────────────────
    {
        "role": "Auditor",
        "username": "g.balaji",
        "first_name": "G.",
        "last_name": "Balaji",
        "staff_name": "G. Balaji",
        "email": "g.balaji@meridian.com",
        "phone": "9840101801",
        "dept_code": "MER-AUDT",
        "staff_type": "Chief Internal Auditor",
        "experience": 17,
        "salary": 130000
    },
    {
        "role": "Auditor",
        "username": "chandrasekhar.audit",
        "first_name": "S.",
        "last_name": "Chandrasekhar",
        "staff_name": "S. Chandrasekhar",
        "email": "chandrasekhar.audit@meridian.com",
        "phone": "9840101802",
        "dept_code": "MER-AUDT",
        "staff_type": "Clinical & NABH Audit Lead",
        "experience": 12,
        "salary": 92000
    },
    {
        "role": "Auditor",
        "username": "meenakshi.audit",
        "first_name": "Meenakshi",
        "last_name": "Sundaram",
        "staff_name": "Meenakshi Sundaram",
        "email": "meenakshi.audit@meridian.com",
        "phone": "9840101803",
        "dept_code": "MER-AUDT",
        "staff_type": "Financial Forensic & Billing Auditor",
        "experience": 10,
        "salary": 85000
    },
    {
        "role": "Auditor",
        "username": "vasudevan.audit",
        "first_name": "Vasudevan",
        "last_name": "Rangarajan",
        "staff_name": "Vasudevan R.",
        "email": "vasudevan.audit@meridian.com",
        "phone": "9840101804",
        "dept_code": "MER-AUDT",
        "staff_type": "Pharmacy & Store Stock Auditor",
        "experience": 8,
        "salary": 75000
    },
    {
        "role": "Auditor",
        "username": "hemalatha.audit",
        "first_name": "Hemalatha",
        "last_name": "Narayanan",
        "staff_name": "Hemalatha N.",
        "email": "hemalatha.audit@meridian.com",
        "phone": "9840101805",
        "dept_code": "MER-AUDT",
        "staff_type": "Statutory & Compliance Auditor",
        "experience": 9,
        "salary": 80000
    },
]

# Patient Accounts to verify / update credentials
PATIENT_CREDENTIALS = [
    {"username": "patient", "name": "Saanvi Iyer", "patient_code": "MER-PAT-0087227", "phone": "9840012345", "email": "patient.saanvier@meridian.com"},
    {"username": "kavitha.raman", "name": "Kavitha Raman", "patient_code": "MER-PAT-0087228", "phone": "9840012346", "email": "kavitha.raman@meridian.com"},
    {"username": "rajesh.v", "name": "Rajesh Varma", "patient_code": "MER-PAT-0087229", "phone": "9840012347", "email": "rajesh.v@meridian.com"},
    {"username": "anand.n", "name": "Anand Natarajan", "patient_code": "MER-PAT-0087230", "phone": "9840012348", "email": "anand.n@meridian.com"},
    {"username": "divya.n", "name": "Divya Narayanan", "patient_code": "MER-PAT-0087231", "phone": "9840012349", "email": "divya.n@meridian.com"},
]


def execute_seed():
    print("=" * 80)
    print("[+] MERIDIAN HEALTHCARE: MULTI-ROLE USER & CREDENTIAL SEEDER")
    print(f"    Target Default Password: {DEFAULT_PASSWORD}")
    print("=" * 80)

    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # ── Step 1: Ensure All Required Departments Exist ───────────────────
        print("\n[Step 1/5] Ensuring All Functional Departments Exist...")
        dept_id_map = {}
        for code, name, desc, dtype in DEPARTMENTS_DATA:
            cur.execute("""
                SELECT id, department_name FROM departments 
                WHERE department_code = %s OR LOWER(department_name) = LOWER(%s)
                LIMIT 1;
            """, (code, name))
            row = cur.fetchone()
            if row:
                dept_id = row[0]
                dept_id_map[code] = dept_id
            else:
                cur.execute("""
                    INSERT INTO departments (department_code, department_name, description, status, department_type, created_at, updated_at)
                    VALUES (%s, %s, %s, 'ACTIVE', %s, NOW(), NOW())
                    RETURNING id;
                """, (code, name, desc, dtype))
                dept_id = cur.fetchone()[0]
                dept_id_map[code] = dept_id
                print(f"  + Created department: [{code}] {name} (ID: {dept_id})")

        # Also map general fallback departments
        cur.execute("SELECT department_code, id FROM departments;")
        for code, did in cur.fetchall():
            if code and code not in dept_id_map:
                dept_id_map[code] = did

        # ── Step 2: Ensure All Required Roles Exist ─────────────────────────
        print("\n[Step 2/5] Ensuring All 18 Application Roles Exist in 'roles' Table...")
        cur.execute("SELECT id, name FROM roles;")
        role_id_map = {name.strip().lower(): r_id for r_id, name in cur.fetchall()}
        role_display_map = {}

        for role_name, role_desc in ROLES_TO_ENSURE:
            r_key = role_name.strip().lower()
            if r_key in role_id_map:
                r_id = role_id_map[r_key]
                role_display_map[role_name] = r_id
            else:
                cur.execute("""
                    INSERT INTO roles (name, description, created_at, updated_at)
                    VALUES (%s, %s, NOW(), NOW())
                    RETURNING id;
                """, (role_name[:50], role_desc[:50]))
                r_id = cur.fetchone()[0]
                role_id_map[r_key] = r_id
                role_display_map[role_name] = r_id
                print(f"  + Created role: '{role_name}' (ID: {r_id})")

        conn.commit()

        # ── Step 3: Hash Default Password ───────────────────────────────────
        print(f"\n[Step 3/5] Generating Bcrypt Hash for password '{DEFAULT_PASSWORD}'...")
        hashed_pwd = hash_password(DEFAULT_PASSWORD)

        # ── Step 4: Seed 4 to 5 Users for Each Role ─────────────────────────
        print("\n[Step 4/5] Seeding Users for All Roles (Skipping Doctor & Admin)...")
        seeded_users_summary = []

        code_counter = 100
        for u in USERS_TO_SEED:
            role_name = u["role"]
            role_id = role_display_map.get(role_name) or role_id_map.get(role_name.lower())
            if not role_id:
                raise ValueError(f"Could not resolve role_id for role: {role_name}")

            dept_id = dept_id_map.get(u["dept_code"])
            staff_code = f"STF-{u['dept_code'].split('-')[-1]}-{code_counter}"[:50]
            code_counter += 1

            # Check if user already exists
            cur.execute("""
                SELECT id FROM users 
                WHERE LOWER(username) = LOWER(%s) OR LOWER(email) = LOWER(%s)
                LIMIT 1;
            """, (u["username"], u["email"]))
            existing = cur.fetchone()

            if existing:
                user_id = existing[0]
                cur.execute("""
                    UPDATE users 
                    SET role_id = %s,
                        first_name = %s,
                        last_name = %s,
                        staff_name = %s,
                        staff_code = COALESCE(staff_code, %s),
                        staff_type = %s,
                        department_id = %s,
                        phone = %s,
                        is_active = true,
                        password_hash = %s,
                        experience = %s,
                        salary = %s,
                        updated_at = NOW()
                    WHERE id = %s;
                """, (
                    role_id,
                    u["first_name"][:50],
                    u["last_name"][:50],
                    u["staff_name"][:50],
                    staff_code,
                    u["staff_type"][:50],
                    dept_id,
                    u["phone"][:50],
                    hashed_pwd,
                    u.get("experience", 5),
                    u.get("salary", 50000),
                    user_id
                ))
                action_str = "Updated"
            else:
                cur.execute("""
                    INSERT INTO users (
                        username, email, password_hash, role_id, first_name, last_name,
                        phone, is_active, must_change_password, created_at, updated_at,
                        staff_code, staff_name, staff_type, department_id, joining_date,
                        experience, salary
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, true, false, NOW(), NOW(),
                        %s, %s, %s, %s, '2023-01-15',
                        %s, %s
                    )
                    RETURNING id;
                """, (
                    u["username"][:50],
                    u["email"][:255],
                    hashed_pwd,
                    role_id,
                    u["first_name"][:50],
                    u["last_name"][:50],
                    u["phone"][:50],
                    staff_code,
                    u["staff_name"][:50],
                    u["staff_type"][:50],
                    dept_id,
                    u.get("experience", 5),
                    u.get("salary", 50000)
                ))
                user_id = cur.fetchone()[0]
                action_str = "Created"

            # If user has a clinical doctor profile (e.g. Radiologists and Pathologists)
            if u.get("is_doctor_profile"):
                cur.execute("SELECT id FROM doctors WHERE user_id = %s;", (user_id,))
                doc_row = cur.fetchone()
                doc_code = f"DOC-{u['username'].replace('.', '').upper()[:6]}"
                if not doc_row:
                    cur.execute("""
                        INSERT INTO doctors (
                            doctor_code, user_id, department_id, first_name, last_name,
                            display_name, specialization, qualification, experience_years,
                            phone, email, consultation_fee, status, created_at, updated_at, joining_date
                        )
                        VALUES (
                            %s, %s, %s, %s, %s,
                            %s, %s, %s, %s,
                            %s, %s, 750.00, 'ACTIVE', NOW(), NOW(), '2023-01-15'
                        );
                    """, (
                        doc_code,
                        user_id,
                        dept_id,
                        u["first_name"],
                        u["last_name"],
                        u["staff_name"],
                        u.get("specialization", u["role"]),
                        u.get("qualification", "MBBS, MD"),
                        u.get("experience", 10),
                        u["phone"],
                        u["email"]
                    ))

            seeded_users_summary.append({
                "action": action_str,
                "role": role_name,
                "username": u["username"],
                "name": u["staff_name"],
                "dept": u["dept_code"],
                "phone": u["phone"],
                "email": u["email"]
            })

        # ── Step 5: Verify / Ensure Patient Accounts ────────────────────────
        print("\n[Step 5/5] Ensuring 5 Patient Accounts Have Active Status & Standard Password...")
        patient_role_id = role_display_map.get("Patient") or role_id_map.get("patient")
        for p in PATIENT_CREDENTIALS:
            cur.execute("""
                SELECT id FROM users 
                WHERE LOWER(username) = LOWER(%s) OR (patient_id IS NOT NULL AND email = %s)
                LIMIT 1;
            """, (p["username"], p["email"]))
            p_user = cur.fetchone()
            if p_user:
                cur.execute("""
                    UPDATE users 
                    SET password_hash = %s,
                        role_id = %s,
                        is_active = true,
                        updated_at = NOW()
                    WHERE id = %s;
                """, (hashed_pwd, patient_role_id, p_user[0]))
                seeded_users_summary.append({
                    "action": "Updated",
                    "role": "Patient",
                    "username": p["username"],
                    "name": p["name"],
                    "dept": "Patient Portal",
                    "phone": p["phone"],
                    "email": p["email"]
                })

        conn.commit()

        # ── Summary Report ──────────────────────────────────────────────────
        print("\n" + "=" * 105)
        print("[SUCCESS] DATABASE SEEDING COMPLETE! LOGIN CREDENTIALS DIRECTORY")
        print("=" * 105)
        print(f"{'ROLE':<22} | {'USERNAME':<20} | {'PASSWORD':<14} | {'NAME':<24} | {'EMAIL':<30}")
        print("-" * 105)

        for row in sorted(seeded_users_summary, key=lambda x: (x["role"], x["username"])):
            print(f"{row['role']:<22} | {row['username']:<20} | {DEFAULT_PASSWORD:<14} | {row['name'][:24]:<24} | {row['email']:<30}")

        print("=" * 105)
        print(f"Total role users verified/configured: {len(seeded_users_summary)}")
        print(f"All users can log in via username and password: '{DEFAULT_PASSWORD}'")
        print("=" * 105 + "\n")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Error during execution: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    execute_seed()
