import os
import json
import datetime
import logging
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query, Body, Path, status
from pydantic import BaseModel, Field
import psycopg2
import psycopg2.extras
import db_config
from connectors.databricks_connector import DatabricksConnector

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1",
    tags=["Patient Management & Relational Lifecycle APIs"]
)

db_connector = DatabricksConnector()


# ---------------------------------------------------------------------------
# Pydantic Request Models for Patient Creation
# ---------------------------------------------------------------------------

class InsuranceInput(BaseModel):
    insurance_provider: Optional[str] = Field("Star Health & Allied Insurance", description="Name of the insurance carrier/TPA")
    policy_number: Optional[str] = Field(None, description="Policy number / Membership ID")
    policy_type: Optional[str] = Field("Comprehensive Health Cover", description="Policy plan type")
    coverage_limit: Optional[float] = Field(500000.0, description="User-configurable coverage sum insured (e.g. 500000, 1000000, 2500000, 4500000, 5000000)")
    coverage_start_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    coverage_end_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    status: Optional[str] = Field("Active", description="Insurance policy status: Active, Verified, Expired")
    create_claim: Optional[bool] = Field(False, description="Whether to also create an initial insurance claim")
    claimed_amount: Optional[float] = Field(None, description="Initial claimed amount if creating claim")
    claim_status: Optional[str] = Field("Submitted - Under Review", description="Claim status")


class DemographicsInput(BaseModel):
    first_name: str = Field(..., description="Patient first name")
    last_name: str = Field(..., description="Patient last name")
    date_of_birth: Optional[str] = Field(None, description="Date of birth YYYY-MM-DD")
    age: Optional[int] = Field(None, description="Age in years (used to derive DOB if DOB not given)")
    gender: Optional[str] = Field("Female", description="Gender: Male, Female, Other")
    phone: Optional[str] = Field(None, description="Primary contact phone number")
    whatsapp_number: Optional[str] = Field(None, description="WhatsApp contact number")
    email: Optional[str] = Field(None, description="Email address")
    address: Optional[str] = Field("Chennai Metropolitan Area", description="Residential address")
    city: Optional[str] = Field("Chennai", description="City")
    state: Optional[str] = Field("Tamil Nadu", description="State")
    pincode: Optional[str] = Field("600001", description="Postal / Zip code")
    emergency_contact_name: Optional[str] = Field(None, description="Emergency contact person")
    emergency_contact_phone: Optional[str] = Field(None, description="Emergency contact phone")
    blood_group: Optional[str] = Field("O+", description="Blood group e.g. A+, B+, O+, AB+")
    marital_status: Optional[str] = Field("Single", description="Marital status: Single, Married, etc.")
    preferred_language: Optional[str] = Field("English", description="Preferred language: English, Tamil, etc.")


class VisitInput(BaseModel):
    visit_type: Optional[str] = Field("Inpatient", description="Visit type: Inpatient, Outpatient, Emergency, Daycare")
    chief_complaint: Optional[str] = Field("Acute symptoms requiring clinical evaluation", description="Chief complaint")
    visit_status: Optional[str] = Field("Active", description="Visit status: Active, Completed, Scheduled")
    visit_date: Optional[str] = Field(None, description="Visit timestamp ISO format or YYYY-MM-DD HH:MM:SS")
    doctor_id: Optional[int] = Field(None, description="Attending doctor ID")
    doctor_name: Optional[str] = Field(None, description="Attending doctor display name e.g. Dr. Priya Patel")
    department_id: Optional[int] = Field(None, description="Department ID")
    department_name: Optional[str] = Field(None, description="Department name e.g. Cardiology")


class AdmissionInput(BaseModel):
    is_admitted: Optional[bool] = Field(True, description="Whether the patient is being admitted into an inpatient ward")
    admission_type: Optional[str] = Field("Emergency", description="Admission type: Emergency, Planned, Day Care, ICU Transfer")
    admission_source: Optional[str] = Field("Emergency Bay", description="Admission source: Emergency Bay, OPD Referral, Transfer")
    reason_for_admission: Optional[str] = Field("Inpatient Medical Management", description="Reason for admission")
    ward_id: Optional[int] = Field(None, description="Ward ID")
    ward_name: Optional[str] = Field(None, description="Ward name e.g. Medical Intensive Care MICU")
    room_id: Optional[int] = Field(None, description="Room ID")
    room_number: Optional[str] = Field(None, description="Room number e.g. RM-004")
    bed_id: Optional[int] = Field(None, description="Bed ID")
    bed_number: Optional[str] = Field(None, description="Bed number e.g. BED-0189")
    admission_date: Optional[str] = Field(None, description="Admission timestamp")
    discharge_status: Optional[str] = Field("Admitted", description="Discharge status: Admitted, Ready, Discharged")


class DiagnosisItem(BaseModel):
    diagnosis_code: Optional[str] = Field("D-101", description="ICD / Hospital diagnosis code")
    diagnosis_name: str = Field(..., description="Diagnosis name e.g. Acute Coronary Syndrome")
    diagnosis_type: Optional[str] = Field("Primary", description="Diagnosis type: Primary, Secondary, Provisional")
    is_primary: Optional[bool] = Field(True, description="Whether this is the primary diagnosis")


class VitalsInput(BaseModel):
    temperature: Optional[float] = Field(98.6, description="Body temperature in Fahrenheit")
    heart_rate: Optional[int] = Field(76, description="Heart rate in bpm")
    systolic_bp: Optional[int] = Field(120, description="Systolic blood pressure in mmHg")
    diastolic_bp: Optional[int] = Field(80, description="Diastolic blood pressure in mmHg")
    respiratory_rate: Optional[int] = Field(18, description="Respiratory rate in breaths/min")
    oxygen_saturation: Optional[float] = Field(98.5, description="SpO2 percentage")
    weight: Optional[float] = Field(65.0, description="Weight in kg")


class MedicationItem(BaseModel):
    medication_name: str = Field(..., description="Medication brand or generic name")
    generic_name: Optional[str] = Field(None, description="Generic formulation name")
    dosage: Optional[str] = Field("500mg", description="Dosage e.g. 500mg, 10mg")
    frequency: Optional[str] = Field("BD", description="Frequency: OD, BD, TDS, QID, PRN")
    route: Optional[str] = Field("Oral", description="Route: Oral, IV, IM, SC")
    duration: Optional[str] = Field("5 Days", description="Duration")
    quantity: Optional[int] = Field(10, description="Dispensed quantity")
    instructions: Optional[str] = Field("Take after food", description="Administration advice")


class LabTestItem(BaseModel):
    test_name: str = Field(..., description="Name of laboratory investigation e.g. Complete Blood Count")
    test_code: Optional[str] = Field(None, description="Test code")
    test_category: Optional[str] = Field(None, description="Category")
    urgency: Optional[str] = Field(None, description="Urgency")
    test_parameter: Optional[str] = Field(None, description="Test parameter")
    result_value: Optional[str] = Field("Normal", description="Numerical or text result")
    unit: Optional[str] = Field("g/dL", description="Measurement unit")
    reference_range: Optional[str] = Field("Normal Range", description="Normal biological reference range")
    abnormal_flag: Optional[bool] = Field(False, description="Flag indicating if parameter is abnormal")
    priority: Optional[str] = Field("Routine", description="Priority: STAT, Urgent, Routine")
    status: Optional[str] = Field("Completed", description="Order status: Completed, Pending, In-Progress")


class BillItemInput(BaseModel):
    description: Optional[str] = Field(None, description="Line item description")
    item_name: Optional[str] = Field(None, description="Item name (alias for description)")
    item_type: Optional[str] = Field(None, description="Item type")
    quantity: Optional[int] = Field(1, description="Quantity")
    unit_price: Optional[float] = Field(0.0, description="Unit charge in Rs")
    gross_amount: Optional[float] = Field(None, description="Gross charge")
    discount_amount: Optional[float] = Field(0.0, description="Discount amount")
    tax_amount: Optional[float] = Field(0.0, description="Tax amount")
    net_amount: Optional[float] = Field(None, description="Net charge")


class BillingInput(BaseModel):
    bill_items: Optional[List[BillItemInput]] = Field(None, description="Itemized billing breakdown")
    gross_amount: Optional[float] = Field(None, description="Total gross invoice amount")
    discount_amount: Optional[float] = Field(0.0, description="Total invoice discount")
    tax_amount: Optional[float] = Field(0.0, description="Total tax")
    net_amount: Optional[float] = Field(None, description="Total net invoice payable")
    patient_amount: Optional[float] = Field(None, description="Out-of-pocket patient co-pay portion")
    insurance_amount: Optional[float] = Field(None, description="Insurance claimed portion")
    bill_status: Optional[str] = Field("Pending", description="Bill status: Pending, Settled, Partially Paid")
    initial_payment_amount: Optional[float] = Field(0.0, description="Initial upfront payment received in Rs")
    payment_method: Optional[str] = Field("CASH", description="Payment method: CASH, CARD, UPI, NET_BANKING")


class CreateFullPatientRequest(BaseModel):
    # 1. Insurance Control (Mandatory toggle & configurable coverage amount)
    is_insured: bool = Field(False, description="Whether the patient is covered by health insurance. If false, NO insurance record is created.")
    insurance_amount: Optional[float] = Field(None, description="User-configurable coverage limit in Rs (e.g. 500000, 1000000, 2500000, 4500000, 5000000). Not hardcoded.")
    insurance_details: Optional[InsuranceInput] = Field(None, description="Detailed insurance policy parameters (used when is_insured=True)")

    # 2. Demographics (Nested or flat)
    demographics: Optional[DemographicsInput] = Field(None, description="Patient demographic attributes")
    first_name: Optional[str] = Field(None, description="Patient first name (if demographics object omitted)")
    last_name: Optional[str] = Field(None, description="Patient last name (if demographics object omitted)")
    gender: Optional[str] = Field(None, description="Gender: Male, Female, Other")
    date_of_birth: Optional[str] = Field(None, description="YYYY-MM-DD")
    age: Optional[int] = Field(None, description="Age in years")
    phone: Optional[str] = Field(None, description="Phone number")
    whatsapp_number: Optional[str] = Field(None, description="WhatsApp number")
    email: Optional[str] = Field(None, description="Email address")
    address: Optional[str] = Field(None, description="Address")
    city: Optional[str] = Field(None, description="City")
    state: Optional[str] = Field(None, description="State")
    pincode: Optional[str] = Field(None, description="Pincode")
    blood_group: Optional[str] = Field(None, description="Blood Group")
    emergency_contact_name: Optional[str] = Field(None, description="Emergency Contact Name")
    emergency_contact_phone: Optional[str] = Field(None, description="Emergency Contact Phone")
    marital_status: Optional[str] = Field(None, description="Marital status")
    preferred_language: Optional[str] = Field(None, description="Language")

    # 3. Clinical, Visit, Admission & Care Data
    visit: Optional[VisitInput] = Field(None, description="Hospital visit record")
    admission: Optional[AdmissionInput] = Field(None, description="Inpatient admission details")
    diagnoses: Optional[List[DiagnosisItem]] = Field(None, description="List of primary and secondary clinical diagnoses")
    primary_diagnosis: Optional[str] = Field(None, description="Direct shorthand for primary diagnosis name")
    vitals: Optional[VitalsInput] = Field(None, description="Vital signs telemetry at intake")
    medications: Optional[List[MedicationItem]] = Field(None, description="Prescriptions & medication items")
    prescriptions: Optional[List[MedicationItem]] = Field(None, description="Alias for medications")
    lab_tests: Optional[List[LabTestItem]] = Field(None, description="Lab investigations & ordered diagnostic panels")
    lab_orders: Optional[List[LabTestItem]] = Field(None, description="Alias for lab_tests")
    billing: Optional[BillingInput] = Field(None, description="Billing, invoice line items, and payment breakdown")
    bill_items: Optional[List[BillItemInput]] = Field(None, description="Direct list of bill items")
    create_billing: Optional[bool] = Field(True, description="Whether to generate billing invoice")
    
    # Direct Insurance Shorthand Fields
    insurance_provider: Optional[str] = Field(None, description="Insurance company name")
    policy_number: Optional[str] = Field(None, description="Insurance policy number")
    group_number: Optional[str] = Field(None, description="Insurance group number")
    insurance_plan_name: Optional[str] = Field(None, description="Insurance plan name")
    insurance_status: Optional[str] = Field(None, description="Insurance policy status")
    co_pay_percentage: Optional[float] = Field(None, description="Co-pay percentage")
    deductible_amount: Optional[float] = Field(None, description="Deductible amount")
    pre_auth_required: Optional[bool] = Field(None, description="Whether pre-auth is required")
    
    # Encounter & Care Type (IP vs OP)
    patient_type: Optional[str] = Field("IP", description="Patient encounter type: 'IP' (Inpatient) or 'OP' (Outpatient)")
    encounter_type: Optional[str] = Field(None, description="Alias for patient_type: 'IP' or 'OP'")
    
    # Direct Bed & Ward Selection for IP
    bed_id: Optional[int] = Field(None, description="Specific bed ID for IP admission")
    bed_number: Optional[str] = Field(None, description="Specific bed number for IP admission (e.g. BED-0108)")
    ward_id: Optional[int] = Field(None, description="Specific ward ID for IP admission")
    ward_name: Optional[str] = Field(None, description="Specific ward name for IP admission")
    room_id: Optional[int] = Field(None, description="Specific room ID for IP admission")
    room_number: Optional[str] = Field(None, description="Specific room number for IP admission")
    admission_days: Optional[int] = Field(1, description="Number of inpatient days for calculating bed charges in the bill (default: 1)")
    
    # Direct Visit & Admission Shorthand Fields
    create_visit: Optional[bool] = Field(True, description="Whether to create visit")
    visit_type: Optional[str] = Field(None, description="Visit type (Inpatient, Outpatient, Emergency)")
    consultation_reason: Optional[str] = Field(None, description="Chief complaint / consultation reason")
    create_admission: Optional[bool] = Field(None, description="Whether to create admission")
    admission_type: Optional[str] = Field(None, description="Admission type (Emergency, Elective, Urgent)")
    admission_source: Optional[str] = Field(None, description="Admission source (Emergency Department, Referral, Direct)")
    reason_for_admission: Optional[str] = Field(None, description="Clinical reason for admission")
    allow_duplicate: Optional[bool] = Field(False, description="Allow creating another record if matching patient name/phone exists")


# ---------------------------------------------------------------------------
# Helper Functions: Sequence sync, safe next ID, and string truncation
# ---------------------------------------------------------------------------

def _s(val: Any, max_len: int = 50) -> Optional[str]:
    """Safely converts input to string and truncates to max_len to prevent varchar(N) overflow."""
    if val is None:
        return None
    s = str(val).strip()
    return s[:max_len] if len(s) > max_len else s


def _get_next_id(cur, table_name: str, pk_col: str) -> int:
    """Safely retrieves the next available ID from a table, agnostic of cursor dictionary format."""
    cur.execute(f"SELECT COALESCE(MAX({pk_col}), 0) + 1 AS next_id FROM {table_name};")
    row = cur.fetchone()
    if isinstance(row, dict):
        return int(row.get('next_id') or list(row.values())[0])
    return int(row[0])


def _sync_sequence(cur, table_name: str, pk_col: str):
    """Ensures PostgreSQL sequence is aligned with MAX(pk) to avoid unique key violation."""
    try:
        cur.execute(f"SELECT pg_get_serial_sequence('{table_name}', '{pk_col}');")
        row = cur.fetchone()
        seq = list(row.values())[0] if isinstance(row, dict) else row[0]
        if seq:
            cur.execute(f"SELECT COALESCE(MAX({pk_col}), 1) AS max_val FROM {table_name};")
            m_row = cur.fetchone()
            max_v = list(m_row.values())[0] if isinstance(m_row, dict) else m_row[0]
            max_v = max_v or 1
            cur.execute(f"SELECT setval('{seq}', {max_v}, true);")
    except Exception as e:
        logger.debug(f"Sequence sync warning on {table_name}: {e}")


# ---------------------------------------------------------------------------
# API 0: LIST AVAILABLE BEDS FOR INPATIENT (IP) ADMISSION
# ---------------------------------------------------------------------------

@router.get("/patients/available-beds", summary="List All Currently Available Beds For IP Admission")
@router.get("/patients-mgmt/available-beds", summary="Alias: List Available Beds")
def get_available_beds(
    ward_id: Optional[int] = Query(None, description="Filter by Ward ID"),
    bed_type: Optional[str] = Query(None, description="Filter by Bed Type")
):
    """
    Retrieves all available beds in the hospital with room, ward, and daily charge rates.
    Use this endpoint to inspect and pick a bed when admitting an IP patient.
    """
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        query = """
            SELECT 
                b.bed_id,
                b.bed_number,
                b.bed_type,
                b.daily_charge,
                b.status,
                b.ward_id,
                COALESCE(w.ward_name, 'General Care Ward') AS ward_name,
                w.ward_type,
                w.floor_number,
                b.room_id,
                COALESCE(r.room_number, 'RM-GEN') AS room_number,
                r.room_type
            FROM beds b
            LEFT JOIN wards w ON b.ward_id = w.ward_id
            LEFT JOIN rooms r ON b.room_id = r.room_id
            WHERE b.status = 'Available'
        """
        params = []
        if ward_id:
            query += " AND b.ward_id = %s"
            params.append(ward_id)
        if bed_type:
            query += " AND b.bed_type ILIKE %s"
            params.append(f"%{bed_type}%")
        query += " ORDER BY b.bed_id ASC;"

        cur.execute(query, tuple(params))
        beds = cur.fetchall()
        bed_list = []
        for b in beds:
            bd = dict(b)
            bd['daily_charge'] = float(bd['daily_charge'] or 5500.0)
            bed_list.append(bd)

        return {
            "success": True,
            "total_available": len(bed_list),
            "available_beds": bed_list
        }
    except Exception as e:
        logger.error(f"Error fetching available beds: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch available beds: {str(e)}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# API 1: CREATE PATIENT WITH COMPLETE RELATED DATA
# ---------------------------------------------------------------------------

@router.post("/patients/create-full", summary="Create Patient with Complete Relational Records (Demographics, Clinical, Admission, Billing & Insurance)")
@router.post("/patients-mgmt/create", summary="Alias: Create Patient with Complete Relational Records")
def create_patient_full(payload: CreateFullPatientRequest = Body(...)):
    """
    Creates a new patient in PostgreSQL with full transactional relational consistency:
    - **Demographics**: `patients`
    - **Insurance**: Optional. If `is_insured=True`, creates `patient_insurance` with caller-defined `insurance_amount` (coverage limit). If `is_insured=False`, NO insurance record is created.
    - **Visit & Doctor**: `patient_visits`
    - **Admission & Bed**: `admissions`, `dim_admission_inputs`, updates `beds.status = 'Occupied'`
    - **Diagnoses**: `diagnoses`
    - **Vitals**: `vital_signs`
    - **Prescriptions**: `prescriptions`, `prescription_items`
    - **Lab Tests**: `lab_orders`, `lab_results`
    - **Billing**: `bills`, `bill_items`, `payments`, and `insurance_claims` (if insured)
    - **Audit & Notification**: `agent_action_logs`, `notifications`
    """
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Resolve Demographics
        demo = payload.demographics
        first_name = (demo.first_name if demo else payload.first_name) or "New"
        last_name = (demo.last_name if demo else payload.last_name) or "Patient"
        gender = (demo.gender if demo else payload.gender) or "Female"
        phone = (demo.phone if demo else payload.phone) or "+91 98400 00000"
        whatsapp = (demo.whatsapp_number if demo else payload.whatsapp_number) or phone
        email = (demo.email if demo else payload.email) or f"patient_{int(datetime.datetime.now().timestamp())}@meridianhospital.com"
        address = (demo.address if demo else payload.address) or "Chennai Metropolitan Area"
        city = (demo.city if demo else payload.city) or "Chennai"
        state = (demo.state if demo else payload.state) or "Tamil Nadu"
        pincode = (demo.pincode if demo else payload.pincode) or "600001"
        emergency_name = (demo.emergency_contact_name if demo else payload.emergency_contact_name) or "Emergency Contact"
        emergency_phone = (demo.emergency_contact_phone if demo else payload.emergency_contact_phone) or phone
        blood_group = (demo.blood_group if demo else payload.blood_group) or "O+"
        marital_status = (demo.marital_status if demo else payload.marital_status) or "Single"
        pref_lang = (demo.preferred_language if demo else payload.preferred_language) or "English"
        dob_str = (demo.date_of_birth if demo else payload.date_of_birth)
        age = (demo.age if demo else payload.age)

        # Ensure Age and Date of Birth are strictly synchronized
        if age is not None and str(age).strip() != '':
            try:
                num_age = int(age)
                calc_year = datetime.date.today().year - num_age
                if dob_str and '-' in str(dob_str):
                    parts = str(dob_str).split('-')
                    if len(parts) == 3:
                        dob_str = f"{calc_year}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                    else:
                        dob_str = f"{calc_year}-05-15"
                else:
                    dob_str = f"{calc_year}-05-15"
            except Exception:
                dob_str = f"{datetime.date.today().year - 35}-05-15"
                age = 35
        elif dob_str and '-' in str(dob_str):
            try:
                birth_year = int(str(dob_str).split('-')[0])
                age = max(0, datetime.date.today().year - birth_year)
            except Exception:
                age = 35
        else:
            age = 35
            dob_str = f"{datetime.date.today().year - 35}-05-15"
        # 1b. Duplicate Detection (prevent creating accidental duplicates with same Name and Phone)
        if not getattr(payload, 'allow_duplicate', False):
            clean_phone_digits = ''.join(ch for ch in phone if ch.isdigit())
            cur.execute("""
                SELECT id, patient_code, first_name, last_name, phone 
                FROM patients 
                WHERE LOWER(TRIM(first_name)) = LOWER(TRIM(%s)) 
                  AND LOWER(TRIM(last_name)) = LOWER(TRIM(%s))
                ORDER BY id DESC LIMIT 1;
            """, (first_name, last_name))
            existing_pat = cur.fetchone()
            if existing_pat:
                ex_id = existing_pat.get('id') or existing_pat[0]
                ex_code = existing_pat.get('patient_code') or f"MER-PAT-{ex_id}"
                conn.rollback()
                raise HTTPException(
                    status_code=409,
                    detail=f"Patient '{first_name} {last_name}' already exists in the system with Patient Code '{ex_code}' (ID: {ex_id}). To manage or delete this record, use the 360° Explorer & Deep Delete tab."
                )

        # Generate unique patient ID and Code
        _sync_sequence(cur, 'patients', 'id')
        next_patient_id = _get_next_id(cur, 'patients', 'id')
        patient_code = f"MER-PAT-{str(next_patient_id).zfill(7)}"

        insert_patient_sql = """
            INSERT INTO patients (
                id, patient_code, first_name, last_name, date_of_birth, gender,
                phone, whatsapp_number, email, address, city, state, pincode,
                emergency_contact_name, emergency_contact_phone, blood_group,
                preferred_language, marital_status, status, registration_date, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id, patient_code;
        """
        cur.execute(insert_patient_sql, (
            next_patient_id, _s(patient_code, 50), _s(first_name, 50), _s(last_name, 50), _s(dob_str, 50), _s(gender, 50),
            _s(phone, 50), _s(whatsapp, 50), _s(email, 255), _s(address, 255), _s(city, 50), _s(state, 50), _s(pincode, 50),
            _s(emergency_name, 255), _s(emergency_phone, 50), _s(blood_group, 50),
            _s(pref_lang, 50), _s(marital_status, 50)
        ))
        patient_row = cur.fetchone()
        patient_id = patient_row['id'] if isinstance(patient_row, dict) else patient_row[0]

        # 2. Handle Insurance (Configurable sum insured / coverage limit)
        insurance_id = None
        insurance_rec = None
        is_insured_flag = bool(payload.is_insured)

        if is_insured_flag:
            ins_details = payload.insurance_details or InsuranceInput()
            # Coverage limit can be passed directly via payload.insurance_amount or ins_details.coverage_limit
            cov_limit = payload.insurance_amount if payload.insurance_amount is not None else (ins_details.coverage_limit or 500000.0)
            ins_provider = payload.insurance_provider or ins_details.insurance_provider or "Star Health & Allied Insurance"
            policy_no = payload.policy_number or ins_details.policy_number or f"POL-{patient_id}-{datetime.datetime.now().strftime('%m%d')}"
            policy_type = payload.insurance_plan_name or ins_details.policy_type or "Comprehensive Health Gold"
            ins_status = payload.insurance_status or ins_details.status or "Active"
            
            c_start = ins_details.coverage_start_date or (datetime.date.today() - datetime.timedelta(days=90)).strftime("%Y-%m-%d")
            c_end = ins_details.coverage_end_date or (datetime.date.today() + datetime.timedelta(days=275)).strftime("%Y-%m-%d")

            _sync_sequence(cur, 'patient_insurance', 'insurance_id')
            next_ins_id = _get_next_id(cur, 'patient_insurance', 'insurance_id')

            insert_ins_sql = """
                INSERT INTO patient_insurance (
                    insurance_id, patient_id, insurance_provider, policy_number,
                    policy_type, coverage_start_date, coverage_end_date,
                    coverage_limit, status
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s
                ) RETURNING insurance_id;
            """
            cur.execute(insert_ins_sql, (
                next_ins_id, patient_id, _s(ins_provider, 255), _s(policy_no, 50),
                _s(policy_type, 255), _s(c_start, 50), _s(c_end, 50),
                cov_limit, _s(ins_status, 50)
            ))
            ins_row = cur.fetchone()
            insurance_id = ins_row['insurance_id'] if isinstance(ins_row, dict) else ins_row[0]
            insurance_rec = {
                "insurance_id": insurance_id,
                "insurance_provider": ins_provider,
                "policy_number": policy_no,
                "policy_type": policy_type,
                "coverage_limit": float(cov_limit),
                "status": ins_status,
                "coverage_start_date": c_start,
                "coverage_end_date": c_end
            }

        # 3. Resolve Doctor & Department
        doc_id = None
        doc_name = "Dr. Priya Patel"
        doc_spec = "General Medicine"
        doc_qual = "MBBS, MD"
        dept_id = None
        dept_name = "General Medicine"

        visit_input = payload.visit
        if visit_input and visit_input.doctor_id:
            doc_id = visit_input.doctor_id
            cur.execute("SELECT display_name, specialization, qualification, department_id FROM doctors WHERE id = %s LIMIT 1;", (doc_id,))
            drow = cur.fetchone()
            if drow:
                doc_name = drow.get('display_name') or doc_name
                doc_spec = drow.get('specialization') or doc_spec
                doc_qual = drow.get('qualification') or doc_qual
                dept_id = drow.get('department_id') or dept_id
        elif visit_input and visit_input.doctor_name:
            cur.execute("SELECT id, display_name, specialization, qualification, department_id FROM doctors WHERE display_name ILIKE %s LIMIT 1;", (f"%{visit_input.doctor_name}%",))
            drow = cur.fetchone()
            if drow:
                doc_id = drow['id']
                doc_name = drow.get('display_name') or doc_name
                doc_spec = drow.get('specialization') or doc_spec
                doc_qual = drow.get('qualification') or doc_qual
                dept_id = drow.get('department_id') or dept_id

        if not doc_id:
            cur.execute("SELECT id, display_name, specialization, qualification, department_id FROM doctors ORDER BY id LIMIT 1;")
            drow = cur.fetchone()
            if drow:
                doc_id = drow['id']
                doc_name = drow.get('display_name') or doc_name
                doc_spec = drow.get('specialization') or doc_spec
                doc_qual = drow.get('qualification') or doc_qual
                dept_id = drow.get('department_id') or dept_id or 1

        if not dept_id:
            if visit_input and visit_input.department_id:
                dept_id = visit_input.department_id
            elif visit_input and visit_input.department_name:
                cur.execute("SELECT id, department_name FROM departments WHERE department_name ILIKE %s LIMIT 1;", (f"%{visit_input.department_name}%",))
                deprow = cur.fetchone()
                if deprow:
                    dept_id = deprow['id']
                    dept_name = deprow['department_name']
            else:
                cur.execute("SELECT id, department_name FROM departments ORDER BY id LIMIT 1;")
                deprow = cur.fetchone()
                if deprow:
                    dept_id = deprow['id']
                    dept_name = deprow['department_name']

        # 4. Resolve Encounter Type (IP vs OP) & Create Visit
        raw_enc = (payload.patient_type or payload.encounter_type or (visit_input.visit_type if visit_input else None) or payload.visit_type or "IP").strip().upper()
        is_ip = raw_enc in ["IP", "INPATIENT"] or bool(payload.create_admission) or bool(payload.admission and payload.admission.is_admitted) or bool(payload.bed_id) or bool(payload.bed_number)

        _sync_sequence(cur, 'patient_visits', 'visit_id')
        next_visit_id = _get_next_id(cur, 'patient_visits', 'visit_id')

        v_type = "Inpatient" if is_ip else "Outpatient"
        v_complaint = (visit_input.chief_complaint if visit_input else payload.consultation_reason) or ("Acute inpatient admission evaluation" if is_ip else "General outpatient consultation")
        v_status = (visit_input.visit_status if visit_input else "Active")
        v_date = (visit_input.visit_date if visit_input and visit_input.visit_date else datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        insert_visit_sql = """
            INSERT INTO patient_visits (
                visit_id, patient_id, doctor_id, department_id,
                visit_date, visit_type, chief_complaint, visit_status
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s
            ) RETURNING visit_id;
        """
        cur.execute(insert_visit_sql, (
            next_visit_id, patient_id, doc_id, dept_id,
            v_date, _s(v_type, 50), _s(v_complaint, 500), _s(v_status, 50)
        ))
        v_row = cur.fetchone()
        visit_id = v_row['visit_id'] if isinstance(v_row, dict) else v_row[0]

        # 5. Handle Inpatient Admission & Bed Allocation (if IP)
        admission_id = None
        admission_rec = None
        bed_rec = None
        assigned_bed_number = None
        assigned_room_number = None
        assigned_ward_name = None

        if is_ip:
            adm_input = payload.admission or AdmissionInput()
            _sync_sequence(cur, 'admissions', 'admission_id')
            next_adm_id = _get_next_id(cur, 'admissions', 'admission_id')
            adm_number = f"MER-ADM-{str(next_adm_id).zfill(7)}"

            adm_type = payload.admission_type or adm_input.admission_type or "Emergency"
            adm_source = payload.admission_source or adm_input.admission_source or "Emergency Bay"
            adm_reason = payload.reason_for_admission or adm_input.reason_for_admission or v_complaint
            discharge_st = adm_input.discharge_status or "Admitted"
            adm_date = adm_input.admission_date or v_date

            target_bed_id = payload.bed_id or adm_input.bed_id
            target_bed_no = payload.bed_number or adm_input.bed_number
            target_ward_id = payload.ward_id or adm_input.ward_id
            target_ward_name = payload.ward_name or adm_input.ward_name
            target_room_id = payload.room_id or adm_input.room_id
            target_room_no = payload.room_number or adm_input.room_number

            brow = None
            if target_bed_id:
                cur.execute("""
                    SELECT b.bed_id, b.bed_number, b.bed_type, b.daily_charge, b.status, b.ward_id, COALESCE(w.ward_name, 'General Care Ward') as ward_name, b.room_id, COALESCE(r.room_number, 'RM-GEN') as room_number 
                    FROM beds b 
                    LEFT JOIN wards w ON b.ward_id = w.ward_id 
                    LEFT JOIN rooms r ON b.room_id = r.room_id 
                    WHERE b.bed_id = %s LIMIT 1;
                """, (target_bed_id,))
                brow = cur.fetchone()
            elif target_bed_no:
                cur.execute("""
                    SELECT b.bed_id, b.bed_number, b.bed_type, b.daily_charge, b.status, b.ward_id, COALESCE(w.ward_name, 'General Care Ward') as ward_name, b.room_id, COALESCE(r.room_number, 'RM-GEN') as room_number 
                    FROM beds b 
                    LEFT JOIN wards w ON b.ward_id = w.ward_id 
                    LEFT JOIN rooms r ON b.room_id = r.room_id 
                    WHERE b.bed_number ILIKE %s LIMIT 1;
                """, (target_bed_no.strip(),))
                brow = cur.fetchone()

            if not brow:
                # Find first available bed
                cur.execute("""
                    SELECT b.bed_id, b.bed_number, b.bed_type, b.daily_charge, b.status, b.ward_id, COALESCE(w.ward_name, 'General Care Ward') as ward_name, b.room_id, COALESCE(r.room_number, 'RM-GEN') as room_number 
                    FROM beds b 
                    LEFT JOIN wards w ON b.ward_id = w.ward_id 
                    LEFT JOIN rooms r ON b.room_id = r.room_id 
                    WHERE b.status = 'Available' 
                    ORDER BY b.bed_id ASC LIMIT 1;
                """)
                brow = cur.fetchone()

            if brow:
                bed_id = brow['bed_id']
                assigned_bed_number = brow['bed_number']
                bed_type = brow['bed_type'] or "Motorized Hospital Bed"
                bed_daily_charge = float(brow['daily_charge'] or 5500.0)
                ward_id = brow.get('ward_id') or target_ward_id or 5
                assigned_ward_name = brow.get('ward_name') or target_ward_name or "Medical Intensive Care MICU"
                room_id = brow.get('room_id') or target_room_id
                assigned_room_number = brow.get('room_number') or target_room_no or "RM-GEN"
            else:
                bed_id = 108
                assigned_bed_number = "BED-0108"
                bed_type = "Motorized Deluxe Bed"
                bed_daily_charge = 12500.0
                ward_id = 5
                assigned_ward_name = "Medical Intensive Care MICU"
                room_id = 109
                assigned_room_number = "RM-109"

            # Validate ward_id in wards table to preserve foreign key
            cur.execute("SELECT ward_id, ward_name FROM wards WHERE ward_id = %s LIMIT 1;", (ward_id,))
            w_chk = cur.fetchone()
            if not w_chk:
                cur.execute("SELECT ward_id, ward_name FROM wards ORDER BY ward_id ASC LIMIT 1;")
                fw = cur.fetchone()
                ward_id = fw['ward_id'] if fw else 5
                assigned_ward_name = fw['ward_name'] if fw else assigned_ward_name

            insert_adm_sql = """
                INSERT INTO admissions (
                    admission_id, admission_number, patient_id, visit_id,
                    doctor_id, department_id, ward_id, bed_id,
                    admission_date, admission_type, admission_source,
                    reason_for_admission, discharge_status
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s
                ) RETURNING admission_id;
            """
            cur.execute(insert_adm_sql, (
                next_adm_id, _s(adm_number, 50), patient_id, visit_id,
                doc_id, dept_id, ward_id, bed_id,
                adm_date, _s(adm_type, 50), _s(adm_source, 255),
                _s(adm_reason, 500), _s(discharge_st, 50)
            ))
            adm_row = cur.fetchone()
            admission_id = adm_row['admission_id'] if isinstance(adm_row, dict) else adm_row[0]

            # Mark assigned bed as Occupied in beds table
            if bed_id and discharge_st.lower() != 'discharged':
                cur.execute("""
                    UPDATE beds 
                    SET status = 'Occupied',
                        ward_id = (CASE WHEN ward_id NOT IN (SELECT ward_id FROM wards) THEN (SELECT ward_id FROM wards LIMIT 1) ELSE ward_id END),
                        room_id = (CASE WHEN room_id NOT IN (SELECT room_id FROM rooms) THEN (SELECT room_id FROM rooms LIMIT 1) ELSE room_id END)
                    WHERE bed_id = %s;
                """, (bed_id,))

            bed_rec = {
                "bed_id": bed_id,
                "bed_number": assigned_bed_number,
                "bed_type": bed_type,
                "daily_charge": bed_daily_charge,
                "status": "Occupied",
                "ward_id": ward_id,
                "ward_name": assigned_ward_name,
                "room_id": room_id,
                "room_number": assigned_room_number
            }

            admission_rec = {
                "admission_id": admission_id,
                "admission_number": adm_number,
                "admission_date": adm_date,
                "admission_type": adm_type,
                "admission_source": adm_source,
                "reason_for_admission": adm_reason,
                "discharge_status": discharge_st,
                "ward_name": assigned_ward_name,
                "room_number": assigned_room_number,
                "bed_number": assigned_bed_number
            }

        # 6. Diagnoses
        diag_list = []
        raw_diagnoses = payload.diagnoses or []
        primary_diag_str = payload.primary_diagnosis or (raw_diagnoses[0].diagnosis_name if raw_diagnoses else "Acute Clinical Management")

        if not raw_diagnoses:
            raw_diagnoses = [DiagnosisItem(diagnosis_code="D-101", diagnosis_name=primary_diag_str, diagnosis_type="Primary", is_primary=True)]

        _sync_sequence(cur, 'diagnoses', 'diagnosis_id')
        for diag in raw_diagnoses:
            next_diag_id = _get_next_id(cur, 'diagnoses', 'diagnosis_id')

            insert_diag_sql = """
                INSERT INTO diagnoses (
                    diagnosis_id, patient_id, visit_id, admission_id,
                    doctor_id, diagnosis_code, diagnosis_name,
                    diagnosis_type, diagnosis_date, is_primary
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, CURRENT_TIMESTAMP, %s
                ) RETURNING diagnosis_id;
            """
            cur.execute(insert_diag_sql, (
                next_diag_id, patient_id, visit_id, admission_id,
                doc_id, _s(diag.diagnosis_code or "D-101", 50), _s(diag.diagnosis_name, 255),
                _s(diag.diagnosis_type or "Primary", 50), bool(diag.is_primary)
            ))
            diag_row = cur.fetchone()
            diag_id = diag_row['diagnosis_id'] if isinstance(diag_row, dict) else diag_row[0]
            diag_list.append({
                "diagnosis_id": diag_id,
                "diagnosis_code": diag.diagnosis_code or "D-101",
                "diagnosis_name": diag.diagnosis_name,
                "diagnosis_type": diag.diagnosis_type or "Primary",
                "is_primary": bool(diag.is_primary)
            })

        # 7. Vitals Telemetry
        vitals_rec = None
        vitals_in = payload.vitals or VitalsInput()
        _sync_sequence(cur, 'vital_signs', 'vital_id')
        next_vital_id = _get_next_id(cur, 'vital_signs', 'vital_id')

        insert_vitals_sql = """
            INSERT INTO vital_signs (
                vital_id, patient_id, patient_code, visit_id, admission_id,
                recorded_at, temperature, heart_rate, systolic_bp,
                diastolic_bp, respiratory_rate, oxygen_saturation, weight
            ) VALUES (
                %s, %s, %s, %s, %s,
                CURRENT_TIMESTAMP, %s, %s, %s,
                %s, %s, %s, %s
            ) RETURNING vital_id;
        """
        cur.execute(insert_vitals_sql, (
            next_vital_id, patient_id, _s(patient_code, 50), visit_id, admission_id,
            vitals_in.temperature, vitals_in.heart_rate, vitals_in.systolic_bp,
            vitals_in.diastolic_bp, vitals_in.respiratory_rate, vitals_in.oxygen_saturation,
            vitals_in.weight
        ))
        vital_row = cur.fetchone()
        vital_id = vital_row['vital_id'] if isinstance(vital_row, dict) else vital_row[0]
        vitals_rec = {
            "vital_id": vital_id,
            "temperature": float(vitals_in.temperature or 98.6),
            "heart_rate": vitals_in.heart_rate or 76,
            "systolic_bp": vitals_in.systolic_bp or 120,
            "diastolic_bp": vitals_in.diastolic_bp or 80,
            "respiratory_rate": vitals_in.respiratory_rate or 18,
            "oxygen_saturation": float(vitals_in.oxygen_saturation or 98.5),
            "weight": float(vitals_in.weight or 65.0)
        }

        # 8. Prescriptions & Medications
        prescription_id = None
        meds_rec = []
        raw_meds = payload.medications or payload.prescriptions or []
        if raw_meds:
            _sync_sequence(cur, 'prescriptions', 'prescription_id')
            next_rx_id = _get_next_id(cur, 'prescriptions', 'prescription_id')

            insert_rx_sql = """
                INSERT INTO prescriptions (
                    prescription_id, patient_id, doctor_id, visit_id, admission_id,
                    prescription_date, status
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    CURRENT_TIMESTAMP, 'Active'
                ) RETURNING prescription_id;
            """
            cur.execute(insert_rx_sql, (next_rx_id, patient_id, doc_id, visit_id, admission_id))
            rx_row = cur.fetchone()
            prescription_id = rx_row['prescription_id'] if isinstance(rx_row, dict) else rx_row[0]

            _sync_sequence(cur, 'prescription_items', 'prescription_item_id')
            _sync_sequence(cur, 'pharmacy_sales', 'sale_id')
            _sync_sequence(cur, 'pharmacy_sale_items', 'sale_item_id')

            next_sale_id = _get_next_id(cur, 'pharmacy_sales', 'sale_id')

            # Pre-process medications to resolve real medication_id, unit_price, inventory_id
            resolved_meds = []
            total_sales_amt = 0.0

            for med in raw_meds:
                m_name = (med.medication_name or '').strip()
                med_id = None
                unit_pr = 50.0
                inv_id = None

                if m_name:
                    cur.execute("SELECT medication_id, unit_price FROM medications WHERE medication_name ILIKE %s OR generic_name ILIKE %s LIMIT 1;", (f"%{m_name}%", f"%{m_name}%"))
                    mrow = cur.fetchone()
                    if mrow:
                        med_id = mrow['medication_id'] if isinstance(mrow, dict) else mrow[0]
                        unit_pr = float((mrow['unit_price'] if isinstance(mrow, dict) else mrow[1]) or 50.0)

                if not med_id:
                    # Look for fallback medication from database
                    cur.execute("SELECT medication_id, unit_price FROM medications ORDER BY medication_id ASC LIMIT 1;")
                    mrow = cur.fetchone()
                    if mrow:
                        med_id = mrow['medication_id'] if isinstance(mrow, dict) else mrow[0]
                        unit_pr = float((mrow['unit_price'] if isinstance(mrow, dict) else mrow[1]) or 50.0)

                # Look up inventory batch if available
                if med_id:
                    cur.execute("SELECT inventory_id FROM pharmacy_inventory WHERE medication_id = %s LIMIT 1;", (med_id,))
                    inv_row = cur.fetchone()
                    if inv_row:
                        inv_id = inv_row['inventory_id'] if isinstance(inv_row, dict) else inv_row[0]

                qty = int(med.quantity or 10)
                item_total = float(qty * unit_pr)
                total_sales_amt += item_total

                resolved_meds.append({
                    "med": med,
                    "med_id": med_id,
                    "unit_price": unit_pr,
                    "inventory_id": inv_id,
                    "quantity": qty,
                    "net_amount": item_total
                })

            cur.execute("""
                INSERT INTO pharmacy_sales (
                    sale_id, patient_id, visit_id, admission_id,
                    prescription_id, bill_id, sale_date,
                    total_amount, discount_amount, tax_amount, net_amount, payment_status
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, CURRENT_TIMESTAMP,
                    %s, 0.00, 0.00, %s, 'Paid'
                );
            """, (next_sale_id, patient_id, visit_id, admission_id, prescription_id, None, total_sales_amt, total_sales_amt))

            for r_med in resolved_meds:
                med = r_med["med"]
                med_id = r_med["med_id"]
                unit_pr = r_med["unit_price"]
                inv_id = r_med["inventory_id"]
                qty = r_med["quantity"]
                item_total = r_med["net_amount"]

                next_item_id = _get_next_id(cur, 'prescription_items', 'prescription_item_id')

                insert_item_sql = """
                    INSERT INTO prescription_items (
                        prescription_item_id, prescription_id, medication_id, dosage,
                        frequency, route, duration, quantity, instructions
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s, %s
                    ) RETURNING prescription_item_id;
                """
                cur.execute(insert_item_sql, (
                    next_item_id, prescription_id, med_id, _s(med.dosage or "500mg", 255),
                    _s(med.frequency or "BD", 255), _s(med.route or "Oral", 255), _s(med.duration or "5 Days", 255),
                    qty, _s(med.instructions or "Take after food", 500)
                ))
                p_item_row = cur.fetchone()
                p_item_id = p_item_row['prescription_item_id'] if isinstance(p_item_row, dict) else p_item_row[0]

                # Insert corresponding pharmacy sale item with live DB price
                next_sale_item_id = _get_next_id(cur, 'pharmacy_sale_items', 'sale_item_id')
                cur.execute("""
                    INSERT INTO pharmacy_sale_items (
                        sale_item_id, sale_id, medication_id, inventory_id, quantity, unit_price,
                        discount_amount, tax_amount, net_amount
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        0.00, 0.00, %s
                    );
                """, (next_sale_item_id, next_sale_id, med_id, inv_id, qty, unit_pr, item_total))

                meds_rec.append({
                    "prescription_item_id": p_item_id,
                    "medication_name": med.medication_name,
                    "dosage": med.dosage or "500mg",
                    "frequency": med.frequency or "BD",
                    "route": med.route or "Oral",
                    "duration": med.duration or "5 Days",
                    "instructions": med.instructions or "Take after food",
                    "unit_price": unit_pr,
                    "quantity": qty,
                    "total_price": item_total
                })

        # 9. Laboratory Investigations
        lab_orders_rec = []
        raw_labs = payload.lab_tests or payload.lab_orders or []
        if raw_labs:
            _sync_sequence(cur, 'lab_orders', 'lab_order_id')
            _sync_sequence(cur, 'lab_results', 'lab_result_id')
            for lab in raw_labs:
                next_lab_id = _get_next_id(cur, 'lab_orders', 'lab_order_id')

                insert_lab_sql = """
                    INSERT INTO lab_orders (
                        lab_order_id, patient_id, doctor_id, visit_id, admission_id,
                        ordered_date, priority, status
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        CURRENT_TIMESTAMP, %s, %s
                    ) RETURNING lab_order_id;
                """
                cur.execute(insert_lab_sql, (
                    next_lab_id, patient_id, doc_id, visit_id, admission_id,
                    _s(lab.priority or "Routine", 50), _s(lab.status or "Completed", 50)
                ))
                lo_row = cur.fetchone()
                lab_order_id = lo_row['lab_order_id'] if isinstance(lo_row, dict) else lo_row[0]

                next_res_id = _get_next_id(cur, 'lab_results', 'lab_result_id')

                insert_res_sql = """
                    INSERT INTO lab_results (
                        lab_result_id, lab_order_id, patient_id, test_parameter,
                        result_value, unit, reference_range, abnormal_flag,
                        verification_status, result_date
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, %s,
                        'Verified', CURRENT_TIMESTAMP
                    ) RETURNING lab_result_id;
                """
                cur.execute(insert_res_sql, (
                    next_res_id, lab_order_id, patient_id, _s(lab.test_parameter or lab.test_name, 255),
                    _s(lab.result_value or "Normal", 255), _s(lab.unit or "g/dL", 50), _s(lab.reference_range or "Normal Range", 255),
                    bool(lab.abnormal_flag)
                ))
                lr_row = cur.fetchone()
                lab_res_id = lr_row['lab_result_id'] if isinstance(lr_row, dict) else lr_row[0]
                lab_orders_rec.append({
                    "lab_order_id": lab_order_id,
                    "lab_result_id": lab_res_id,
                    "test_name": lab.test_name,
                    "test_parameter": lab.test_parameter or lab.test_name,
                    "result_value": lab.result_value or "Normal",
                    "unit": lab.unit or "g/dL",
                    "reference_range": lab.reference_range or "Normal Range",
                    "abnormal_flag": bool(lab.abnormal_flag)
                })

        # 10. Billing, Invoices & Claims
        bill_id = None
        bill_rec = None
        claim_rec = None
        billing_in = payload.billing or BillingInput()
        raw_items = list((billing_in.bill_items if payload.billing and billing_in.bill_items else None) or payload.bill_items or [])

        # Auto-incorporate Bed Charge into bill line items if IP
        if is_ip and bed_rec:
            has_bed_item = any(
                (getattr(it, 'item_type', None) and it.item_type.lower() == 'bed charge') or
                (getattr(it, 'description', None) and 'bed' in it.description.lower()) or
                (getattr(it, 'item_name', None) and 'bed' in it.item_name.lower())
                for it in raw_items
            )
            if not has_bed_item:
                adm_days = int(payload.admission_days or 1)
                b_rate = float(bed_rec.get("daily_charge") or 5500.0)
                bed_charge_item = BillItemInput(
                    description=f"Inpatient Bed Charge - {bed_rec['bed_number']} ({bed_rec['ward_name'] or 'General Ward'})",
                    item_name=f"Bed Charge ({bed_rec['bed_number']})",
                    item_type="Bed Charge",
                    quantity=adm_days,
                    unit_price=b_rate,
                    gross_amount=b_rate * adm_days,
                    discount_amount=0.0,
                    tax_amount=0.0,
                    net_amount=b_rate * adm_days
                )
                raw_items = [bed_charge_item] + raw_items
        elif not is_ip:
            # If OP and raw_items is empty, provide default OP consultation
            if not raw_items:
                raw_items = [
                    BillItemInput(
                        description="Outpatient Consultation & Clinical Assessment",
                        item_name="General Consultation",
                        item_type="Consultation",
                        quantity=1,
                        unit_price=800.0,
                        net_amount=800.0
                    )
                ]

        total_gross = billing_in.gross_amount or sum(float(item.gross_amount or (item.quantity * item.unit_price)) for item in raw_items)
        total_discount = billing_in.discount_amount or sum(float(item.discount_amount or 0.0) for item in raw_items)
        total_tax = billing_in.tax_amount or sum(float(item.tax_amount or 0.0) for item in raw_items)
        total_net = billing_in.net_amount or max(0.0, total_gross - total_discount + total_tax)

        # Apportion Insurance vs Patient portions
        if is_insured_flag:
            # If insured, insurance portion defaults to net amount (up to coverage limit)
            ins_coverage = payload.insurance_amount if payload.insurance_amount is not None else 500000.0
            ins_portion = billing_in.insurance_amount if billing_in.insurance_amount is not None else min(total_net, ins_coverage)
            pat_portion = billing_in.patient_amount if billing_in.patient_amount is not None else max(0.0, total_net - ins_portion)
        else:
            # If NOT insured, insurance amount is strictly 0.0 and patient is responsible for 100%
            ins_portion = 0.0
            pat_portion = total_net

        _sync_sequence(cur, 'bills', 'bill_id')
        next_bill_id = _get_next_id(cur, 'bills', 'bill_id')
        bill_number = f"MER-BIL-{str(next_bill_id).zfill(7)}"

        insert_bill_sql = """
            INSERT INTO bills (
                bill_id, bill_number, patient_id, visit_id, admission_id,
                bill_date, gross_amount, discount_amount, tax_amount,
                net_amount, insurance_amount, patient_amount, bill_status
            ) VALUES (
                %s, %s, %s, %s, %s,
                CURRENT_TIMESTAMP, %s, %s, %s,
                %s, %s, %s, %s
            ) RETURNING bill_id;
        """
        cur.execute(insert_bill_sql, (
            next_bill_id, _s(bill_number, 50), patient_id, visit_id, admission_id,
            total_gross, total_discount, total_tax,
            total_net, ins_portion, pat_portion, _s(billing_in.bill_status or "Pending", 50)
        ))
        b_row = cur.fetchone()
        bill_id = b_row['bill_id'] if isinstance(b_row, dict) else b_row[0]

        # Insert Bill Items
        _sync_sequence(cur, 'bill_items', 'bill_item_id')
        items_rec = []
        for item in raw_items:
            next_b_item_id = _get_next_id(cur, 'bill_items', 'bill_item_id')

            desc = item.description or item.item_name or "Hospital Service / Consultation"
            unit_pr = float(item.unit_price or 0.0)
            qty = int(item.quantity or 1)
            i_gross = float(item.gross_amount or (qty * unit_pr))
            i_disc = float(item.discount_amount or 0.0)
            i_tax = float(item.tax_amount or 0.0)
            i_net = float(item.net_amount or (i_gross - i_disc + i_tax))

            insert_b_item_sql = """
                INSERT INTO bill_items (
                    bill_item_id, bill_id, description, quantity,
                    unit_price, gross_amount, discount_amount,
                    tax_amount, net_amount, service_date
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, CURRENT_DATE
                ) RETURNING bill_item_id;
            """
            cur.execute(insert_b_item_sql, (
                next_b_item_id, bill_id, _s(desc, 255), qty,
                unit_pr, i_gross, i_disc,
                i_tax, i_net
            ))
            bi_row = cur.fetchone()
            b_item_id = bi_row['bill_item_id'] if isinstance(bi_row, dict) else bi_row[0]
            items_rec.append({
                "bill_item_id": b_item_id,
                "description": desc,
                "quantity": qty,
                "unit_price": unit_pr,
                "net_amount": i_net
            })

        # Initial Payment (if specified)
        init_pay = float(billing_in.initial_payment_amount or 0.0)
        if init_pay > 0:
            _sync_sequence(cur, 'payments', 'id')
            next_pay_id = _get_next_id(cur, 'payments', 'id')
            pay_ref = f"PAY-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"

            insert_pay_sql = """
                INSERT INTO payments (
                    id, payment_reference, patient_id, bill_id,
                    amount, currency, payment_method, payment_status,
                    payment_date, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, 'INR', %s, 'SUCCESS',
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            """
            cur.execute(insert_pay_sql, (
                next_pay_id, _s(pay_ref, 255), patient_id, bill_id,
                init_pay, _s(billing_in.payment_method or "CASH", 50)
            ))

        bill_rec = {
            "bill_id": bill_id,
            "bill_number": bill_number,
            "gross_amount": float(total_gross),
            "discount_amount": float(total_discount),
            "tax_amount": float(total_tax),
            "net_amount": float(total_net),
            "insurance_amount": float(ins_portion),
            "patient_amount": float(pat_portion),
            "bill_status": billing_in.bill_status or "Pending",
            "items": items_rec
        }

        # If insured, create corresponding Insurance Claim record
        if is_insured_flag and (ins_portion > 0 or (payload.insurance_details and payload.insurance_details.create_claim)):
            _sync_sequence(cur, 'insurance_claims', 'claim_id')
            next_claim_id = _get_next_id(cur, 'insurance_claims', 'claim_id')
            claim_no = f"CLM-{datetime.datetime.now().strftime('%Y%m%d')}-{str(next_claim_id).zfill(5)}"
            claimed_amt = float(ins_portion) if ins_portion > 0 else float(total_net)

            insert_claim_sql = """
                INSERT INTO insurance_claims (
                    claim_id, claim_number, patient_id, bill_id,
                    insurance_provider, policy_number, claim_date,
                    claimed_amount, approved_amount, rejected_amount,
                    settled_amount, outstanding_amount, claim_status
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, CURRENT_DATE,
                    %s, 0.00, 0.00,
                    0.00, %s, 'Submitted - Under Review'
                ) RETURNING claim_id;
            """
            cur.execute(insert_claim_sql, (
                next_claim_id, _s(claim_no, 50), patient_id, bill_id,
                _s(insurance_rec["insurance_provider"], 255), _s(insurance_rec["policy_number"], 50),
                claimed_amt, claimed_amt
            ))
            cl_row = cur.fetchone()
            claim_id = cl_row['claim_id'] if isinstance(cl_row, dict) else cl_row[0]
            claim_rec = {
                "claim_id": claim_id,
                "claim_number": claim_no,
                "claimed_amount": claimed_amt,
                "claim_status": "Submitted - Under Review",
                "insurance_provider": insurance_rec["insurance_provider"],
                "policy_number": insurance_rec["policy_number"]
            }

        # 11. Populate Gold Sync View / Table `dim_admission_inputs` (if admitted)
        if admission_id:
            insert_dim_sql = """
                INSERT INTO dim_admission_inputs (
                    admission_id, admission_number, patient_id, patient_number,
                    first_name, last_name, gender, age_at_admission,
                    blood_group, date_of_birth, marital_status, preferred_language,
                    phone, email, address, city, state, postal_code,
                    emergency_contact_name, emergency_contact_phone,
                    admission_date, admission_type, admission_source,
                    reason_for_admission, discharge_status, current_stay_days,
                    attending_doctor, doctor_specialization, doctor_qualification,
                    primary_diagnosis, secondary_diagnoses,
                    latest_temperature, latest_heart_rate, latest_systolic_bp,
                    latest_diastolic_bp, latest_oxygen_saturation,
                    bill_number, bill_net_amount, bill_status, bill_clearance_status,
                    outstanding_balance, bed_number, room_number, ward_name,
                    gold_ingestion_time
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s, 1,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    CURRENT_TIMESTAMP
                ) ON CONFLICT (admission_id) DO NOTHING;
            """
            cur.execute(insert_dim_sql, (
                admission_id, _s(admission_rec["admission_number"], 50), patient_id, _s(patient_code, 50),
                _s(first_name, 255), _s(last_name, 255), _s(gender, 50), age or 35,
                _s(blood_group, 50), _s(dob_str, 50), _s(marital_status, 50), _s(pref_lang, 50),
                _s(phone, 50), _s(email, 255), _s(address, 255), _s(city, 50), _s(state, 50), _s(pincode, 50),
                _s(emergency_name, 255), _s(emergency_phone, 50),
                admission_rec["admission_date"], _s(admission_rec["admission_type"], 50), _s(admission_rec["admission_source"], 255),
                _s(admission_rec["reason_for_admission"], 500), _s(admission_rec["discharge_status"], 50),
                _s(doc_name, 255), _s(doc_spec, 255), _s(doc_qual, 255),
                _s(primary_diag_str, 255), _s("[]", 500),
                vitals_rec["temperature"], vitals_rec["heart_rate"], vitals_rec["systolic_bp"],
                vitals_rec["diastolic_bp"], vitals_rec["oxygen_saturation"],
                _s(bill_number, 50), total_net, _s(bill_rec["bill_status"], 50), _s("Pending", 50),
                total_net, _s(assigned_bed_number or "BED-0189", 50), _s(assigned_room_number or "RM-004", 50), _s(assigned_ward_name or "Medical Intensive Care MICU", 255)
            ))

        # 12. Create Appointment in appointments table
        apt_rec = None
        try:
            _sync_sequence(cur, 'appointments', 'id')
            next_apt_id = _get_next_id(cur, 'appointments', 'id')
            booking_id = f"BK-{datetime.datetime.now().strftime('%Y%m%d')}-{str(next_apt_id).zfill(4)}"
            apt_reason = _s(primary_diag_str or "Clinical Intake Consultation", 50)

            cur.execute("""
                INSERT INTO appointments (
                    id, booking_id, patient_id, doctor_id, department_id,
                    appointment_date, appointment_time, status, booking_source,
                    patient_reason, reason_for_visit, appointment_type,
                    created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    CURRENT_DATE, CURRENT_TIME, 'CONFIRMED', 'Hospital Portal',
                    %s, %s, %s,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            """, (
                next_apt_id, booking_id, patient_id, doc_id, dept_id,
                apt_reason, apt_reason,
                "INPATIENT_ROUNDS" if is_ip else "OUTPATIENT_CONSULTATION"
            ))
            apt_rec = {
                "appointment_id": next_apt_id,
                "booking_id": booking_id,
                "doctor_name": doc_name,
                "department_name": dept_name,
                "status": "CONFIRMED"
            }
        except Exception as apt_err:
            logger.warning(f"Could not insert appointment for patient {patient_id}: {apt_err}")

        # 13. Create System Notification and Audit Log
        try:
            cur.execute("""
                INSERT INTO notifications (
                    patient_id, notification_type, channel, message, reason, status, created_at, sent_at
                ) VALUES (
                    %s, 'ADMISSION_REMINDER', 'SYSTEM_ALERT', %s, 'New Patient Intake', 'UNREAD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            """, (patient_id, f"New patient registered: {first_name} {last_name} ({patient_code}). Insured: {'Yes - Rs ' + str(int(payload.insurance_amount or 500000)) if is_insured_flag else 'No (Self-Pay)'}."))

            cur.execute("""
                INSERT INTO agent_action_logs (
                    patient_id, action_name, intent, input_data, output_data, status, created_at
                ) VALUES (
                    %s, 'PATIENT_CREATION_FULL', 'REGISTER_PATIENT_COMPLETE', %s, %s, 'SUCCESS', CURRENT_TIMESTAMP
                );
            """, (patient_id, json.dumps({"name": f"{first_name} {last_name}", "is_insured": is_insured_flag}), json.dumps({"patient_id": patient_id, "patient_code": patient_code})))
        except Exception as log_err:
            logger.warning(f"Non-blocking log error during patient registration for {patient_id}: {log_err}")

        # Commit everything atomically
        conn.commit()

        # Invalidate cache so telemetry updates immediately
        try:
            db_connector.clear_cache()
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Patient '{first_name} {last_name}' registered successfully as {'Inpatient (IP) - Bed Assigned: ' + (assigned_bed_number or 'N/A') if is_ip else 'Outpatient (OP)'}.",
            "patient_type": "IP" if is_ip else "OP",
            "encounter_type": "IP" if is_ip else "OP",
            "patient": {
                "id": patient_id,
                "patient_code": patient_code,
                "first_name": first_name,
                "last_name": last_name,
                "gender": gender,
                "date_of_birth": dob_str,
                "phone": phone,
                "email": email,
                "blood_group": blood_group,
                "is_insured": is_insured_flag
            },
            "insurance": insurance_rec,
            "bed": bed_rec,
            "admission": admission_rec,
            "visit": {
                "visit_id": visit_id,
                "visit_type": v_type,
                "visit_status": v_status,
                "attending_doctor": doc_name,
                "department": dept_name
            },
            "diagnoses": diag_list,
            "vital_signs": vitals_rec,
            "prescriptions": meds_rec,
            "lab_orders": lab_orders_rec,
            "billing": bill_rec,
            "bill": bill_rec,
            "claim": claim_rec,
            "insurance_claim": claim_rec
        }

    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating full patient record: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create patient: {str(e)}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# API 2: COMPLETE PATIENT DELETION WITH ALL DEPENDENT RECORDS
# ---------------------------------------------------------------------------

@router.delete("/patients/{patient_identifier}/delete-full", summary="Delete Patient Completely Across All Relational Tables (Safe & Transactional)")
@router.delete("/patients-mgmt/{patient_identifier}", summary="Alias: Complete Patient Deletion")
def delete_patient_full(patient_identifier: str = Path(..., description="Patient ID (integer) or Patient Code (e.g. MER-PAT-0087265)")):
    """
    Safely and transactionally deletes a patient and all their cascading records across the entire database:
    1. Releases any assigned beds back to 'Available'
    2. Deletes from all child/foreign-key tables in reverse dependency order:
       - bill_items, discounts, refunds, payments, insurance_claims, bills
       - prescription_items, pharmacy_sales, prescriptions
       - lab_results, lab_orders
       - dim_generated_discharge_summaries, discharge_summaries
       - dim_admission_inputs, dim_revenue_predictions
       - diagnoses, patient_procedures, vital_signs, bed_assignments, admissions
       - patient_visits, appointments
       - patient_insurance
       - feedback, documents, consent, notifications, escalations, agent logs, radiology
       - users (portal user linked to patient)
       - patients (root record)
    3. Guarantees 100% atomic rollback on error to prevent partial orphan data.
    """
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Identify Target Patient
        target_pid = None
        target_code = None

        if patient_identifier.isdigit():
            cur.execute("SELECT id, patient_code, first_name, last_name FROM patients WHERE id = %s LIMIT 1;", (int(patient_identifier),))
        else:
            cur.execute("SELECT id, patient_code, first_name, last_name FROM patients WHERE patient_code = %s OR patient_code ILIKE %s LIMIT 1;", (patient_identifier, f"%{patient_identifier}%"))
        
        patient_row = cur.fetchone()
        if not patient_row:
            # Also check if it exists in dim_admission_inputs or admissions
            if patient_identifier.isdigit():
                cur.execute("SELECT patient_id as id, patient_number as patient_code, first_name, last_name FROM dim_admission_inputs WHERE patient_id = %s LIMIT 1;", (int(patient_identifier),))
                patient_row = cur.fetchone()
            
            if not patient_row:
                raise HTTPException(status_code=404, detail=f"Patient with identifier '{patient_identifier}' not found.")

        target_pid = patient_row['id']
        target_code = patient_row['patient_code']
        patient_full_name = f"{patient_row.get('first_name', '')} {patient_row.get('last_name', '')}".strip()

        # 2. Collect all relational keys belonging to this patient
        cur.execute("SELECT admission_id, bed_id, visit_id FROM admissions WHERE patient_id = %s;", (target_pid,))
        adm_rows = cur.fetchall()
        admission_ids = [r['admission_id'] for r in adm_rows if r.get('admission_id')]
        bed_ids_to_release = [r['bed_id'] for r in adm_rows if r.get('bed_id')]
        adm_visit_ids = [r['visit_id'] for r in adm_rows if r.get('visit_id')]

        # Check beds mentioned in dim_admission_inputs
        cur.execute("SELECT bed_number, admission_id FROM dim_admission_inputs WHERE patient_id = %s OR patient_number = %s;", (target_pid, target_code))
        dim_rows = cur.fetchall()
        bed_numbers_to_release = [r['bed_number'] for r in dim_rows if r.get('bed_number')]
        for r in dim_rows:
            if r.get('admission_id') and r['admission_id'] not in admission_ids:
                admission_ids.append(r['admission_id'])

        cur.execute("SELECT visit_id FROM patient_visits WHERE patient_id = %s;", (target_pid,))
        visit_ids = list(set([r['visit_id'] for r in cur.fetchall()] + adm_visit_ids))

        # Comprehensive key collection across patient_id, visit_ids, and admission_ids
        cur.execute("""
            SELECT bill_id FROM bills 
            WHERE patient_id = %s 
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, visit_ids or [-1], admission_ids or [-1]))
        bill_ids = list(set([r['bill_id'] for r in cur.fetchall()]))

        cur.execute("""
            SELECT prescription_id FROM prescriptions 
            WHERE patient_id = %s 
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, visit_ids or [-1], admission_ids or [-1]))
        prescription_ids = list(set([r['prescription_id'] for r in cur.fetchall()]))

        cur.execute("""
            SELECT lab_order_id FROM lab_orders 
            WHERE patient_id = %s 
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, visit_ids or [-1], admission_ids or [-1]))
        lab_order_ids = list(set([r['lab_order_id'] for r in cur.fetchall()]))

        cur.execute("""
            SELECT claim_id FROM insurance_claims 
            WHERE patient_id = %s 
               OR (bill_id IS NOT NULL AND bill_id = ANY(%s));
        """, (target_pid, bill_ids or [-1]))
        claim_ids = list(set([r['claim_id'] for r in cur.fetchall()]))

        cur.execute("""
            SELECT id FROM payments 
            WHERE patient_id = %s 
               OR (bill_id IS NOT NULL AND bill_id = ANY(%s));
        """, (target_pid, bill_ids or [-1]))
        payment_ids = list(set([r['id'] for r in cur.fetchall()]))

        cur.execute("""
            SELECT sale_id FROM pharmacy_sales 
            WHERE patient_id = %s 
               OR (bill_id IS NOT NULL AND bill_id = ANY(%s))
               OR (prescription_id IS NOT NULL AND prescription_id = ANY(%s))
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, bill_ids or [-1], prescription_ids or [-1], visit_ids or [-1], admission_ids or [-1]))
        pharmacy_sale_ids = list(set([r['sale_id'] for r in cur.fetchall()]))

        deletion_summary = {}

        # 3. Release any occupied beds
        if bed_ids_to_release:
            cur.execute("""
                UPDATE beds 
                SET status = 'Available',
                    ward_id = (CASE WHEN ward_id NOT IN (SELECT ward_id FROM wards) THEN (SELECT ward_id FROM wards LIMIT 1) ELSE ward_id END),
                    room_id = (CASE WHEN room_id NOT IN (SELECT room_id FROM rooms) THEN (SELECT room_id FROM rooms LIMIT 1) ELSE room_id END)
                WHERE bed_id = ANY(%s);
            """, (bed_ids_to_release,))
            deletion_summary["beds_released"] = len(bed_ids_to_release)
        if bed_numbers_to_release:
            cur.execute("""
                UPDATE beds 
                SET status = 'Available',
                    ward_id = (CASE WHEN ward_id NOT IN (SELECT ward_id FROM wards) THEN (SELECT ward_id FROM wards LIMIT 1) ELSE ward_id END),
                    room_id = (CASE WHEN room_id NOT IN (SELECT room_id FROM rooms) THEN (SELECT room_id FROM rooms LIMIT 1) ELSE room_id END)
                WHERE bed_number = ANY(%s);
            """, (bed_numbers_to_release,))

        # 4. Safe Delete Cascades (Exhaustive leaf-to-root order)

        # 4a. Pharmacy sale items & Pharmacy sales
        if pharmacy_sale_ids:
            cur.execute("DELETE FROM pharmacy_sale_items WHERE sale_id = ANY(%s);", (pharmacy_sale_ids,))
            deletion_summary["pharmacy_sale_items"] = cur.rowcount
            cur.execute("DELETE FROM pharmacy_sales WHERE sale_id = ANY(%s) OR patient_id = %s;", (pharmacy_sale_ids, target_pid))
            deletion_summary["pharmacy_sales"] = cur.rowcount
        else:
            cur.execute("DELETE FROM pharmacy_sales WHERE patient_id = %s;", (target_pid,))

        # 4b. Insurance claim items & Claims
        if claim_ids:
            cur.execute("DELETE FROM insurance_claim_items WHERE claim_id = ANY(%s);", (claim_ids,))
            deletion_summary["insurance_claim_items"] = cur.rowcount
            cur.execute("DELETE FROM insurance_claims WHERE claim_id = ANY(%s) OR patient_id = %s;", (claim_ids, target_pid))
            deletion_summary["insurance_claims"] = cur.rowcount
        else:
            cur.execute("DELETE FROM insurance_claims WHERE patient_id = %s;", (target_pid,))

        # 4c. Refunds & Payments
        cur.execute("""
            DELETE FROM refunds 
            WHERE patient_id = %s 
               OR (payment_id IS NOT NULL AND payment_id = ANY(%s))
               OR (bill_id IS NOT NULL AND bill_id = ANY(%s));
        """, (target_pid, payment_ids or [-1], bill_ids or [-1]))
        deletion_summary["refunds"] = cur.rowcount

        cur.execute("""
            DELETE FROM payments 
            WHERE patient_id = %s 
               OR (id = ANY(%s))
               OR (bill_id IS NOT NULL AND bill_id = ANY(%s));
        """, (target_pid, payment_ids or [-1], bill_ids or [-1]))
        deletion_summary["payments"] = cur.rowcount

        # 4d. Bill items, Discounts, and Bills
        if bill_ids:
            cur.execute("DELETE FROM bill_items WHERE bill_id = ANY(%s);", (bill_ids,))
            deletion_summary["bill_items"] = cur.rowcount
            cur.execute("DELETE FROM discounts WHERE bill_id = ANY(%s);", (bill_ids,))

        cur.execute("""
            DELETE FROM bills 
            WHERE patient_id = %s 
               OR (bill_id = ANY(%s))
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, bill_ids or [-1], visit_ids or [-1], admission_ids or [-1]))
        deletion_summary["bills"] = cur.rowcount

        if visit_ids or admission_ids:
            cur.execute("""
                UPDATE bills 
                SET visit_id = NULL, admission_id = NULL 
                WHERE (visit_id IS NOT NULL AND visit_id = ANY(%s)) 
                   OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
            """, (visit_ids or [-1], admission_ids or [-1]))

        # 4e. Prescription items & Prescriptions
        if prescription_ids:
            cur.execute("DELETE FROM prescription_items WHERE prescription_id = ANY(%s);", (prescription_ids,))
            deletion_summary["prescription_items"] = cur.rowcount

        cur.execute("""
            DELETE FROM prescriptions 
            WHERE patient_id = %s 
               OR (prescription_id = ANY(%s))
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, prescription_ids or [-1], visit_ids or [-1], admission_ids or [-1]))
        deletion_summary["prescriptions"] = cur.rowcount

        if visit_ids or admission_ids:
            cur.execute("""
                UPDATE prescriptions 
                SET visit_id = NULL, admission_id = NULL 
                WHERE (visit_id IS NOT NULL AND visit_id = ANY(%s)) 
                   OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
            """, (visit_ids or [-1], admission_ids or [-1]))

        # 4f. Lab results & Lab orders
        if lab_order_ids:
            cur.execute("DELETE FROM lab_results WHERE lab_order_id = ANY(%s) OR patient_id = %s;", (lab_order_ids, target_pid))
            deletion_summary["lab_results"] = cur.rowcount
        else:
            cur.execute("DELETE FROM lab_results WHERE patient_id = %s;", (target_pid,))

        cur.execute("""
            DELETE FROM lab_orders 
            WHERE patient_id = %s 
               OR (lab_order_id = ANY(%s))
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, lab_order_ids or [-1], visit_ids or [-1], admission_ids or [-1]))
        deletion_summary["lab_orders"] = cur.rowcount

        if visit_ids or admission_ids:
            cur.execute("""
                UPDATE lab_orders 
                SET visit_id = NULL, admission_id = NULL 
                WHERE (visit_id IS NOT NULL AND visit_id = ANY(%s)) 
                   OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
            """, (visit_ids or [-1], admission_ids or [-1]))

        # 4g. Radiology Studies, Messages & Orders
        cur.execute("""
            DELETE FROM radiology_clarification_reads 
            WHERE message_id IN (
                SELECT id FROM radiology_clarification_messages 
                WHERE thread_id IN (
                    SELECT id FROM radiology_clarifications 
                    WHERE order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s)
                )
            );
        """, (target_pid,))
        cur.execute("""
            DELETE FROM radiology_clarification_events 
            WHERE thread_id IN (
                SELECT id FROM radiology_clarifications 
                WHERE order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s)
            );
        """, (target_pid,))
        cur.execute("""
            DELETE FROM radiology_clarification_messages 
            WHERE thread_id IN (
                SELECT id FROM radiology_clarifications 
                WHERE order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s)
            );
        """, (target_pid,))
        cur.execute("DELETE FROM radiology_clarifications WHERE order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s);", (target_pid,))
        cur.execute("DELETE FROM radiology_followup_events WHERE order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s) OR previous_order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s);", (target_pid, target_pid))
        cur.execute("DELETE FROM radiology_scan WHERE order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s) OR patient_id = %s OR (patient_code IS NOT NULL AND patient_code = %s);", (target_pid, target_pid, target_code or ''))
        cur.execute("DELETE FROM radiology_order_studies WHERE order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s);", (target_pid,))
        cur.execute("DELETE FROM radiology_patient_identifiers WHERE order_id IN (SELECT order_id FROM radiology_orders WHERE patient_id = %s) OR patient_id = %s;", (target_pid, target_pid))
        cur.execute("DELETE FROM radiology_orders WHERE patient_id = %s;", (target_pid,))

        # 4h. RAG / Chat conversations
        cur.execute("""
            DELETE FROM rag_conversation_context 
            WHERE conversation_id IN (SELECT id FROM rag_conversations WHERE patient_id = %s);
        """, (target_pid,))
        cur.execute("""
            DELETE FROM rag_messages 
            WHERE conversation_id IN (SELECT id FROM rag_conversations WHERE patient_id = %s);
        """, (target_pid,))
        cur.execute("DELETE FROM rag_conversations WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM conversations WHERE patient_id = %s;", (target_pid,))

        # 4i. Discharge summaries (dim and operational)
        if admission_ids:
            cur.execute("DELETE FROM dim_generated_discharge_summaries WHERE patient_id = %s OR admission_id = ANY(%s);", (target_pid, admission_ids))
            deletion_summary["dim_generated_discharge_summaries"] = cur.rowcount
            cur.execute("DELETE FROM discharge_summaries WHERE patient_id = %s OR admission_id = ANY(%s);", (target_pid, admission_ids))
            deletion_summary["discharge_summaries"] = cur.rowcount
        else:
            cur.execute("DELETE FROM dim_generated_discharge_summaries WHERE patient_id = %s;", (target_pid,))
            cur.execute("DELETE FROM discharge_summaries WHERE patient_id = %s;", (target_pid,))

        # 4j. Gold reporting sync table `dim_admission_inputs` & `dim_revenue_predictions`
        if target_code:
            cur.execute("DELETE FROM dim_admission_inputs WHERE patient_id = %s OR patient_number = %s OR (admission_id IS NOT NULL AND admission_id = ANY(%s));", (target_pid, target_code, admission_ids or [-1]))
            cur.execute("DELETE FROM dim_revenue_predictions WHERE patient_id = %s OR patient_number = %s;", (target_pid, target_code))
        else:
            cur.execute("DELETE FROM dim_admission_inputs WHERE patient_id = %s OR (admission_id IS NOT NULL AND admission_id = ANY(%s));", (target_pid, admission_ids or [-1]))
            cur.execute("DELETE FROM dim_revenue_predictions WHERE patient_id = %s;", (target_pid,))
        deletion_summary["dim_admission_inputs"] = cur.rowcount

        # 4k. Clinical observations: Diagnoses, Procedures, Vital signs, Bed assignments
        cur.execute("""
            DELETE FROM diagnoses 
            WHERE patient_id = %s 
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, visit_ids or [-1], admission_ids or [-1]))
        deletion_summary["diagnoses"] = cur.rowcount

        cur.execute("""
            DELETE FROM patient_procedures 
            WHERE patient_id = %s 
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, visit_ids or [-1], admission_ids or [-1]))
        deletion_summary["patient_procedures"] = cur.rowcount

        cur.execute("""
            DELETE FROM vital_signs 
            WHERE patient_id = %s 
               OR (patient_code IS NOT NULL AND patient_code = %s)
               OR (visit_id IS NOT NULL AND visit_id = ANY(%s))
               OR (admission_id IS NOT NULL AND admission_id = ANY(%s));
        """, (target_pid, target_code or '', visit_ids or [-1], admission_ids or [-1]))
        deletion_summary["vital_signs"] = cur.rowcount

        cur.execute("DELETE FROM bed_assignments WHERE patient_id = %s OR (admission_id IS NOT NULL AND admission_id = ANY(%s));", (target_pid, admission_ids or [-1]))

        # 4l. Admissions & Visits
        cur.execute("DELETE FROM admissions WHERE patient_id = %s OR (admission_id = ANY(%s));", (target_pid, admission_ids or [-1]))
        deletion_summary["admissions"] = cur.rowcount

        cur.execute("DELETE FROM patient_visits WHERE patient_id = %s OR (visit_id = ANY(%s));", (target_pid, visit_ids or [-1]))
        deletion_summary["patient_visits"] = cur.rowcount

        cur.execute("DELETE FROM appointments WHERE patient_id = %s;", (target_pid,))
        deletion_summary["appointments"] = cur.rowcount

        # 4h. Patient Insurance Policies
        cur.execute("DELETE FROM patient_insurance WHERE patient_id = %s;", (target_pid,))
        deletion_summary["patient_insurance"] = cur.rowcount

        # 4i. Feedback, Reports, Pre-admissions, Consents
        cur.execute("DELETE FROM patient_feedback WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM patient_reports WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM pre_admissions WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM consent_record WHERE patient_id = %s;", (target_pid,))

        # 4j. Operational & Safety logs: Escalations, Notifications, Agent logs, Conversations
        cur.execute("DELETE FROM escalations WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM notifications WHERE patient_id = %s;", (target_pid,))
        deletion_summary["notifications"] = cur.rowcount
        cur.execute("DELETE FROM agent_action_logs WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM conversations WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM rag_conversations WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM rag_documents WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM rag_query_audit WHERE patient_id = %s;", (target_pid,))

        # 4k. Radiology scans and orders
        cur.execute("DELETE FROM radiology_orders WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM radiology_patient_identifiers WHERE patient_id = %s;", (target_pid,))
        cur.execute("DELETE FROM radiology_scan WHERE patient_id = %s OR (patient_code IS NOT NULL AND patient_code = %s);", (target_pid, target_code or ''))

        # 4l. Associated patient user account in users table (if any)
        cur.execute("DELETE FROM users WHERE patient_id = %s;", (target_pid,))

        # 4m. Finally, Delete Root Patient Record
        cur.execute("DELETE FROM patients WHERE id = %s;", (target_pid,))
        deletion_summary["patients"] = cur.rowcount

        # Commit everything atomically
        conn.commit()

        # Invalidate cache so telemetry updates immediately
        try:
            db_connector.clear_cache()
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Patient '{patient_full_name}' (ID: {target_pid}, Code: {target_code}) and all associated records have been completely and safely deleted.",
            "deleted_patient": {
                "patient_id": target_pid,
                "patient_code": target_code,
                "patient_name": patient_full_name
            },
            "records_purged": deletion_summary
        }

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error during atomic patient deletion: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete patient {patient_identifier}: {str(e)}")
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# API 3: GET FULL PATIENT RELATIONAL DETAILS
# ---------------------------------------------------------------------------

@router.get("/patients/{patient_identifier}/full-details", summary="Fetch Complete Relational Patient Details Across All Modules")
def get_patient_full_details(patient_identifier: str = Path(..., description="Patient ID (integer) or Patient Code (e.g. MER-PAT-0087265)")):
    """Retrieves full 360-degree patient profile including demographics, insurance, admissions, visits, billing, diagnoses, vitals, meds, and lab results."""
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        if patient_identifier.isdigit():
            cur.execute("SELECT * FROM patients WHERE id = %s LIMIT 1;", (int(patient_identifier),))
        else:
            cur.execute("SELECT * FROM patients WHERE patient_code = %s OR patient_code ILIKE %s LIMIT 1;", (patient_identifier, f"%{patient_identifier}%"))
        
        patient = cur.fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient '{patient_identifier}' not found.")

        pid = patient['id']

        cur.execute("SELECT * FROM patient_insurance WHERE patient_id = %s;", (pid,))
        insurance = cur.fetchall()

        cur.execute("SELECT * FROM admissions WHERE patient_id = %s ORDER BY admission_id DESC;", (pid,))
        admissions = cur.fetchall()

        cur.execute("SELECT * FROM patient_visits WHERE patient_id = %s ORDER BY visit_id DESC;", (pid,))
        visits = cur.fetchall()

        cur.execute("SELECT * FROM diagnoses WHERE patient_id = %s ORDER BY diagnosis_id DESC;", (pid,))
        diagnoses = cur.fetchall()

        cur.execute("SELECT * FROM vital_signs WHERE patient_id = %s ORDER BY vital_id DESC LIMIT 10;", (pid,))
        vitals = cur.fetchall()

        cur.execute("SELECT * FROM bills WHERE patient_id = %s ORDER BY bill_id DESC;", (pid,))
        bills = cur.fetchall()

        cur.execute("SELECT * FROM insurance_claims WHERE patient_id = %s ORDER BY claim_id DESC;", (pid,))
        claims = cur.fetchall()

        cur.execute("""
            SELECT p.prescription_id, p.status, pi.dosage, pi.frequency, pi.route, pi.duration, pi.instructions
            FROM prescriptions p
            LEFT JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
            WHERE p.patient_id = %s;
        """, (pid,))
        prescriptions = cur.fetchall()

        cur.execute("""
            SELECT lo.lab_order_id, lo.priority, lo.status, lr.test_parameter, lr.result_value, lr.unit, lr.reference_range, lr.abnormal_flag
            FROM lab_orders lo
            LEFT JOIN lab_results lr ON lo.lab_order_id = lr.lab_order_id
            WHERE lo.patient_id = %s;
        """, (pid,))
        labs = cur.fetchall()

        return {
            "success": True,
            "patient": dict(patient),
            "is_insured": len(insurance) > 0,
            "insurance": [dict(i) for i in insurance],
            "admissions": [dict(a) for a in admissions],
            "visits": [dict(v) for v in visits],
            "diagnoses": [dict(d) for d in diagnoses],
            "vital_signs": [dict(vt) for vt in vitals],
            "bills": [dict(b) for b in bills],
            "insurance_claims": [dict(c) for c in claims],
            "prescriptions": [dict(pr) for pr in prescriptions],
            "lab_orders": [dict(l) for l in labs]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
