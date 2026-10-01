from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, Dict, Any, List
import db_config
import psycopg2.extras
from api.auth_helper import require_patient_auth

router = APIRouter(prefix="/api/v1/patient", tags=["Patient Portal"])

def get_effective_patient_id(auth_user: dict, requested_patient_id: Optional[int] = None) -> int:
    """
    Enforces strict backend-level isolation:
    If the authenticated user has the 'PATIENT' role, ALWAYS return their verified token patient_id.
    Never allow a patient to override or access another patient's data.
    Only authorized clinicians/administrators may view on behalf of a patient.
    """
    role = str(auth_user.get("role", "")).upper()
    if role == "PATIENT":
        pid = auth_user.get("patient_id")
        if not pid:
            raise HTTPException(status_code=403, detail="No patient record is linked with this account.")
        return int(pid)
    
    # Authorized Clinicians / Admins
    if requested_patient_id:
        return int(requested_patient_id)
    if auth_user.get("patient_id"):
        return int(auth_user.get("patient_id"))
    raise HTTPException(status_code=400, detail="Please provide a valid patient_id.")


@router.get("/me")
@router.get("/profile")
def get_patient_profile(
    patient_id: Optional[int] = Query(None, description="Clinician override only"),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve verified demographics and profile details for the authenticated patient."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    p.id,
                    p.patient_code,
                    p.first_name,
                    p.last_name,
                    TRIM(CONCAT(p.first_name, ' ', p.last_name)) as full_name,
                    p.date_of_birth,
                    p.gender,
                    p.blood_group,
                    p.phone,
                    p.whatsapp_number,
                    p.email,
                    p.address,
                    p.city,
                    p.state,
                    p.pincode,
                    p.emergency_contact_name,
                    p.emergency_contact_phone,
                    p.marital_status,
                    p.relationship_to_contact,
                    p.preferred_language,
                    p.registration_date,
                    p.status,
                    EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth))::int as age
                FROM patients p
                WHERE p.id = %s;
            """, (pid,))
            patient = cur.fetchone()
            if not patient:
                raise HTTPException(status_code=404, detail="Patient profile not found.")
            return {"success": True, "patient": dict(patient)}


@router.get("/admissions")
def get_patient_admissions(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve all current and historical inpatient admissions for the authenticated patient."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    a.admission_id,
                    a.admission_number,
                    a.visit_id,
                    a.admission_date,
                    a.discharge_date,
                    a.admission_type,
                    a.admission_source,
                    a.reason_for_admission,
                    COALESCE(a.discharge_status, 'Admitted') as discharge_status,
                    COALESCE(d.display_name, 'Attending Physician') as doctor_name,
                    d.specialization as doctor_specialization,
                    dept.department_name,
                    w.ward_name,
                    w.ward_type,
                    b.bed_number
                FROM admissions a
                LEFT JOIN doctors d ON d.id = a.doctor_id
                LEFT JOIN departments dept ON dept.id = a.department_id
                LEFT JOIN wards w ON w.ward_id = a.ward_id
                LEFT JOIN beds b ON b.bed_id = a.bed_id
                WHERE a.patient_id = %s
                ORDER BY a.admission_date DESC;
            """, (pid,))
            admissions = cur.fetchall()
            return {"success": True, "count": len(admissions), "admissions": [dict(r) for r in admissions]}


@router.get("/diagnoses")
def get_patient_diagnoses(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve recorded clinical diagnoses for the authenticated patient."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    diag.diagnosis_id,
                    diag.diagnosis_code,
                    diag.diagnosis_name,
                    diag.diagnosis_type,
                    diag.diagnosis_date,
                    diag.is_primary,
                    diag.admission_id,
                    COALESCE(d.display_name, 'Attending Consultant') as doctor_name
                FROM diagnoses diag
                LEFT JOIN doctors d ON d.id = diag.doctor_id
                WHERE diag.patient_id = %s
                ORDER BY diag.diagnosis_date DESC, diag.is_primary DESC;
            """, (pid,))
            diagnoses = cur.fetchall()
            return {"success": True, "count": len(diagnoses), "diagnoses": [dict(r) for r in diagnoses]}


@router.get("/appointments")
def get_patient_appointments(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve outpatient appointments for the authenticated patient."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    app.id,
                    app.booking_id,
                    app.appointment_date,
                    app.appointment_time,
                    app.status,
                    app.appointment_type,
                    app.reason_for_visit,
                    app.patient_reason,
                    COALESCE(d.display_name, 'Consulting Physician') as doctor_name,
                    d.specialization as doctor_specialization,
                    dept.department_name
                FROM appointments app
                LEFT JOIN doctors d ON d.id = app.doctor_id
                LEFT JOIN departments dept ON dept.id = app.department_id
                WHERE app.patient_id = %s
                ORDER BY app.appointment_date DESC, app.appointment_time DESC;
            """, (pid,))
            appointments = cur.fetchall()
            return {"success": True, "count": len(appointments), "appointments": [dict(r) for r in appointments]}


@router.get("/vitals")
def get_patient_vitals(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve physiological vital signs recorded for the authenticated patient."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    v.vital_id,
                    v.recorded_at,
                    v.temperature,
                    v.heart_rate,
                    v.systolic_bp,
                    v.diastolic_bp,
                    CONCAT(v.systolic_bp, '/', v.diastolic_bp) as blood_pressure,
                    v.respiratory_rate,
                    v.oxygen_saturation,
                    v.weight,
                    v.recorded_by,
                    v.admission_id
                FROM vital_signs v
                WHERE v.patient_id = %s
                ORDER BY v.recorded_at DESC;
            """, (pid,))
            vitals = cur.fetchall()
            return {"success": True, "count": len(vitals), "vitals": [dict(r) for r in vitals]}


@router.get("/prescriptions")
def get_patient_prescriptions(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve prescribed medications and active pharmaceutical regimens for the authenticated patient."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    p.prescription_id,
                    p.prescription_date,
                    p.status as prescription_status,
                    p.admission_id,
                    COALESCE(d.display_name, 'Prescribing Physician') as doctor_name,
                    d.specialization as doctor_specialization,
                    pi.prescription_item_id,
                    COALESCE(m.medication_name, 'Prescribed Medicine') as medication_name,
                    m.generic_name,
                    m.brand_name,
                    m.strength,
                    m.dosage_form,
                    pi.dosage,
                    pi.frequency,
                    pi.route,
                    pi.duration,
                    pi.instructions
                FROM prescriptions p
                LEFT JOIN doctors d ON d.id = p.doctor_id
                LEFT JOIN prescription_items pi ON pi.prescription_id = p.prescription_id
                LEFT JOIN medications m ON m.medication_id = pi.medication_id
                WHERE p.patient_id = %s
                ORDER BY p.prescription_date DESC, p.prescription_id DESC;
            """, (pid,))
            rows = cur.fetchall()
            
            # Group items by prescription_id
            prescriptions_map = {}
            for r in rows:
                p_id = r["prescription_id"]
                if p_id not in prescriptions_map:
                    prescriptions_map[p_id] = {
                        "prescription_id": p_id,
                        "prescription_date": r["prescription_date"],
                        "status": r["prescription_status"],
                        "admission_id": r["admission_id"],
                        "doctor_name": r["doctor_name"],
                        "doctor_specialization": r["doctor_specialization"],
                        "items": []
                    }
                if r["prescription_item_id"]:
                    prescriptions_map[p_id]["items"].append({
                        "item_id": r["prescription_item_id"],
                        "medication_name": r["medication_name"],
                        "generic_name": r["generic_name"],
                        "strength": r["strength"],
                        "dosage_form": r["dosage_form"],
                        "dosage": r["dosage"],
                        "frequency": r["frequency"],
                        "route": r["route"],
                        "duration": r["duration"],
                        "instructions": r["instructions"]
                    })
                    
            return {
                "success": True, 
                "count": len(prescriptions_map), 
                "prescriptions": list(prescriptions_map.values())
            }


@router.get("/lab-results")
def get_patient_lab_results(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve laboratory orders, panels, and verified diagnostic test results."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    lo.lab_order_id,
                    lo.ordered_date,
                    lo.priority,
                    lo.status as order_status,
                    lo.admission_id,
                    COALESCE(lt.test_name, 'Diagnostic Laboratory Panel') as test_name,
                    lt.test_category,
                    lt.sample_type,
                    COALESCE(d.display_name, 'Ordering Physician') as doctor_name,
                    lr.lab_result_id,
                    lr.test_parameter,
                    lr.result_value,
                    lr.unit,
                    lr.reference_range,
                    lr.abnormal_flag,
                    lr.verification_status,
                    lr.result_date
                FROM lab_orders lo
                LEFT JOIN lab_tests lt ON lt.lab_test_id = lo.lab_test_id
                LEFT JOIN doctors d ON d.id = lo.doctor_id
                LEFT JOIN lab_results lr ON lr.lab_order_id = lo.lab_order_id
                WHERE lo.patient_id = %s
                ORDER BY lo.ordered_date DESC, lo.lab_order_id DESC;
            """, (pid,))
            rows = cur.fetchall()
            
            orders_map = {}
            for r in rows:
                o_id = r["lab_order_id"]
                if o_id not in orders_map:
                    orders_map[o_id] = {
                        "lab_order_id": o_id,
                        "ordered_date": r["ordered_date"],
                        "priority": r["priority"],
                        "status": r["order_status"],
                        "test_name": r["test_name"],
                        "test_category": r["test_category"],
                        "sample_type": r["sample_type"],
                        "doctor_name": r["doctor_name"],
                        "admission_id": r["admission_id"],
                        "results": []
                    }
                if r["lab_result_id"]:
                    orders_map[o_id]["results"].append({
                        "result_id": r["lab_result_id"],
                        "test_parameter": r["test_parameter"],
                        "result_value": r["result_value"],
                        "unit": r["unit"],
                        "reference_range": r["reference_range"],
                        "abnormal_flag": r["abnormal_flag"] or "NORMAL",
                        "verification_status": r["verification_status"],
                        "result_date": r["result_date"]
                    })
                    
            return {
                "success": True, 
                "count": len(orders_map), 
                "lab_orders": list(orders_map.values())
            }


@router.get("/bills")
def get_patient_bills(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve inpatient & outpatient invoices, itemized bills, and payment statuses."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    b.bill_id,
                    b.bill_number,
                    b.bill_date,
                    b.gross_amount,
                    b.discount_amount,
                    b.tax_amount,
                    b.net_amount,
                    b.insurance_amount,
                    b.patient_amount,
                    b.bill_status,
                    b.admission_id
                FROM bills b
                WHERE b.patient_id = %s
                ORDER BY b.bill_date DESC;
            """, (pid,))
            bills = cur.fetchall()
            return {"success": True, "count": len(bills), "bills": [dict(r) for r in bills]}


@router.get("/insurance")
def get_patient_insurance(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve insurance provider claims, approval statuses, and coverage details."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    ic.claim_id,
                    ic.claim_number,
                    ic.insurance_provider,
                    ic.policy_number,
                    ic.claim_date,
                    ic.claimed_amount,
                    ic.approved_amount,
                    ic.rejected_amount,
                    ic.settled_amount,
                    ic.outstanding_amount,
                    ic.claim_status,
                    ic.rejection_reason,
                    ic.settlement_date,
                    ic.bill_id
                FROM insurance_claims ic
                WHERE ic.patient_id = %s
                ORDER BY ic.claim_date DESC;
            """, (pid,))
            claims = cur.fetchall()
            return {"success": True, "count": len(claims), "claims": [dict(r) for r in claims]}


@router.get("/discharge-summaries")
def get_patient_discharge_summaries(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve clinical discharge summaries, discharge instructions, and recovery advice."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Only return completed & approved discharge summaries to the patient
            # Unapproved / Pending Approval summaries must remain restricted to clinical staff
            cur.execute("""
                SELECT 
                    ds.summary_id,
                    ds.admission_id,
                    ds.admission_date,
                    ds.discharge_date,
                    ds.diagnoses,
                    ds.case_history,
                    ds.investigations,
                    ds.treatment,
                    ds.primary_consultant,
                    ds.discharge_advice,
                    ds.surgery_details,
                    ds.patient_condition,
                    ds.generated_at,
                    UPPER(TRIM(COALESCE(ds.approval_status, 'APPROVED'))) as approval_status
                FROM dim_generated_discharge_summaries ds
                WHERE ds.patient_id = %s
                  AND UPPER(TRIM(COALESCE(ds.approval_status, ''))) IN ('APPROVED', 'COMPLETED')
                ORDER BY ds.generated_at DESC;
            """, (pid,))
            summaries = cur.fetchall()
            
            # If empty, fallback to discharge_summaries table (only if completed/approved)
            if not summaries:
                cur.execute("""
                    SELECT 
                        summary_id,
                        admission_id,
                        admission_date,
                        discharge_date,
                        diagnoses,
                        case_history,
                        investigations,
                        treatment,
                        primary_consultant,
                        discharge_advice,
                        surgery_details,
                        patient_condition,
                        generated_at,
                        'APPROVED' as approval_status
                    FROM discharge_summaries
                    WHERE patient_id = %s
                    ORDER BY generated_at DESC;
                """, (pid,))
                summaries = cur.fetchall()
                
            return {"success": True, "count": len(summaries), "summaries": [dict(r) for r in summaries]}


@router.get("/notifications")
def get_patient_notifications(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """Retrieve health updates, appointment reminders, and billing notifications for the patient."""
    pid = get_effective_patient_id(auth_user, patient_id)
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    n.id,
                    n.notification_type,
                    n.channel,
                    n.message,
                    n.reason,
                    n.status,
                    n.sent_at,
                    n.created_at
                FROM notifications n
                WHERE n.patient_id = %s
                ORDER BY n.created_at DESC;
            """, (pid,))
            notifs = cur.fetchall()
            return {"success": True, "count": len(notifs), "notifications": [dict(r) for r in notifs]}


@router.get("/dashboard")
def get_patient_dashboard(
    patient_id: Optional[int] = Query(None),
    auth_user: dict = Depends(require_patient_auth)
):
    """
    Consolidated, single-query high-performance patient portal summary.
    Returns demographics, current admission, upcoming appointments, active prescriptions,
    recent lab tests, billing status, and vital trends.
    """
    pid = get_effective_patient_id(auth_user, patient_id)
    
    with db_config.get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Profile
            cur.execute("""
                SELECT 
                    p.id, p.patient_code, p.first_name, p.last_name,
                    TRIM(CONCAT(p.first_name, ' ', p.last_name)) as full_name,
                    p.date_of_birth, p.gender, p.blood_group, p.phone, p.email,
                    p.address, p.city, p.state, p.pincode,
                    p.emergency_contact_name, p.emergency_contact_phone,
                    p.marital_status, p.status,
                    EXTRACT(YEAR FROM age(CURRENT_DATE, p.date_of_birth))::int as age
                FROM patients p WHERE p.id = %s;
            """, (pid,))
            patient = cur.fetchone()
            if not patient:
                raise HTTPException(status_code=404, detail="Patient profile not found.")

            # 2. Current / Recent Admissions
            cur.execute("""
                SELECT 
                    a.admission_id, a.admission_number, a.admission_date, a.discharge_date,
                    a.admission_type, a.reason_for_admission,
                    COALESCE(a.discharge_status, 'Admitted') as discharge_status,
                    COALESCE(d.display_name, 'Attending Physician') as doctor_name,
                    d.specialization as doctor_specialization,
                    dept.department_name, w.ward_name, b.bed_number
                FROM admissions a
                LEFT JOIN doctors d ON d.id = a.doctor_id
                LEFT JOIN departments dept ON dept.id = a.department_id
                LEFT JOIN wards w ON w.ward_id = a.ward_id
                LEFT JOIN beds b ON b.bed_id = a.bed_id
                WHERE a.patient_id = %s
                ORDER BY a.admission_date DESC;
            """, (pid,))
            admissions = cur.fetchall()

            # 3. Diagnoses
            cur.execute("""
                SELECT 
                    diag.diagnosis_id, diag.diagnosis_code, diag.diagnosis_name,
                    diag.diagnosis_type, diag.diagnosis_date, diag.is_primary,
                    COALESCE(d.display_name, 'Attending Consultant') as doctor_name
                FROM diagnoses diag
                LEFT JOIN doctors d ON d.id = diag.doctor_id
                WHERE diag.patient_id = %s
                ORDER BY diag.diagnosis_date DESC;
            """, (pid,))
            diagnoses = cur.fetchall()

            # 4. Appointments
            cur.execute("""
                SELECT 
                    app.id, app.booking_id, app.appointment_date, app.appointment_time,
                    app.status, app.appointment_type, app.reason_for_visit,
                    COALESCE(d.display_name, 'Consulting Physician') as doctor_name,
                    d.specialization as doctor_specialization, dept.department_name
                FROM appointments app
                LEFT JOIN doctors d ON d.id = app.doctor_id
                LEFT JOIN departments dept ON dept.id = app.department_id
                WHERE app.patient_id = %s
                ORDER BY app.appointment_date DESC;
            """, (pid,))
            appointments = cur.fetchall()

            # 5. Vitals
            cur.execute("""
                SELECT 
                    v.vital_id, v.recorded_at, v.temperature, v.heart_rate,
                    v.systolic_bp, v.diastolic_bp,
                    CONCAT(v.systolic_bp, '/', v.diastolic_bp) as blood_pressure,
                    v.respiratory_rate, v.oxygen_saturation, v.weight, v.recorded_by
                FROM vital_signs v
                WHERE v.patient_id = %s
                ORDER BY v.recorded_at DESC
                LIMIT 10;
            """, (pid,))
            vitals = cur.fetchall()

            # 6. Prescriptions with Items
            cur.execute("""
                SELECT 
                    p.prescription_id, p.prescription_date, p.status,
                    COALESCE(d.display_name, 'Prescribing Physician') as doctor_name,
                    d.specialization as doctor_specialization,
                    pi.prescription_item_id,
                    COALESCE(m.medication_name, 'Prescribed Medicine') as medication_name,
                    m.generic_name, m.dosage_form, m.strength,
                    pi.dosage, pi.frequency, pi.route, pi.duration, pi.instructions
                FROM prescriptions p
                LEFT JOIN doctors d ON d.id = p.doctor_id
                LEFT JOIN prescription_items pi ON pi.prescription_id = p.prescription_id
                LEFT JOIN medications m ON m.medication_id = pi.medication_id
                WHERE p.patient_id = %s
                ORDER BY p.prescription_date DESC;
            """, (pid,))
            rx_rows = cur.fetchall()
            prescriptions_map = {}
            for r in rx_rows:
                p_id = r["prescription_id"]
                if p_id not in prescriptions_map:
                    prescriptions_map[p_id] = {
                        "prescription_id": p_id,
                        "prescription_date": r["prescription_date"],
                        "status": r["status"],
                        "doctor_name": r["doctor_name"],
                        "doctor_specialization": r["doctor_specialization"],
                        "items": []
                    }
                if r["prescription_item_id"]:
                    prescriptions_map[p_id]["items"].append({
                        "item_id": r["prescription_item_id"],
                        "medication_name": r["medication_name"],
                        "generic_name": r["generic_name"],
                        "dosage_form": r["dosage_form"],
                        "strength": r["strength"],
                        "dosage": r["dosage"],
                        "frequency": r["frequency"],
                        "route": r["route"],
                        "duration": r["duration"],
                        "instructions": r["instructions"]
                    })

            # 7. Lab Results
            cur.execute("""
                SELECT 
                    lo.lab_order_id, lo.ordered_date, lo.priority, lo.status,
                    COALESCE(lt.test_name, 'Diagnostic Laboratory Panel') as test_name,
                    lt.test_category, lt.sample_type,
                    COALESCE(d.display_name, 'Ordering Physician') as doctor_name,
                    lr.lab_result_id, lr.test_parameter, lr.result_value, lr.unit,
                    lr.reference_range, lr.abnormal_flag, lr.verification_status, lr.result_date
                FROM lab_orders lo
                LEFT JOIN lab_tests lt ON lt.lab_test_id = lo.lab_test_id
                LEFT JOIN doctors d ON d.id = lo.doctor_id
                LEFT JOIN lab_results lr ON lr.lab_order_id = lo.lab_order_id
                WHERE lo.patient_id = %s
                ORDER BY lo.ordered_date DESC;
            """, (pid,))
            lab_rows = cur.fetchall()
            lab_map = {}
            for r in lab_rows:
                o_id = r["lab_order_id"]
                if o_id not in lab_map:
                    lab_map[o_id] = {
                        "lab_order_id": o_id,
                        "ordered_date": r["ordered_date"],
                        "priority": r["priority"],
                        "status": r["status"],
                        "test_name": r["test_name"],
                        "test_category": r["test_category"],
                        "sample_type": r["sample_type"],
                        "doctor_name": r["doctor_name"],
                        "results": []
                    }
                if r["lab_result_id"]:
                    lab_map[o_id]["results"].append({
                        "result_id": r["lab_result_id"],
                        "test_parameter": r["test_parameter"],
                        "result_value": r["result_value"],
                        "unit": r["unit"],
                        "reference_range": r["reference_range"],
                        "abnormal_flag": r["abnormal_flag"] or "NORMAL",
                        "verification_status": r["verification_status"],
                        "result_date": r["result_date"]
                    })

            # 8. Bills
            cur.execute("""
                SELECT 
                    b.bill_id, b.bill_number, b.bill_date, b.gross_amount,
                    b.discount_amount, b.tax_amount, b.net_amount,
                    b.insurance_amount, b.patient_amount, b.bill_status
                FROM bills b
                WHERE b.patient_id = %s
                ORDER BY b.bill_date DESC;
            """, (pid,))
            bills = cur.fetchall()

            # 9. Insurance Claims
            cur.execute("""
                SELECT 
                    ic.claim_id, ic.claim_number, ic.insurance_provider,
                    ic.policy_number, ic.claim_date, ic.claimed_amount,
                    ic.approved_amount, ic.rejected_amount, ic.settled_amount,
                    ic.outstanding_amount, ic.claim_status, ic.rejection_reason,
                    ic.settlement_date
                FROM insurance_claims ic
                WHERE ic.patient_id = %s
                ORDER BY ic.claim_date DESC;
            """, (pid,))
            claims = cur.fetchall()

            # 10. Discharge Summaries
            cur.execute("""
                SELECT 
                    ds.summary_id, ds.admission_id, ds.admission_date, ds.discharge_date,
                    ds.diagnoses, ds.case_history, ds.investigations, ds.treatment,
                    ds.primary_consultant, ds.discharge_advice, ds.surgery_details,
                    ds.patient_condition, ds.generated_at,
                    COALESCE(ds.approval_status, 'APPROVED') as approval_status
                FROM dim_generated_discharge_summaries ds
                WHERE ds.patient_id = %s
                ORDER BY ds.generated_at DESC;
            """, (pid,))
            summaries = cur.fetchall()

            # 11. Notifications
            cur.execute("""
                SELECT 
                    n.id, n.notification_type, n.channel, n.message,
                    n.reason, n.status, n.sent_at, n.created_at
                FROM notifications n
                WHERE n.patient_id = %s
                ORDER BY n.created_at DESC;
            """, (pid,))
            notifs = cur.fetchall()

            # Overview KPIs calculation
            active_admission = next((a for a in admissions if str(a.get("discharge_status", "")).lower() in {"admitted", "active", "inpatient"}), None)
            total_bills_count = len(bills)
            total_net_billed = sum(float(b.get("net_amount") or 0) for b in bills)
            total_patient_payable = sum(float(b.get("patient_amount") or 0) for b in bills if str(b.get("bill_status", "")).lower() != "paid")
            
            return {
                "success": True,
                "data": {
                    "patient": dict(patient),
                    "active_admission": dict(active_admission) if active_admission else None,
                    "admissions": [dict(r) for r in admissions],
                    "diagnoses": [dict(r) for r in diagnoses],
                    "appointments": [dict(r) for r in appointments],
                    "vitals": [dict(r) for r in vitals],
                    "prescriptions": list(prescriptions_map.values()),
                    "lab_orders": list(lab_map.values()),
                    "bills": [dict(r) for r in bills],
                    "insurance_claims": [dict(r) for r in claims],
                    "discharge_summaries": [dict(r) for r in summaries],
                    "notifications": [dict(r) for r in notifs],
                    "metrics": {
                        "total_admissions": len(admissions),
                        "total_appointments": len(appointments),
                        "active_prescriptions": len(prescriptions_map),
                        "lab_orders_count": len(lab_map),
                        "total_billed": round(total_net_billed, 2),
                        "outstanding_payable": round(total_patient_payable, 2),
                        "has_discharge_summary": len(summaries) > 0,
                        "unread_notifications": len(notifs)
                    }
                }
            }
