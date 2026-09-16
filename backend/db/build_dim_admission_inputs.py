"""
PostgreSQL ETL Pipeline: Converts Databricks Notebook `01_bronze.py` into a standalone PostgreSQL ETL service.
Reads denormalized clinical tables from PostgreSQL and builds `dim_admission_inputs` with all 44 fields,
including hierarchical `llm_input_json` and structured `llm_input` discharge prompt.
"""

import os
import sys
import json
import math
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path

# Ensure backend root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from db.postgres_connector import PostgresConnector
import psycopg2.extras


def json_serializer(obj):
    """JSON serializer for dates, datetimes, and decimals."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    return str(obj)


def build_llm_input_text(d: dict) -> str:
    """Builds the clinical LLM input prompt text matching Databricks `01_bronze.py`."""
    pd_ = d.get("patient_demographics") or {}
    ad = d.get("admission_details") or {}
    dx = d.get("diagnoses") or {}
    meds = d.get("medications") or {}
    labs = d.get("lab_results") or {}
    procs = d.get("procedures") or {}
    vs = d.get("vital_signs") or {}
    bill = d.get("billing") or {}

    is_admitted = ad.get("discharge_status") == "Admitted"
    intro = (
        "You are a medical AI assistant. Below is the clinical data for a currently admitted patient. "
        "Use this to prepare for discharge summary generation when the patient is discharged."
        if is_admitted else
        "You are a medical AI assistant. Below is the clinical data for a discharged patient. "
        "Use this to generate a comprehensive discharge summary."
    )

    sections = [intro, "=" * 80]

    # 1. Patient Demographics
    lines = ["--- PATIENT DEMOGRAPHICS ---"]
    lines.append(f"Name: {pd_.get('first_name','')} {pd_.get('last_name','')}")
    lines.append(f"Gender:, {pd_.get('gender','')}, | Age:, {pd_.get('age_at_admission','')}, years")
    lines.append(f"Blood Group:, {pd_.get('blood_group','')}, | DOB:, {pd_.get('date_of_birth','')}")
    lines.append(f"Marital Status:, {pd_.get('marital_status','')}, | Language:, {pd_.get('preferred_language','')}")
    lines.append(f"Phone: {pd_.get('phone','')} | Email: {pd_.get('email','')}")
    lines.append(f"Address:, {pd_.get('address','')}, {pd_.get('city','')}, {pd_.get('state','')}, {pd_.get('postal_code','')}")
    lines.append(f"Emergency Contact: {pd_.get('emergency_contact_name','')} {pd_.get('emergency_contact_phone','')}")
    sections.append("\n".join(lines))

    # 2. Admission Details
    header = "--- ADMISSION DETAILS (CURRENTLY ADMITTED) ---" if is_admitted else "--- ADMISSION DETAILS (DISCHARGED) ---"
    lines = [header]
    lines.append(f"Admission Number: {ad.get('admission_number','')}")
    adm_date = ad.get('admission_date', '')
    if adm_date:
        adm_date = str(adm_date).replace('T', ' ')[:19]
    lines.append(f"Admission Date:, {adm_date}")
    lines.append(f"Admission Type:, {ad.get('admission_type','')}, | Source:, {ad.get('admission_source','')}")
    lines.append(f"Reason for Admission: {ad.get('reason_for_admission','')}")
    lines.append(f"Status:, {ad.get('discharge_status','')}, | Current Stay:, {ad.get('current_stay_days','')}, days")
    lines.append(f"Attending Doctor:, {ad.get('attending_doctor','')}, | Specialization:, {ad.get('doctor_specialization','')}")
    lines.append(f"Doctor Qualification: {ad.get('doctor_qualification','')}")
    sections.append("\n".join(lines))

    # 3. Diagnoses
    lines = ["--- DIAGNOSES ---"]
    lines.append(f"Primary Diagnosis:, {dx.get('primary_diagnosis','')}")
    sec_dx = dx.get('secondary_diagnoses') or []
    if sec_dx:
        lines.append(f"Secondary Diagnoses:, {', '.join(str(s) for s in sec_dx)}")
    else:
        lines.append("Secondary Diagnoses:, ")
    lines.append("All Diagnoses:")
    for diag in (dx.get('diagnoses_list') or []):
        prim_label = "PRIMARY" if diag.get('is_primary') else "SECONDARY"
        lines.append(f"{diag.get('diagnosis_code','')} | {diag.get('diagnosis_name','')} | {diag.get('diagnosis_type','')} | {prim_label}")
    sections.append("\n".join(lines))

    # 4. Medications
    lines = ["--- MEDICATIONS ---"]
    for med in (meds.get('medications_list') or []):
        lines.append(
            f"{med.get('medication_name','')} | {med.get('generic_name','')} | {med.get('dosage','')} | "
            f"{med.get('frequency','')} | {med.get('route','')} | {med.get('duration','')} | {med.get('instructions','')}"
        )
    sections.append("\n".join(lines))

    # 5. Lab Results
    lines = ["--- LAB RESULTS ---"]
    for lr in (labs.get('lab_results_list') or []):
        abn = " (Abnormal)" if lr.get('abnormal_flag') else ""
        lines.append(
            f"{lr.get('test_parameter','')}: {lr.get('result_value','')} {lr.get('unit','')} "
            f"(Ref: {lr.get('reference_range','')}){abn} | {lr.get('verification_status','')}"
        )
    sections.append("\n".join(lines))

    # 6. Procedures
    lines = ["--- PROCEDURES ---"]
    for proc in (procs.get('procedures_list') or []):
        proc_date = proc.get('procedure_date', '')
        if proc_date:
            proc_date = str(proc_date).replace('T', ' ')[:19]
        lines.append(f"{proc.get('procedure_code','')} | {proc.get('procedure_name','')} | {proc_date} | {proc.get('status','')} | {proc.get('notes','')}")
    sections.append("\n".join(lines))

    # 7. Vital Signs
    lines = ["--- VITAL SIGNS ---"]
    lt = vs.get('latest_temperature')
    lh = vs.get('latest_heart_rate')
    ls = vs.get('latest_systolic_bp')
    ld = vs.get('latest_diastolic_bp')
    lo = vs.get('latest_oxygen_saturation')
    lines.append(f"Latest Vitals:, Temp:{lt}F, HR:{lh}bpm, {ls}/{ld}/mmHg, SpO2:{lo}%")
    lines.append("All Vital Sign Records:")
    for v in (vs.get('vital_signs_list') or []):
        rec_at = v.get('recorded_at', '')
        if rec_at:
            rec_at = str(rec_at).replace('T', ' ')[:19]
        lines.append(
            f"{rec_at} | Temp:{v.get('temperature','')}F | HR:{v.get('heart_rate','')}bpm | "
            f"{v.get('systolic_bp','')}/{v.get('diastolic_bp','')} | RR:{v.get('respiratory_rate','')}/min | "
            f"SpO2:{v.get('oxygen_saturation','')}% | Wt:{v.get('weight','')}kg"
        )
    sections.append("\n".join(lines))

    # 8. Billing Summary
    lines = ["--- BILLING SUMMARY ---"]
    bill_date = bill.get('bill_date', '')
    if bill_date:
        bill_date = str(bill_date).replace('T', ' ')[:19]
    lines.append(f"Bill Number:, {bill.get('bill_number','')}, | Bill Date:, {bill_date}")
    lines.append(f"Gross Amount:, {bill.get('bill_gross_amount','')}, | Net Amount:, {bill.get('bill_net_amount','')}")
    lines.append(f"Discount:, {bill.get('bill_discount_amount','')}, | Tax:, {bill.get('bill_tax_amount','')}")
    lines.append(f"Insurance Portion:, {bill.get('bill_insurance_portion','')}, | Patient Portion:, {bill.get('bill_patient_portion','')}")
    lines.append(f"Bill Status:, {bill.get('bill_status','')}, | Clearance:, {bill.get('bill_clearance_status','')}")
    lines.append(f"Total Paid:, {bill.get('total_paid_amount','')}, | Outstanding:, {bill.get('outstanding_balance','')}")
    lines.append(f"Insurance Settled:, {bill.get('total_insurance_settled','')}, | Payment Count:, {bill.get('payment_count','')}")
    sections.append("\n".join(lines))

    sections.append("=" * 80)
    sections.append(
        "Based on the above information, generate a structured discharge summary including: "
        "Diagnoses, Case History, Investigations, Treatment Given, Primary Consultant, "
        "Discharge Advice, Surgery Details (if any), and Patient Condition at Discharge."
    )

    return "\n\n".join(sections)


def create_target_table(cur):
    """Creates the target table `dim_admission_inputs` with all 44 columns if it doesn't exist."""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS dim_admission_inputs (
            admission_id BIGINT PRIMARY KEY,
            admission_number VARCHAR(100),
            patient_id BIGINT,
            patient_number VARCHAR(100),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            gender VARCHAR(20),
            age_at_admission INTEGER,
            blood_group VARCHAR(10),
            date_of_birth DATE,
            marital_status VARCHAR(50),
            preferred_language VARCHAR(50),
            phone VARCHAR(50),
            email VARCHAR(100),
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(100),
            postal_code VARCHAR(50),
            emergency_contact_name VARCHAR(100),
            emergency_contact_phone VARCHAR(50),
            admission_date TIMESTAMP WITHOUT TIME ZONE,
            admission_type VARCHAR(50),
            admission_source VARCHAR(100),
            reason_for_admission TEXT,
            discharge_status VARCHAR(50),
            current_stay_days INTEGER,
            attending_doctor VARCHAR(150),
            doctor_specialization VARCHAR(100),
            doctor_qualification VARCHAR(100),
            primary_diagnosis VARCHAR(255),
            secondary_diagnoses JSONB,
            latest_temperature NUMERIC(5,2),
            latest_heart_rate INTEGER,
            latest_systolic_bp INTEGER,
            latest_diastolic_bp INTEGER,
            latest_oxygen_saturation NUMERIC(5,2),
            bill_number VARCHAR(100),
            bill_net_amount NUMERIC(18,2),
            bill_status VARCHAR(50),
            bill_clearance_status VARCHAR(50),
            outstanding_balance NUMERIC(18,2),
            llm_input TEXT,
            llm_input_json JSONB,
            gold_ingestion_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_dim_adm_in_patient ON dim_admission_inputs (patient_id);
        CREATE INDEX IF NOT EXISTS idx_dim_adm_in_status ON dim_admission_inputs (discharge_status);
        CREATE INDEX IF NOT EXISTS idx_dim_adm_in_number ON dim_admission_inputs (admission_number);
    """)


def run_pipeline(admitted_only=True):
    """Executes the pipeline to build and populate `dim_admission_inputs`."""
    print("=" * 70)
    print("Starting PostgreSQL Ingestion Pipeline: dim_admission_inputs")
    print(f"Filter mode: {'Admitted patients only' if admitted_only else 'All admissions'}")
    print("=" * 70)

    connector = PostgresConnector()
    conn = connector.get_connection()
    cur = connector.get_dict_cursor(conn)

    # 1. Ensure target table exists
    create_target_table(cur)
    conn.commit()

    # 2. Read admissions, patients, doctors
    status_clause = "WHERE a.discharge_status = 'Admitted'" if admitted_only else ""
    cur.execute(f"""
        SELECT 
            a.admission_id,
            a.admission_number,
            a.patient_id,
            p.patient_code AS patient_number,
            p.first_name,
            p.last_name,
            p.gender,
            p.date_of_birth,
            p.blood_group,
            p.marital_status,
            p.preferred_language,
            p.phone,
            p.email,
            p.address,
            p.city,
            p.state,
            p.pincode AS postal_code,
            p.emergency_contact_name,
            p.emergency_contact_phone,
            a.admission_date,
            a.admission_type,
            a.admission_source,
            a.reason_for_admission,
            a.discharge_date,
            a.discharge_status,
            d.display_name AS doctor_display_name,
            d.first_name AS doc_first_name,
            d.last_name AS doc_last_name,
            d.specialization AS doctor_specialization,
            d.qualification AS doctor_qualification
        FROM admissions a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        {status_clause}
        ORDER BY a.admission_id;
    """)
    admissions = cur.fetchall()
    total_count = len(admissions)
    print(f"Loaded {total_count:,} target admissions.")

    if not admissions:
        print("No admissions found to process.")
        conn.close()
        return

    adm_ids = [r['admission_id'] for r in admissions]

    # 3. Read diagnoses
    print("Loading diagnoses...")
    cur.execute("""
        SELECT admission_id, diagnosis_code, diagnosis_name, diagnosis_type, diagnosis_date, is_primary
        FROM diagnoses
        WHERE admission_id = ANY(%s)
        ORDER BY admission_id, diagnosis_date ASC;
    """, (adm_ids,))
    dx_by_adm = {}
    for r in cur.fetchall():
        dx_by_adm.setdefault(r['admission_id'], []).append(r)

    # 4. Read vital signs
    print("Loading vital signs...")
    cur.execute("""
        SELECT admission_id, recorded_at, temperature, heart_rate, systolic_bp, diastolic_bp,
               respiratory_rate, oxygen_saturation, weight
        FROM vital_signs
        WHERE admission_id = ANY(%s)
        ORDER BY admission_id, recorded_at DESC;
    """, (adm_ids,))
    vs_by_adm = {}
    for r in cur.fetchall():
        vs_by_adm.setdefault(r['admission_id'], []).append(r)

    # 5. Read bills, payments, insurance
    print("Loading bills and payment records...")
    cur.execute("""
        SELECT bill_id, admission_id, bill_number, bill_date, gross_amount, discount_amount,
               tax_amount, net_amount, insurance_amount, patient_amount, bill_status
        FROM bills
        WHERE admission_id = ANY(%s)
        ORDER BY admission_id, bill_date DESC;
    """, (adm_ids,))
    bills_by_adm = {}
    bill_ids = []
    for r in cur.fetchall():
        aid = r['admission_id']
        if aid not in bills_by_adm:
            bills_by_adm[aid] = r  # Pick latest bill
            bill_ids.append(r['bill_id'])

    # Payments & insurance aggregates
    payments_by_bill = {}
    if bill_ids:
        cur.execute("""
            SELECT bill_id, SUM(amount) AS total_paid, COUNT(*) AS p_count
            FROM payments
            WHERE bill_id = ANY(%s)
            GROUP BY bill_id;
        """, (bill_ids,))
        for r in cur.fetchall():
            payments_by_bill[r['bill_id']] = r

    insurance_by_bill = {}
    if bill_ids:
        cur.execute("""
            SELECT bill_id, SUM(settled_amount) AS total_settled
            FROM insurance_claims
            WHERE bill_id = ANY(%s)
            GROUP BY bill_id;
        """, (bill_ids,))
        for r in cur.fetchall():
            insurance_by_bill[r['bill_id']] = r

    # 6. Read prescriptions & items
    print("Loading medications & prescriptions...")
    cur.execute("""
        SELECT pr.admission_id, pr.prescription_id, pr.prescription_date,
               pi.dosage, pi.frequency, pi.route, pi.duration, pi.instructions,
               m.medication_name, m.generic_name, m.category AS medication_category
        FROM prescriptions pr
        LEFT JOIN prescription_items pi ON pr.prescription_id = pi.prescription_id
        LEFT JOIN medications m ON pi.medication_id = m.medication_id
        WHERE pr.admission_id = ANY(%s)
        ORDER BY pr.admission_id, pr.prescription_date ASC;
    """, (adm_ids,))
    meds_by_adm = {}
    for r in cur.fetchall():
        meds_by_adm.setdefault(r['admission_id'], []).append(r)

    # 7. Read lab orders & results
    print("Loading lab investigations...")
    cur.execute("""
        SELECT lo.admission_id, lo.lab_order_id,
               lr.test_parameter, lr.result_value, lr.unit, lr.reference_range,
               lr.abnormal_flag, lr.verification_status, lr.result_date
        FROM lab_orders lo
        LEFT JOIN lab_results lr ON lo.lab_order_id = lr.lab_order_id
        WHERE lo.admission_id = ANY(%s)
        ORDER BY lo.admission_id, lr.result_date ASC;
    """, (adm_ids,))
    labs_by_adm = {}
    for r in cur.fetchall():
        labs_by_adm.setdefault(r['admission_id'], []).append(r)

    # 8. Read procedures
    print("Loading surgical procedures...")
    cur.execute("""
        SELECT pp.admission_id, pp.procedure_date, pp.quantity, pp.charge, pp.status, pp.notes,
               p.procedure_code, p.procedure_name
        FROM patient_procedures pp
        LEFT JOIN procedures p ON pp.procedure_id = p.procedure_id
        WHERE pp.admission_id = ANY(%s)
        ORDER BY pp.admission_id, pp.procedure_date ASC;
    """, (adm_ids,))
    procs_by_adm = {}
    for r in cur.fetchall():
        procs_by_adm.setdefault(r['admission_id'], []).append(r)

    # 9. Transform and construct all 44 columns
    print("Synthesizing clinical entities, llm_input_json, and llm_input prompts...")
    today = date.today()
    rows_to_insert = []

    for a in admissions:
        aid = a['admission_id']

        # Age calculation
        dob = a.get('date_of_birth')
        adm_date = a.get('admission_date')
        if dob and adm_date:
            adm_dt = adm_date.date() if isinstance(adm_date, datetime) else adm_date
            age_at_admission = math.floor((adm_dt - dob).days / 365.25)
        else:
            age_at_admission = None

        # Current stay days
        dis_date = a.get('discharge_date')
        if dis_date and adm_date:
            adm_dt = adm_date.date() if isinstance(adm_date, datetime) else adm_date
            dis_dt = dis_date.date() if isinstance(dis_date, datetime) else dis_date
            current_stay_days = (dis_dt - adm_dt).days
        elif adm_date:
            adm_dt = adm_date.date() if isinstance(adm_date, datetime) else adm_date
            current_stay_days = (today - adm_dt).days
        else:
            current_stay_days = 0

        # Attending doctor formatting
        doc_disp = a.get('doctor_display_name') or f"{a.get('doc_first_name','') or ''} {a.get('doc_last_name','') or ''}".strip()
        if doc_disp:
            attending_doctor = doc_disp if doc_disp.startswith("Dr.") else f"Dr. {doc_disp}"
        else:
            attending_doctor = None

        # Diagnoses aggregation
        all_dx = dx_by_adm.get(aid, [])
        primary_dx = None
        secondary_dx_list = []
        for d in all_dx:
            if d.get('is_primary'):
                primary_dx = d.get('diagnosis_name')
            else:
                dname = d.get('diagnosis_name')
                if dname and dname not in secondary_dx_list:
                    secondary_dx_list.append(dname)
        if not primary_dx and all_dx:
            primary_dx = all_dx[0].get('diagnosis_name')

        # Vital signs
        all_vs = vs_by_adm.get(aid, [])
        latest_vs = all_vs[0] if all_vs else {}

        # Billing
        bill = bills_by_adm.get(aid, {})
        bid = bill.get('bill_id')
        pay_info = payments_by_bill.get(bid, {})
        ins_info = insurance_by_bill.get(bid, {})

        total_paid_amount = pay_info.get('total_paid') or Decimal(0)
        payment_count = pay_info.get('p_count') or 0
        total_insurance_settled = ins_info.get('total_settled') or Decimal(0)

        bill_net_amount = bill.get('net_amount') or Decimal(0)
        outstanding_balance = bill_net_amount - total_paid_amount

        bstatus = bill.get('bill_status')
        if bstatus == 'Settled':
            bill_clearance_status = 'Settled'
        elif bstatus == 'Partially Paid':
            bill_clearance_status = 'Partial Payment'
        elif bstatus == 'Pending':
            bill_clearance_status = 'Pending'
        else:
            bill_clearance_status = bstatus or 'Pending'

        # Medications, Labs, Procedures
        meds_list = meds_by_adm.get(aid, [])
        labs_list = labs_by_adm.get(aid, [])
        procs_list = procs_by_adm.get(aid, [])

        # Build llm_input_json
        llm_json_obj = {
            "patient_demographics": {
                "first_name": a.get('first_name'),
                "last_name": a.get('last_name'),
                "gender": a.get('gender'),
                "age_at_admission": age_at_admission,
                "blood_group": a.get('blood_group'),
                "date_of_birth": a.get('date_of_birth').isoformat() if a.get('date_of_birth') else None,
                "marital_status": a.get('marital_status'),
                "preferred_language": a.get('preferred_language'),
                "phone": a.get('phone'),
                "email": a.get('email'),
                "address": a.get('address'),
                "city": a.get('city'),
                "state": a.get('state'),
                "postal_code": a.get('postal_code'),
                "emergency_contact_name": a.get('emergency_contact_name'),
                "emergency_contact_phone": a.get('emergency_contact_phone'),
            },
            "admission_details": {
                "admission_number": a.get('admission_number'),
                "admission_date": a.get('admission_date').isoformat() if a.get('admission_date') else None,
                "admission_type": a.get('admission_type'),
                "admission_source": a.get('admission_source'),
                "reason_for_admission": a.get('reason_for_admission'),
                "discharge_status": a.get('discharge_status'),
                "current_stay_days": current_stay_days,
                "attending_doctor": attending_doctor,
                "doctor_specialization": a.get('doctor_specialization'),
                "doctor_qualification": a.get('doctor_qualification'),
            },
            "diagnoses": {
                "diagnoses_list": all_dx,
                "primary_diagnosis": primary_dx,
                "secondary_diagnoses": secondary_dx_list,
            },
            "medications": {
                "medications_list": meds_list,
            },
            "lab_results": {
                "lab_results_list": labs_list,
            },
            "procedures": {
                "procedures_list": procs_list,
            },
            "vital_signs": {
                "vital_signs_list": all_vs,
                "latest_temperature": latest_vs.get('temperature'),
                "latest_heart_rate": latest_vs.get('heart_rate'),
                "latest_systolic_bp": latest_vs.get('systolic_bp'),
                "latest_diastolic_bp": latest_vs.get('diastolic_bp'),
                "latest_oxygen_saturation": latest_vs.get('oxygen_saturation'),
            },
            "billing": {
                "bill_number": bill.get('bill_number'),
                "bill_date": bill.get('bill_date').isoformat() if bill.get('bill_date') else None,
                "bill_gross_amount": bill.get('gross_amount'),
                "bill_discount_amount": bill.get('discount_amount'),
                "bill_tax_amount": bill.get('tax_amount'),
                "bill_net_amount": bill_net_amount,
                "bill_insurance_portion": bill.get('insurance_amount'),
                "bill_patient_portion": bill.get('patient_amount'),
                "bill_status": bill.get('bill_status'),
                "total_paid_amount": total_paid_amount,
                "outstanding_balance": outstanding_balance,
                "bill_clearance_status": bill_clearance_status,
                "total_insurance_settled": total_insurance_settled,
                "payment_count": payment_count,
            }
        }

        # Build llm_input prompt string
        llm_prompt_text = build_llm_input_text(llm_json_obj)
        llm_json_str = json.dumps(llm_json_obj, default=json_serializer)

        rows_to_insert.append((
            aid,
            a.get('admission_number'),
            a.get('patient_id'),
            a.get('patient_number'),
            a.get('first_name'),
            a.get('last_name'),
            a.get('gender'),
            age_at_admission,
            a.get('blood_group'),
            a.get('date_of_birth'),
            a.get('marital_status'),
            a.get('preferred_language'),
            a.get('phone'),
            a.get('email'),
            a.get('address'),
            a.get('city'),
            a.get('state'),
            a.get('postal_code'),
            a.get('emergency_contact_name'),
            a.get('emergency_contact_phone'),
            a.get('admission_date'),
            a.get('admission_type'),
            a.get('admission_source'),
            a.get('reason_for_admission'),
            a.get('discharge_status'),
            current_stay_days,
            attending_doctor,
            a.get('doctor_specialization'),
            a.get('doctor_qualification'),
            primary_dx,
            json.dumps(secondary_dx_list),
            latest_vs.get('temperature'),
            latest_vs.get('heart_rate'),
            latest_vs.get('systolic_bp'),
            latest_vs.get('diastolic_bp'),
            latest_vs.get('oxygen_saturation'),
            bill.get('bill_number'),
            bill_net_amount,
            bill.get('bill_status'),
            bill_clearance_status,
            outstanding_balance,
            llm_prompt_text,
            llm_json_str,
            datetime.now()
        ))

    # 10. Upsert into dim_admission_inputs
    print(f"Upserting {len(rows_to_insert):,} records into `dim_admission_inputs`...")
    insert_sql = """
        INSERT INTO dim_admission_inputs (
            admission_id, admission_number, patient_id, patient_number, first_name, last_name, gender,
            age_at_admission, blood_group, date_of_birth, marital_status, preferred_language, phone, email,
            address, city, state, postal_code, emergency_contact_name, emergency_contact_phone, admission_date,
            admission_type, admission_source, reason_for_admission, discharge_status, current_stay_days,
            attending_doctor, doctor_specialization, doctor_qualification, primary_diagnosis, secondary_diagnoses,
            latest_temperature, latest_heart_rate, latest_systolic_bp, latest_diastolic_bp, latest_oxygen_saturation,
            bill_number, bill_net_amount, bill_status, bill_clearance_status, outstanding_balance,
            llm_input, llm_input_json, gold_ingestion_time
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
            %s, %s
        )
        ON CONFLICT (admission_id) DO UPDATE SET
            admission_number = EXCLUDED.admission_number,
            patient_id = EXCLUDED.patient_id,
            patient_number = EXCLUDED.patient_number,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            gender = EXCLUDED.gender,
            age_at_admission = EXCLUDED.age_at_admission,
            blood_group = EXCLUDED.blood_group,
            date_of_birth = EXCLUDED.date_of_birth,
            marital_status = EXCLUDED.marital_status,
            preferred_language = EXCLUDED.preferred_language,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            postal_code = EXCLUDED.postal_code,
            emergency_contact_name = EXCLUDED.emergency_contact_name,
            emergency_contact_phone = EXCLUDED.emergency_contact_phone,
            admission_date = EXCLUDED.admission_date,
            admission_type = EXCLUDED.admission_type,
            admission_source = EXCLUDED.admission_source,
            reason_for_admission = EXCLUDED.reason_for_admission,
            discharge_status = EXCLUDED.discharge_status,
            current_stay_days = EXCLUDED.current_stay_days,
            attending_doctor = EXCLUDED.attending_doctor,
            doctor_specialization = EXCLUDED.doctor_specialization,
            doctor_qualification = EXCLUDED.doctor_qualification,
            primary_diagnosis = EXCLUDED.primary_diagnosis,
            secondary_diagnoses = EXCLUDED.secondary_diagnoses,
            latest_temperature = EXCLUDED.latest_temperature,
            latest_heart_rate = EXCLUDED.latest_heart_rate,
            latest_systolic_bp = EXCLUDED.latest_systolic_bp,
            latest_diastolic_bp = EXCLUDED.latest_diastolic_bp,
            latest_oxygen_saturation = EXCLUDED.latest_oxygen_saturation,
            bill_number = EXCLUDED.bill_number,
            bill_net_amount = EXCLUDED.bill_net_amount,
            bill_status = EXCLUDED.bill_status,
            bill_clearance_status = EXCLUDED.bill_clearance_status,
            outstanding_balance = EXCLUDED.outstanding_balance,
            llm_input = EXCLUDED.llm_input,
            llm_input_json = EXCLUDED.llm_input_json,
            gold_ingestion_time = EXCLUDED.gold_ingestion_time;
    """

    psycopg2.extras.execute_batch(cur, insert_sql, rows_to_insert, page_size=100)
    conn.commit()

    # 11. Verification
    cur.execute("SELECT COUNT(*) AS total, COUNT(llm_input) AS with_llm, COUNT(llm_input_json) AS with_json FROM dim_admission_inputs;")
    stats = cur.fetchone()
    print("=" * 70)
    print(f"SUCCESS! `dim_admission_inputs` populated in PostgreSQL:")
    print(f"  Total records: {stats['total']:,}")
    print(f"  With LLM prompt text: {stats['with_llm']:,}")
    print(f"  With LLM JSON payload: {stats['with_json']:,}")
    print("=" * 70)

    conn.close()


if __name__ == "__main__":
    run_pipeline(admitted_only=True)
