#!/usr/bin/env python3
"""
Seed Complete Healthcare Workflow Test Data:
- Inpatient (IP) Insured: Complete hospital + insurance flow, eligible for discharge
- Inpatient (IP) Uninsured: Complete hospital flow without insurance, eligible for discharge
- Inpatient (IP) Ineligible Patients:
    1. Bill not cleared (Outstanding balance)
    2. Missing primary diagnosis
    3. Incomplete clinical info / ICU critical hold / high risk
    4. Missing required vitals
    5. Unstable vital signs (severe hypoxia, tachycardia, fever, severe hypertension)
    6. Pending required investigation / treatment
- Outpatient (OP) Insured: Visit-based consultation, lab, pharmacy, insurance claim, OPD bill
- Outpatient (OP) Uninsured: Visit-based consultation, lab, pharmacy, self-pay OPD bill, not admitted
"""

import sys
import os
import json
import datetime
from decimal import Decimal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import db_config
from db.build_dim_admission_inputs import build_llm_input_text, json_serializer


def seed_workflow_data():
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("=" * 80)
        print("SEEDING COMPLETE HEALTHCARE WORKFLOW TEST DATA")
        print("=" * 80)

        # ---------------------------------------------------------------------
        # 0. Ensure Catalog Master Data (Procedures, etc.)
        # ---------------------------------------------------------------------
        procedures_master = [
            (1, "PRC-001", "Coronary Angiogram & Drug-Eluting Stent (DES) to LAD", 2, Decimal("65000.00"), "Active"),
            (2, "PRC-002", "Laparoscopic Cholecystectomy", 7, Decimal("45000.00"), "Active"),
            (3, "PRC-003", "Nebulization & Respiratory Physiotherapy", 1, Decimal("1500.00"), "Active"),
            (4, "PRC-004", "Digital X-Ray Lumbosacral Spine", 3, Decimal("1200.00"), "Active"),
            (5, "PRC-005", "12-Lead Electrocardiogram (ECG)", 2, Decimal("500.00"), "Active"),
            (6, "PRC-006", "Continuous Telemetry & Hemodynamic Monitoring", 9, Decimal("8000.00"), "Active")
        ]
        for p_id, p_code, p_name, d_id, chg, st in procedures_master:
            cur.execute("""
                INSERT INTO procedures (procedure_id, procedure_code, procedure_name, department_id, standard_charge, status)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (procedure_id) DO UPDATE SET
                    procedure_name = EXCLUDED.procedure_name,
                    standard_charge = EXCLUDED.standard_charge;
            """, (p_id, p_code, p_name, d_id, chg, st))
        print("[OK] Verified procedures master catalog.")

        # ---------------------------------------------------------------------
        # 1. Fetch Safe Starting IDs for All Tables
        # ---------------------------------------------------------------------
        def get_next_id(table, id_col, fallback):
            cur.execute(f"SELECT COALESCE(MAX({id_col}), {fallback}) FROM {table};")
            return cur.fetchone()[0] + 1

        next_pat_id = max(get_next_id("patients", "id", 142857), 142901)
        next_apt_id = max(get_next_id("appointments", "id", 1000672), 1000701)
        next_visit_id = max(get_next_id("patient_visits", "visit_id", 277120), 277201)
        next_adm_id = max(get_next_id("admissions", "admission_id", 87432), 87501)
        next_diag_id = max(get_next_id("diagnoses", "diagnosis_id", 277100), 277201)
        next_vital_id = max(get_next_id("vital_signs", "vital_id", 277128), 277201)
        next_lab_order_id = max(get_next_id("lab_orders", "lab_order_id", 277100), 277201)
        next_lab_result_id = max(get_next_id("lab_results", "lab_result_id", 277100), 277201)
        next_rx_id = max(get_next_id("prescriptions", "prescription_id", 277100), 277201)
        next_rx_item_id = max(get_next_id("prescription_items", "prescription_item_id", 277100), 277201)
        next_sale_id = max(get_next_id("pharmacy_sales", "sale_id", 277100), 277201)
        next_sale_item_id = max(get_next_id("pharmacy_sale_items", "sale_item_id", 277100), 277201)
        next_bill_id = max(get_next_id("bills", "bill_id", 277100), 277201)
        next_bill_item_id = max(get_next_id("bill_items", "bill_item_id", 364532), 364601)
        next_pay_id = max(get_next_id("payments", "id", 638), 701)
        next_ins_id = max(get_next_id("patient_insurance", "insurance_id", 95000), 95101)
        next_claim_id = max(get_next_id("insurance_claims", "claim_id", 45150), 45201)
        next_claim_item_id = max(get_next_id("insurance_claim_items", "claim_item_id", 45150), 45201)
        next_bed_assign_id = max(get_next_id("bed_assignments", "assignment_id", 87432), 87501)
        next_proc_order_id = max(get_next_id("patient_procedures", "patient_procedure_id", 100), 201)

        # ---------------------------------------------------------------------
        # 2. Define 10 Distinct Patient Profiles
        # ---------------------------------------------------------------------
        # Doctors reference:
        # Dr. Priya Patel: ID 1, Cardiology (dept 2)
        # Dr. Ravi Reddy: ID 2, Orthopedics (dept 3)
        # Dr. Suresh Menon: ID 6, Surgery (dept 7)
        # Dr. Rahul Kumar: ID 8, Intensive Care (dept 9)
        # Dr. Arun Kumar: ID 1005, General Medicine (dept 1)

        test_patients_definitions = [
            # 1. IP INSURED (Discharge Eligible)
            {
                "key": "IP_INS_01",
                "first_name": "Rajesh",
                "last_name": "Venkataraman",
                "gender": "Male",
                "dob": "1974-05-12",
                "blood_group": "B+",
                "phone": "+91 98401 55101",
                "email": "rajesh.venkataraman@example.com",
                "is_inpatient": True,
                "has_insurance": True,
                "insurance_provider": "Star Health Insurance",
                "policy_number": "POL-STAR-8812",
                "coverage_limit": Decimal("500000.00"),
                "doctor_id": 1,
                "dept_id": 2,
                "doctor_name": "Dr. Priya Patel",
                "specialization": "Cardiologist",
                "qualification": "MBBS, MD, DM (Cardiology)",
                "ward_id": 4,
                "ward_name": "Coronary Care CCU",
                "room_number": "RM-042",
                "bed_id": 74,
                "bed_number": "BED-0074",
                "reason_admission": "Acute severe crushing retrosternal chest pain with diaphoresis",
                "primary_diagnosis": "Acute Myocardial Infarction",
                "diag_code": "I21.0",
                "secondary_diagnoses": ["Essential Hypertension", "Hyperlipidemia"],
                "sec_diag_codes": ["I10", "E78.5"],
                "procedure_name": "Coronary Angiogram & Drug-Eluting Stent (DES) to LAD",
                "procedure_id": 1,
                "clinical_notes": "Patient successfully underwent Emergency Primary PCI with DES to mid-LAD artery. Hemodynamics completely stabilized, telemetry sinus rhythm, no recurrent angina. Cardiac biomarkers normalized. Tolerating oral diet and ambulating comfortably.",
                "risk_score": 0.32,
                "bill_net": Decimal("125000.00"),
                "bill_status": "Settled",
                "bill_clearance_status": "Settled",
                "outstanding_balance": Decimal("0.00"),
                "claimed_amount": Decimal("125000.00"),
                "approved_amount": Decimal("125000.00"),
                "claim_status": "Approved",
                "vitals": {"temp": 98.4, "hr": 72, "sbp": 120, "dbp": 80, "spo2": 98.5, "rr": 16, "wt": 74.5},
                "discharge_status": "Ready",
                "medications": [
                    {"name": "Tab. Aspirin", "generic": "Aspirin", "dosage": "150mg", "freq": "OD", "route": "Oral", "dur": "30 Days", "med_id": 1},
                    {"name": "Tab. Clopidogrel", "generic": "Clopidogrel", "dosage": "75mg", "freq": "OD", "route": "Oral", "dur": "30 Days", "med_id": 3},
                    {"name": "Tab. Atorvastatin", "generic": "Atorvastatin", "dosage": "40mg", "freq": "HS", "route": "Oral", "dur": "30 Days", "med_id": 1},
                    {"name": "Tab. Metoprolol Tartrate", "generic": "Metoprolol", "dosage": "25mg", "freq": "OD", "route": "Oral", "dur": "30 Days", "med_id": 2}
                ]
            },

            # 2. IP UNINSURED (Discharge Eligible - Without Insurance)
            {
                "key": "IP_SELF_01",
                "first_name": "Ananya",
                "last_name": "Sundaram",
                "gender": "Female",
                "dob": "1988-08-20",
                "blood_group": "A+",
                "phone": "+91 98401 55102",
                "email": "ananya.sundaram@example.com",
                "is_inpatient": True,
                "has_insurance": False,  # Completely uninsured
                "doctor_id": 1005,
                "dept_id": 1,
                "doctor_name": "Dr. Arun Kumar",
                "specialization": "General Medicine",
                "qualification": "MBBS, MD (Medicine)",
                "ward_id": 3,
                "ward_name": "Emerald Semi-Private",
                "room_number": "RM-028",
                "bed_id": 75,
                "bed_number": "BED-0075",
                "reason_admission": "Severe breathlessness and wheezing, acute asthma flare",
                "primary_diagnosis": "Acute Asthma Exacerbation",
                "diag_code": "J45.901",
                "secondary_diagnoses": ["Allergic Rhinitis"],
                "sec_diag_codes": ["J30.9"],
                "procedure_name": "Nebulization & Respiratory Physiotherapy",
                "procedure_id": 3,
                "clinical_notes": "Bronchospasm successfully resolved with bronchodilator nebulization and systemic steroids. Peak flow improved from 180 L/min to 420 L/min. Tolerating room air comfortably with clear chest on auscultation.",
                "risk_score": 0.25,
                "bill_net": Decimal("38500.00"),
                "bill_status": "Settled",
                "bill_clearance_status": "Settled",
                "outstanding_balance": Decimal("0.00"),
                "vitals": {"temp": 98.6, "hr": 76, "sbp": 118, "dbp": 76, "spo2": 99.0, "rr": 18, "wt": 58.0},
                "discharge_status": "Ready",
                "medications": [
                    {"name": "Inj. Ceftriaxone Sodium", "generic": "Ceftriaxone", "dosage": "1g", "freq": "BD", "route": "IV", "dur": "3 Days", "med_id": 10},
                    {"name": "Inj. Tramadol HCl", "generic": "Tramadol", "dosage": "50mg", "freq": "SOS", "route": "IV", "dur": "2 Days", "med_id": 23}
                ]
            },

            # 3. IP INELIGIBLE 1: BILL NOT CLEARED (Gate 1 Failure)
            {
                "key": "IP_INEL_BILL",
                "first_name": "Suresh",
                "last_name": "Ramanathan",
                "gender": "Male",
                "dob": "1980-03-14",
                "blood_group": "O+",
                "phone": "+91 98401 55103",
                "email": "suresh.ramanathan@example.com",
                "is_inpatient": True,
                "has_insurance": False,
                "doctor_id": 6,
                "dept_id": 7,
                "doctor_name": "Dr. Suresh Menon",
                "specialization": "Surgeon",
                "qualification": "MBBS, MS, FRCS",
                "ward_id": 7,
                "ward_name": "General Multi-Specialty Ward",
                "room_number": "RM-015",
                "bed_id": 76,
                "bed_number": "BED-0076",
                "reason_admission": "Acute right upper quadrant colic pain and cholecystitis",
                "primary_diagnosis": "Calculus of Gallbladder with Cholecystitis",
                "diag_code": "K80.0",
                "secondary_diagnoses": [],
                "sec_diag_codes": [],
                "procedure_name": "Laparoscopic Cholecystectomy",
                "procedure_id": 2,
                "clinical_notes": "Elective laparoscopic cholecystectomy performed. Port sites healing well, tolerating oral diet.",
                "risk_score": 0.35,
                "bill_net": Decimal("85000.00"),
                "bill_status": "Pending",
                "bill_clearance_status": "Pending",
                "outstanding_balance": Decimal("85000.00"),  # Unpaid bill!
                "vitals": {"temp": 98.6, "hr": 74, "sbp": 122, "dbp": 80, "spo2": 98.0, "rr": 16, "wt": 71.0},
                "discharge_status": "Admitted",
                "medications": [
                    {"name": "Tab. Cefixime", "generic": "Cefixime", "dosage": "200mg", "freq": "BD", "route": "Oral", "dur": "5 Days", "med_id": 15},
                    {"name": "Tab. Paracetamol", "generic": "Paracetamol", "dosage": "650mg", "freq": "TDS", "route": "Oral", "dur": "3 Days", "med_id": 24}
                ]
            },

            # 4. IP INELIGIBLE 2: MISSING DIAGNOSIS (Gate 2 Failure)
            {
                "key": "IP_INEL_DIAG",
                "first_name": "Malini",
                "last_name": "Chandran",
                "gender": "Female",
                "dob": "1985-11-04",
                "blood_group": "AB+",
                "phone": "+91 98401 55104",
                "email": "malini.chandran@example.com",
                "is_inpatient": True,
                "has_insurance": False,
                "doctor_id": 1005,
                "dept_id": 1,
                "doctor_name": "Dr. Arun Kumar",
                "specialization": "General Medicine",
                "qualification": "MBBS, MD (Medicine)",
                "ward_id": 3,
                "ward_name": "Emerald Semi-Private",
                "room_number": "RM-029",
                "bed_id": 77,
                "bed_number": "BED-0077",
                "reason_admission": "General lethargy and evaluation",
                "primary_diagnosis": None,  # Missing diagnosis!
                "diag_code": None,
                "secondary_diagnoses": [],
                "sec_diag_codes": [],
                "clinical_notes": "Patient admitted for clinical diagnostic workup. Awaiting definitive diagnosis from attending consultant.",
                "risk_score": 0.40,
                "bill_net": Decimal("22000.00"),
                "bill_status": "Settled",
                "bill_clearance_status": "Settled",
                "outstanding_balance": Decimal("0.00"),
                "vitals": {"temp": 98.4, "hr": 72, "sbp": 116, "dbp": 74, "spo2": 99.0, "rr": 16, "wt": 62.0},
                "discharge_status": "Admitted",
                "medications": []
            },

            # 5. IP INELIGIBLE 3: INCOMPLETE CLINICAL INFO / CRITICAL ICU HOLD (Gate 3 Failure)
            {
                "key": "IP_INEL_CLIN",
                "first_name": "Vikramaditya",
                "last_name": "Verma",
                "gender": "Male",
                "dob": "1962-09-19",
                "blood_group": "O-",
                "phone": "+91 98401 55105",
                "email": "vikramaditya.verma@example.com",
                "is_inpatient": True,
                "has_insurance": False,
                "doctor_id": 8,
                "dept_id": 9,
                "doctor_name": "Dr. Rahul Kumar",
                "specialization": "Intensivist",
                "qualification": "MBBS, MD, EDIC",
                "ward_id": 5,
                "ward_name": "Medical Intensive Care MICU",
                "room_number": "RM-008",
                "bed_id": 78,
                "bed_number": "BED-0078",
                "reason_admission": "Septic shock with multi-organ involvement",
                "primary_diagnosis": "Severe Sepsis with Septic Shock",
                "diag_code": "A41.9",
                "secondary_diagnoses": ["Acute Kidney Injury"],
                "sec_diag_codes": ["N17.9"],
                "clinical_notes": "Active septic shock, ICU hold in effect, continuous norepinephrine infusion, unstable hemodynamics.",
                "risk_score": 0.95,  # High risk score > 0.88 + ICU hold keyword
                "bill_net": Decimal("145000.00"),
                "bill_status": "Settled",
                "bill_clearance_status": "Settled",
                "outstanding_balance": Decimal("0.00"),
                "vitals": {"temp": 101.4, "hr": 118, "sbp": 85, "dbp": 48, "spo2": 91.0, "rr": 26, "wt": 68.0},
                "discharge_status": "Admitted",
                "medications": [
                    {"name": "Inj. Noradrenaline", "generic": "Noradrenaline", "dosage": "4mg in 50ml", "freq": "Continuous", "route": "IV Infusion", "dur": "Active", "med_id": 17},
                    {"name": "Inj. Meropenem", "generic": "Meropenem", "dosage": "1g", "freq": "TDS", "route": "IV", "dur": "7 Days", "med_id": 9}
                ]
            },

            # 6. IP INELIGIBLE 4: MISSING REQUIRED VITALS (Gate 4 Failure)
            {
                "key": "IP_INEL_VITALS_MISS",
                "first_name": "Geetha",
                "last_name": "Rangarajan",
                "gender": "Female",
                "dob": "1971-12-08",
                "blood_group": "B+",
                "phone": "+91 98401 55106",
                "email": "geetha.rangarajan@example.com",
                "is_inpatient": True,
                "has_insurance": False,
                "doctor_id": 1005,
                "dept_id": 1,
                "doctor_name": "Dr. Arun Kumar",
                "specialization": "General Medicine",
                "qualification": "MBBS, MD (Medicine)",
                "ward_id": 3,
                "ward_name": "Emerald Semi-Private",
                "room_number": "RM-030",
                "bed_id": 79,
                "bed_number": "BED-0079",
                "reason_admission": "Type-2 diabetes uncontrolled hyperglycemia",
                "primary_diagnosis": "Type 2 Diabetes Mellitus with Ketoacidosis",
                "diag_code": "E11.65",
                "secondary_diagnoses": [],
                "sec_diag_codes": [],
                "clinical_notes": "Patient condition improving under diabetic insulin management.",
                "risk_score": 0.45,
                "bill_net": Decimal("32000.00"),
                "bill_status": "Settled",
                "bill_clearance_status": "Settled",
                "outstanding_balance": Decimal("0.00"),
                "vitals": None,  # No vitals recorded!
                "discharge_status": "Admitted",
                "medications": [
                    {"name": "Tab. Telmisartan", "generic": "Telmisartan", "dosage": "40mg", "freq": "OD", "route": "Oral", "dur": "30 Days", "med_id": 8}
                ]
            },

            # 7. IP INELIGIBLE 5: UNSTABLE VITALS (Gate 4 Failure)
            {
                "key": "IP_INEL_VITALS_UNST",
                "first_name": "Balaji",
                "last_name": "Krishnaswamy",
                "gender": "Male",
                "dob": "1967-07-25",
                "blood_group": "AB-",
                "phone": "+91 98401 55107",
                "email": "balaji.krishnaswamy@example.com",
                "is_inpatient": True,
                "has_insurance": False,
                "doctor_id": 1005,
                "dept_id": 1,
                "doctor_name": "Dr. Arun Kumar",
                "specialization": "General Medicine",
                "qualification": "MBBS, MD (Medicine)",
                "ward_id": 7,
                "ward_name": "General Multi-Specialty Ward",
                "room_number": "RM-016",
                "bed_id": 80,
                "bed_number": "BED-0080",
                "reason_admission": "Acute Exacerbation of COPD with severe respiratory distress",
                "primary_diagnosis": "Acute Exacerbation of COPD",
                "diag_code": "J44.1",
                "secondary_diagnoses": [],
                "sec_diag_codes": [],
                "clinical_notes": "Patient experiencing severe tachypnea and respiratory distress.",
                "risk_score": 0.65,
                "bill_net": Decimal("42000.00"),
                "bill_status": "Settled",
                "bill_clearance_status": "Settled",
                "outstanding_balance": Decimal("0.00"),
                # Severe abnormal vitals: SpO2 < 92%, HR > 110, Temp >= 100.4, SBP > 160
                "vitals": {"temp": 103.2, "hr": 132, "sbp": 182, "dbp": 108, "spo2": 84.5, "rr": 32, "wt": 65.0},
                "discharge_status": "Admitted",
                "medications": [
                    {"name": "Inj. Ceftriaxone Sodium", "generic": "Ceftriaxone", "dosage": "1g", "freq": "BD", "route": "IV", "dur": "5 Days", "med_id": 10}
                ]
            },

            # 8. IP INELIGIBLE 6: REQUIRED INVESTIGATION / CRITICAL ACTION PENDING
            {
                "key": "IP_INEL_PENDING",
                "first_name": "Shalini",
                "last_name": "Venugopal",
                "gender": "Female",
                "dob": "1992-04-18",
                "blood_group": "O+",
                "phone": "+91 98401 55108",
                "email": "shalini.venugopal@example.com",
                "is_inpatient": True,
                "has_insurance": False,
                "doctor_id": 6,
                "dept_id": 7,
                "doctor_name": "Dr. Suresh Menon",
                "specialization": "Surgeon",
                "qualification": "MBBS, MS, FRCS",
                "ward_id": 6,
                "ward_name": "Surgical Intensive Care SICU",
                "room_number": "RM-011",
                "bed_id": 81,
                "bed_number": "BED-0081",
                "reason_admission": "Acute abdomen, emergency surgery hold pending CT",
                "primary_diagnosis": "Suspected Mesenteric Ischemia under workup",
                "diag_code": "K55.0",
                "secondary_diagnoses": [],
                "sec_diag_codes": [],
                "clinical_notes": "Patient undergoing critical emergency evaluation. Awaiting urgent CT angiography of mesenteric vessels; emergency surgery hold in effect.",
                "risk_score": 0.89,  # High risk + emergency surgery keyword
                "bill_net": Decimal("65000.00"),
                "bill_status": "Settled",
                "bill_clearance_status": "Settled",
                "outstanding_balance": Decimal("0.00"),
                "vitals": {"temp": 99.8, "hr": 105, "sbp": 102, "dbp": 65, "spo2": 95.0, "rr": 22, "wt": 54.0},
                "discharge_status": "Admitted",
                "medications": []
            },

            # 9. OP PATIENT WITH INSURANCE
            {
                "key": "OP_INS_01",
                "first_name": "Meenakshi",
                "last_name": "Natarajan",
                "gender": "Female",
                "dob": "1984-03-15",
                "blood_group": "A+",
                "phone": "+91 98401 55109",
                "email": "meenakshi.natarajan@example.com",
                "is_inpatient": False,  # OUTPATIENT
                "has_insurance": True,
                "insurance_provider": "HDFC ERGO Health Insurance",
                "policy_number": "POL-HDFC-9921",
                "coverage_limit": Decimal("200000.00"),
                "doctor_id": 1,
                "dept_id": 2,
                "doctor_name": "Dr. Priya Patel",
                "specialization": "Cardiologist",
                "qualification": "MBBS, MD, DM (Cardiology)",
                "reason_visit": "Hypertension periodic review and recurrent palpitations",
                "primary_diagnosis": "Essential (Primary) Hypertension",
                "diag_code": "I10",
                "secondary_diagnoses": [],
                "sec_diag_codes": [],
                "procedure_name": "12-Lead Electrocardiogram (ECG)",
                "procedure_id": 5,
                "clinical_notes": "Outpatient consultation. Blood pressure controlled on dual antihypertensive therapy. No chest pain or dyspnea.",
                "bill_gross": Decimal("2250.00"),
                "bill_insurance": Decimal("1800.00"),
                "bill_patient": Decimal("450.00"),
                "bill_net": Decimal("2250.00"),
                "claimed_amount": Decimal("1800.00"),
                "approved_amount": Decimal("1800.00"),
                "claim_status": "Approved",
                "vitals": {"temp": 98.4, "hr": 74, "sbp": 126, "dbp": 82, "spo2": 99.0, "rr": 16, "wt": 63.0},
                "medications": [
                    {"name": "Tab. Telmisartan", "generic": "Telmisartan", "dosage": "40mg", "freq": "OD", "route": "Oral", "dur": "30 Days", "med_id": 8}
                ]
            },

            # 10. OP PATIENT WITHOUT INSURANCE
            {
                "key": "OP_SELF_01",
                "first_name": "Karthikeyan",
                "last_name": "Subramaniam",
                "gender": "Male",
                "dob": "1990-11-28",
                "blood_group": "O+",
                "phone": "+91 98401 55110",
                "email": "karthikeyan.subramaniam@example.com",
                "is_inpatient": False,  # OUTPATIENT
                "has_insurance": False,  # Uninsured
                "doctor_id": 2,
                "dept_id": 3,
                "doctor_name": "Dr. Ravi Reddy",
                "specialization": "Orthopedist",
                "qualification": "MBBS, MS (Ortho)",
                "reason_visit": "Lower back pain radiating to left thigh after gym workout",
                "primary_diagnosis": "Lumbar Spondylosis with Muscle Spasm",
                "diag_code": "M47.816",
                "secondary_diagnoses": [],
                "sec_diag_codes": [],
                "procedure_name": "Digital X-Ray Lumbosacral Spine",
                "procedure_id": 4,
                "clinical_notes": "Outpatient consultation. Mild lumbar paravertebral tenderness, SLR negative bilaterally. Advised physical therapy and core strengthening.",
                "bill_gross": Decimal("2620.00"),
                "bill_insurance": Decimal("0.00"),
                "bill_patient": Decimal("2620.00"),
                "bill_net": Decimal("2620.00"),
                "vitals": {"temp": 98.6, "hr": 72, "sbp": 118, "dbp": 78, "spo2": 99.5, "rr": 16, "wt": 76.0},
                "medications": [
                    {"name": "Tab. Paracetamol", "generic": "Paracetamol", "dosage": "650mg", "freq": "BD", "route": "Oral", "dur": "5 Days", "med_id": 24}
                ]
            }
        ]

        inserted_summary = []

        # ---------------------------------------------------------------------
        # 3. Insert Records for Each Test Patient
        # ---------------------------------------------------------------------
        for p in test_patients_definitions:
            pid = next_pat_id; next_pat_id += 1
            apt_id = next_apt_id; next_apt_id += 1
            vid = next_visit_id; next_visit_id += 1
            pat_code = f"MER-PAT-{pid:07d}"
            booking_id = f"BK-TEST-{apt_id % 10000:04d}"
            now_dt = datetime.datetime.now()
            today_str = now_dt.strftime("%Y-%m-%d")

            # A. Insert into patients
            cur.execute("""
                INSERT INTO patients (
                    id, patient_code, first_name, last_name, date_of_birth, gender,
                    phone, whatsapp_number, email, address, city, state, pincode,
                    blood_group, status, preferred_language, registration_date, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, 'Chennai', 'Tamil Nadu', '600006',
                    %s, 'Active', 'English', %s, %s
                ) ON CONFLICT (id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    gender = EXCLUDED.gender;
            """, (
                pid, pat_code, p["first_name"], p["last_name"], p["dob"], p["gender"],
                p["phone"], p["phone"], p["email"], "100 Hospital Boulevard",
                p["blood_group"], now_dt, now_dt
            ))

            # B. Insert into appointments
            apt_type = "INPATIENT" if p["is_inpatient"] else "OPD"
            apt_status = "CONFIRMED" if p["is_inpatient"] else "COMPLETED"
            complaint = str(p.get("reason_admission") or p.get("reason_visit") or "Clinical Care")[:50]
            cur.execute("""
                INSERT INTO appointments (
                    id, booking_id, patient_id, doctor_id, department_id,
                    appointment_date, appointment_time, status, booking_source,
                    appointment_type, reason_for_visit, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, '09:00:00', %s, 'OPD_DESK',
                    %s, %s, %s
                ) ON CONFLICT (id) DO NOTHING;
            """, (
                apt_id, booking_id, pid, p["doctor_id"], p["dept_id"],
                today_str, apt_status, apt_type, complaint, now_dt
            ))

            # C. Insert into patient_visits
            visit_type = "IPD" if p["is_inpatient"] else "OPD"
            visit_status = "Admitted" if p["is_inpatient"] else "Completed"
            cur.execute("""
                INSERT INTO patient_visits (
                    visit_id, patient_id, doctor_id, department_id,
                    appointment_id, visit_date, visit_type, chief_complaint, visit_status
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s
                ) ON CONFLICT (visit_id) DO NOTHING;
            """, (
                vid, pid, p["doctor_id"], p["dept_id"],
                apt_id, now_dt, visit_type, complaint, visit_status
            ))

            # D. If Inpatient, Insert into admissions and bed_assignments
            aid = None
            adm_number = None
            if p["is_inpatient"]:
                aid = next_adm_id; next_adm_id += 1
                adm_number = f"MER-ADM-{aid:07d}"
                adm_reason = str(p.get("reason_admission") or "Inpatient Management")[:50]
                cur.execute("""
                    INSERT INTO admissions (
                        admission_id, admission_number, patient_id, visit_id,
                        doctor_id, department_id, ward_id, bed_id,
                        admission_date, admission_type, admission_source,
                        reason_for_admission, discharge_status
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        %s, 'Inpatient', 'OPD Referral',
                        %s, %s
                    ) ON CONFLICT (admission_id) DO NOTHING;
                """, (
                    aid, adm_number, pid, vid,
                    p["doctor_id"], p["dept_id"], p["ward_id"], p["bed_id"],
                    now_dt - datetime.timedelta(days=3), adm_reason, p["discharge_status"]
                ))

                # Bed Assignment
                cur.execute("""
                    INSERT INTO bed_assignments (
                        assignment_id, bed_id, patient_id, admission_id,
                        assigned_date, assignment_status
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, 'Active'
                    ) ON CONFLICT (assignment_id) DO NOTHING;
                """, (
                    next_bed_assign_id, p["bed_id"], pid, aid,
                    now_dt - datetime.timedelta(days=3)
                ))
                next_bed_assign_id += 1

            # E. Insurance Record (Only for insured patients)
            ins_id = None
            if p["has_insurance"]:
                ins_id = next_ins_id; next_ins_id += 1
                cur.execute("""
                    INSERT INTO patient_insurance (
                        insurance_id, patient_id, insurance_provider, policy_number,
                        policy_type, coverage_start_date, coverage_end_date,
                        coverage_limit, status
                    ) VALUES (
                        %s, %s, %s, %s,
                        'Comprehensive', CURRENT_DATE - 180, CURRENT_DATE + 185,
                        %s, 'Active'
                    ) ON CONFLICT (insurance_id) DO NOTHING;
                """, (
                    ins_id, pid, p["insurance_provider"], p["policy_number"],
                    p["coverage_limit"]
                ))

            # F. Diagnoses
            if p.get("primary_diagnosis"):
                diag_id = next_diag_id; next_diag_id += 1
                cur.execute("""
                    INSERT INTO diagnoses (
                        diagnosis_id, patient_id, visit_id, admission_id,
                        doctor_id, diagnosis_code, diagnosis_name, diagnosis_type,
                        diagnosis_date, is_primary
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, 'Primary',
                        %s, TRUE
                    ) ON CONFLICT (diagnosis_id) DO NOTHING;
                """, (
                    diag_id, pid, vid, aid,
                    p["doctor_id"], p["diag_code"], p["primary_diagnosis"],
                    now_dt - datetime.timedelta(days=2)
                ))

                for s_idx, sec_name in enumerate(p.get("secondary_diagnoses", [])):
                    sec_diag_id = next_diag_id; next_diag_id += 1
                    sec_code = p["sec_diag_codes"][s_idx] if s_idx < len(p["sec_diag_codes"]) else "R69"
                    cur.execute("""
                        INSERT INTO diagnoses (
                            diagnosis_id, patient_id, visit_id, admission_id,
                            doctor_id, diagnosis_code, diagnosis_name, diagnosis_type,
                            diagnosis_date, is_primary
                        ) VALUES (
                            %s, %s, %s, %s,
                            %s, %s, %s, 'Secondary',
                            %s, FALSE
                        ) ON CONFLICT (diagnosis_id) DO NOTHING;
                    """, (
                        sec_diag_id, pid, vid, aid,
                        p["doctor_id"], sec_code, sec_name,
                        now_dt - datetime.timedelta(days=2)
                    ))

            # G. Vital Signs
            if p.get("vitals"):
                v = p["vitals"]
                vital_id = next_vital_id; next_vital_id += 1
                cur.execute("""
                    INSERT INTO vital_signs (
                        vital_id, patient_id, visit_id, admission_id,
                        recorded_by, recorded_at, temperature, heart_rate,
                        systolic_bp, diastolic_bp, respiratory_rate, oxygen_saturation, weight
                    ) VALUES (
                        %s, %s, %s, %s,
                        1, %s, %s, %s,
                        %s, %s, %s, %s, %s
                    ) ON CONFLICT (vital_id) DO NOTHING;
                """, (
                    vital_id, pid, vid, aid,
                    now_dt - datetime.timedelta(hours=2),
                    v["temp"], v["hr"], v["sbp"], v["dbp"], v["rr"], v["spo2"], v.get("wt", 70.0)
                ))

            # H. Procedures
            if p.get("procedure_name") and p.get("procedure_id"):
                proc_order_id = next_proc_order_id; next_proc_order_id += 1
                cur.execute("""
                    INSERT INTO patient_procedures (
                        patient_procedure_id, patient_id, visit_id, admission_id,
                        procedure_id, doctor_id, procedure_date, quantity, charge, status, notes
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, 1, %s, 'Completed', %s
                    ) ON CONFLICT (patient_procedure_id) DO NOTHING;
                """, (
                    proc_order_id, pid, vid, aid,
                    p["procedure_id"], p["doctor_id"], now_dt - datetime.timedelta(days=1),
                    Decimal("15000.00") if p["is_inpatient"] else Decimal("1200.00"),
                    f"Procedure successfully performed by {p['doctor_name']}"
                ))

            # I. Lab Orders & Lab Results
            lab_order_id = next_lab_order_id; next_lab_order_id += 1
            cur.execute("""
                INSERT INTO lab_orders (
                    lab_order_id, patient_id, doctor_id, visit_id, admission_id,
                    lab_test_id, ordered_date, priority, status
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    1, %s, 'Routine', 'Completed'
                ) ON CONFLICT (lab_order_id) DO NOTHING;
            """, (
                lab_order_id, pid, p["doctor_id"], vid, aid,
                now_dt - datetime.timedelta(days=1)
            ))

            lab_res_id = next_lab_result_id; next_lab_result_id += 1
            cur.execute("""
                INSERT INTO lab_results (
                    lab_result_id, lab_order_id, patient_id, test_parameter,
                    result_value, unit, reference_range, abnormal_flag,
                    verification_status, result_date, verified_by
                ) VALUES (
                    %s, %s, %s, 'Hemoglobin (Hb)',
                    '13.5', 'g/dL', '12.0 - 16.0', FALSE,
                    'Verified', %s, 9
                ) ON CONFLICT (lab_result_id) DO NOTHING;
            """, (
                lab_res_id, lab_order_id, pid, now_dt - datetime.timedelta(hours=12)
            ))

            # J. Prescriptions & Prescription Items
            rx_id = next_rx_id; next_rx_id += 1
            cur.execute("""
                INSERT INTO prescriptions (
                    prescription_id, patient_id, doctor_id, visit_id, admission_id,
                    prescription_date, status
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, 'Active'
                ) ON CONFLICT (prescription_id) DO NOTHING;
            """, (
                rx_id, pid, p["doctor_id"], vid, aid,
                now_dt - datetime.timedelta(days=1)
            ))

            for med in p.get("medications", []):
                rx_item_id = next_rx_item_id; next_rx_item_id += 1
                cur.execute("""
                    INSERT INTO prescription_items (
                        prescription_item_id, prescription_id, medication_id,
                        dosage, frequency, route, duration, quantity, instructions
                    ) VALUES (
                        %s, %s, %s,
                        %s, %s, %s, %s, 10, 'Take as directed by physician'
                    ) ON CONFLICT (prescription_item_id) DO NOTHING;
                """, (
                    rx_item_id, rx_id, med["med_id"],
                    med["dosage"], med["freq"], med["route"], med["dur"]
                ))

            # K. Pharmacy Sales
            sale_id = next_sale_id; next_sale_id += 1
            pharmacy_total = Decimal("1250.00") if p.get("medications") else Decimal("0.00")
            cur.execute("""
                INSERT INTO pharmacy_sales (
                    sale_id, patient_id, visit_id, admission_id, prescription_id,
                    sale_date, total_amount, discount_amount, tax_amount, net_amount, payment_status
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, 0.00, 0.00, %s, 'Paid'
                ) ON CONFLICT (sale_id) DO NOTHING;
            """, (
                sale_id, pid, vid, aid, rx_id,
                now_dt - datetime.timedelta(hours=6), pharmacy_total, pharmacy_total
            ))

            if p.get("medications"):
                sale_item_id = next_sale_item_id; next_sale_item_id += 1
                cur.execute("""
                    INSERT INTO pharmacy_sale_items (
                        sale_item_id, sale_id, medication_id, inventory_id,
                        quantity, unit_price, discount_amount, tax_amount, net_amount
                    ) VALUES (
                        %s, %s, %s, 1,
                        10, 18.50, 0.00, 0.00, %s
                    ) ON CONFLICT (sale_item_id) DO NOTHING;
                """, (
                    sale_item_id, sale_id, p["medications"][0]["med_id"], pharmacy_total
                ))

            # L. Bills & Bill Items
            bill_id = next_bill_id; next_bill_id += 1
            bill_number = f"MER-BIL-{(aid or vid):07d}"
            bill_net = p.get("bill_net") or Decimal("2500.00")
            bill_ins = p.get("bill_insurance", bill_net if p["has_insurance"] else Decimal("0.00"))
            bill_pat = p.get("bill_patient", Decimal("0.00") if p["has_insurance"] else bill_net)
            bill_status = p.get("bill_status", "Settled")

            cur.execute("""
                INSERT INTO bills (
                    bill_id, bill_number, patient_id, visit_id, admission_id,
                    bill_date, gross_amount, discount_amount, tax_amount,
                    net_amount, insurance_amount, patient_amount, bill_status
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, 0.00, 0.00,
                    %s, %s, %s, %s
                ) ON CONFLICT (bill_id) DO NOTHING;
            """, (
                bill_id, bill_number, pid, vid, aid,
                now_dt - datetime.timedelta(days=1), bill_net,
                bill_net, bill_ins, bill_pat, bill_status
            ))

            # Bill Item (Hospital Services)
            bill_item_id = next_bill_item_id; next_bill_item_id += 1
            cur.execute("""
                INSERT INTO bill_items (
                    bill_item_id, bill_id, billing_service_id, department_id,
                    doctor_id, service_date, description, quantity,
                    unit_price, gross_amount, discount_amount, tax_amount, net_amount
                ) VALUES (
                    %s, %s, 1, %s,
                    %s, %s, 'Hospital Medical & Clinical Care Package', 1,
                    %s, %s, 0.00, 0.00, %s
                ) ON CONFLICT (bill_item_id) DO NOTHING;
            """, (
                bill_item_id, bill_id, p["dept_id"],
                p["doctor_id"], today_str,
                bill_net, bill_net, bill_net
            ))

            # M. Payments (Only if bill is Settled)
            if bill_status == "Settled":
                pay_id = next_pay_id; next_pay_id += 1
                payer_type = "INSURANCE" if (p["has_insurance"] and bill_ins > 0) else "PATIENT"
                pay_method = "TPA_SETTLEMENT" if payer_type == "INSURANCE" else "UPI"
                cur.execute("""
                    INSERT INTO payments (
                        id, bill_id, patient_id, amount, payment_method,
                        payment_status, payer_type, payment_reference,
                        transaction_reference, payment_date, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        'SUCCESS', %s, %s,
                        %s, %s, %s, %s
                    ) ON CONFLICT (id) DO NOTHING;
                """, (
                    pay_id, bill_id, pid, bill_net, pay_method,
                    payer_type, f"REF-PAY-{pay_id}",
                    f"TXN-2026-{pay_id:06d}", now_dt, now_dt, now_dt
                ))

            # N. Insurance Claims (Only for insured patients)
            if p["has_insurance"] and p.get("claimed_amount"):
                claim_id = next_claim_id; next_claim_id += 1
                claim_number = f"MER-CLM-{(aid or vid):07d}"
                cur.execute("""
                    INSERT INTO insurance_claims (
                        claim_id, claim_number, patient_id, bill_id,
                        insurance_provider, policy_number, claim_date,
                        claimed_amount, approved_amount, rejected_amount,
                        settled_amount, outstanding_amount, claim_status, settlement_date
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, CURRENT_DATE - 1,
                        %s, %s, 0.00,
                        %s, 0.00, %s, CURRENT_DATE
                    ) ON CONFLICT (claim_id) DO NOTHING;
                """, (
                    claim_id, claim_number, pid, bill_id,
                    p["insurance_provider"], p["policy_number"],
                    p["claimed_amount"], p["approved_amount"],
                    p["approved_amount"], p.get("claim_status", "Approved")
                ))

                # Claim item
                claim_item_id = next_claim_item_id; next_claim_item_id += 1
                cur.execute("""
                    INSERT INTO insurance_claim_items (
                        claim_item_id, claim_id, bill_item_id, claimed_amount, approved_amount, rejected_amount
                    ) VALUES (
                        %s, %s, %s, %s, %s, 0.00
                    ) ON CONFLICT (claim_item_id) DO NOTHING;
                """, (
                    claim_item_id, claim_id, bill_item_id,
                    p["claimed_amount"], p["approved_amount"]
                ))

            # O. Populate dim_admission_inputs (ONLY for Inpatient patients)
            if p["is_inpatient"]:
                v = p.get("vitals") or {}
                temp_val = v.get("temp")
                hr_val = v.get("hr")
                sbp_val = v.get("sbp")
                dbp_val = v.get("dbp")
                spo2_val = v.get("spo2")

                # Build LLM input json
                llm_dict = {
                    "patient_demographics": {
                        "first_name": p["first_name"],
                        "last_name": p["last_name"],
                        "gender": p["gender"],
                        "age_at_admission": 2026 - int(p["dob"].split("-")[0]),
                        "blood_group": p["blood_group"],
                        "date_of_birth": p["dob"],
                        "marital_status": "Married",
                        "preferred_language": "English",
                        "phone": p["phone"],
                        "email": p["email"],
                        "address": "100 Hospital Boulevard",
                        "city": "Chennai",
                        "state": "Tamil Nadu",
                        "postal_code": "600006",
                        "emergency_contact_name": "Family Member",
                        "emergency_contact_phone": p["phone"]
                    },
                    "admission_details": {
                        "admission_number": adm_number,
                        "admission_date": (now_dt - datetime.timedelta(days=3)).isoformat(),
                        "admission_type": "Inpatient",
                        "admission_source": "OPD Referral",
                        "reason_for_admission": p["reason_admission"],
                        "discharge_status": p["discharge_status"],
                        "current_stay_days": 3,
                        "attending_doctor": p["doctor_name"],
                        "doctor_specialization": p["specialization"],
                        "doctor_qualification": p["qualification"]
                    },
                    "diagnoses": {
                        "primary_diagnosis": p.get("primary_diagnosis") or "",
                        "secondary_diagnoses": p.get("secondary_diagnoses", []),
                        "diagnoses_list": [
                            {
                                "admission_id": aid,
                                "diagnosis_code": p.get("diag_code") or "R69",
                                "diagnosis_name": p.get("primary_diagnosis") or "",
                                "diagnosis_type": "Primary",
                                "is_primary": True
                            }
                        ] if p.get("primary_diagnosis") else []
                    },
                    "medications": {
                        "medications_list": [
                            {
                                "admission_id": aid,
                                "medication_name": m["name"],
                                "generic_name": m["generic"],
                                "dosage": m["dosage"],
                                "frequency": m["freq"],
                                "route": m["route"],
                                "duration": m["dur"],
                                "instructions": "Take as directed by consultant"
                            } for m in p.get("medications", [])
                        ]
                    },
                    "lab_results": {
                        "lab_results_list": [
                            {
                                "admission_id": aid,
                                "test_parameter": "Hemoglobin (Hb)",
                                "result_value": "13.5",
                                "unit": "g/dL",
                                "reference_range": "12.0 - 16.0",
                                "verification_status": "Verified"
                            }
                        ]
                    },
                    "procedures": {
                        "procedures_list": [
                            {"procedure_name": p.get("procedure_name")}
                        ] if p.get("procedure_name") else []
                    },
                    "vital_signs": {
                        "latest_temperature": temp_val,
                        "latest_heart_rate": hr_val,
                        "latest_systolic_bp": sbp_val,
                        "latest_diastolic_bp": dbp_val,
                        "latest_oxygen_saturation": spo2_val,
                        "vital_signs_list": [
                            {
                                "temperature": temp_val,
                                "heart_rate": hr_val,
                                "systolic_bp": sbp_val,
                                "diastolic_bp": dbp_val,
                                "oxygen_saturation": spo2_val
                            }
                        ] if temp_val is not None else []
                    },
                    "billing": {
                        "bill_number": bill_number,
                        "bill_net_amount": float(p.get("bill_net", 0.0)),
                        "bill_status": p.get("bill_status", "Pending"),
                        "bill_clearance_status": p.get("bill_clearance_status", "Pending"),
                        "outstanding_balance": float(p.get("outstanding_balance", 0.0))
                    },
                    "insurance": {
                        "has_insurance": p["has_insurance"],
                        "provider": p.get("insurance_provider"),
                        "policy_number": p.get("policy_number")
                    }
                }

                llm_prompt_text = build_llm_input_text(llm_dict)
                llm_json_str = json.dumps(llm_dict, default=json_serializer)
                sec_diag_str = ", ".join(p.get("secondary_diagnoses", []))

                cur.execute("""
                    INSERT INTO dim_admission_inputs (
                        admission_id, admission_number, patient_id, patient_number, first_name, last_name, gender,
                        age_at_admission, blood_group, date_of_birth, marital_status, preferred_language, phone, email,
                        address, city, state, postal_code, emergency_contact_name, emergency_contact_phone, admission_date,
                        admission_type, admission_source, reason_for_admission, discharge_status, current_stay_days,
                        attending_doctor, doctor_specialization, doctor_qualification, primary_diagnosis, secondary_diagnoses,
                        latest_temperature, latest_heart_rate, latest_systolic_bp, latest_diastolic_bp, latest_oxygen_saturation,
                        bill_number, bill_net_amount, bill_status, bill_clearance_status, outstanding_balance,
                        llm_input, llm_input_json, gold_ingestion_time, bed_number, room_number, ward_name
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, 'Married', 'English', %s, %s,
                        '100 Hospital Boulevard', 'Chennai', 'Tamil Nadu', '600006', 'Family Member', %s, %s,
                        'Inpatient', 'OPD Referral', %s, %s, 3,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s
                    ) ON CONFLICT (admission_id) DO UPDATE SET
                        discharge_status = EXCLUDED.discharge_status,
                        bill_status = EXCLUDED.bill_status,
                        bill_clearance_status = EXCLUDED.bill_clearance_status,
                        outstanding_balance = EXCLUDED.outstanding_balance,
                        primary_diagnosis = EXCLUDED.primary_diagnosis,
                        latest_temperature = EXCLUDED.latest_temperature,
                        latest_heart_rate = EXCLUDED.latest_heart_rate,
                        latest_systolic_bp = EXCLUDED.latest_systolic_bp,
                        latest_diastolic_bp = EXCLUDED.latest_diastolic_bp,
                        latest_oxygen_saturation = EXCLUDED.latest_oxygen_saturation,
                        llm_input = EXCLUDED.llm_input,
                        llm_input_json = EXCLUDED.llm_input_json;
                """, (
                    aid, adm_number, pid, pat_code, p["first_name"][:50], p["last_name"][:50], p["gender"][:50],
                    2026 - int(p["dob"].split("-")[0]), p["blood_group"][:10], p["dob"], p["phone"][:50], p["email"][:50],
                    p["phone"][:50], now_dt - datetime.timedelta(days=3),
                    str(p.get("reason_admission") or "Inpatient Care")[:50], p["discharge_status"][:50],
                    p["doctor_name"][:50], p["specialization"][:50], p["qualification"][:50],
                    str(p.get("primary_diagnosis") or "")[:250] if p.get("primary_diagnosis") else None, sec_diag_str[:50],
                    temp_val, hr_val, sbp_val, dbp_val, spo2_val,
                    bill_number[:50], p.get("bill_net", 0.0), p.get("bill_status", "Pending")[:50],
                    p.get("bill_clearance_status", "Pending")[:50], p.get("outstanding_balance", 0.0),
                    llm_prompt_text, llm_json_str, now_dt,
                    str(p.get("bed_number") or "")[:50], str(p.get("room_number") or "")[:50], str(p.get("ward_name") or "")[:250]
                ))

            inserted_summary.append({
                "key": p["key"],
                "patient_id": pid,
                "patient_code": pat_code,
                "name": f"{p['first_name']} {p['last_name']}",
                "type": "Inpatient" if p["is_inpatient"] else "Outpatient",
                "admission_id": aid,
                "visit_id": vid,
                "has_insurance": p["has_insurance"],
                "bill_status": p.get("bill_status"),
                "expected_eligibility": p["key"] in ("IP_INS_01", "IP_SELF_01")
            })

            print(f"[OK] Added [{p['key']}] Patient #{pid} ({p['first_name']} {p['last_name']}) - {'IP' if p['is_inpatient'] else 'OP'} | Insurance: {p['has_insurance']}")

        conn.commit()
        print("\n" + "=" * 80)
        print("ALL 10 TEST PATIENTS SUCCESSFULLY COMMITTED TO POSTGRESQL!")
        print("=" * 80)
        for s in inserted_summary:
            print(f"[{s['key']}] PID={s['patient_id']} ({s['patient_code']}) | Name: {s['name']} | Type: {s['type']} | Ins: {s['has_insurance']} | Eligible: {s['expected_eligibility']}")

        return inserted_summary

    except Exception as e:
        conn.rollback()
        print(f"ERROR Seeding test data: {e}")
        raise e
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed_workflow_data()
