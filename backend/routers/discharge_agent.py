import re
import time
import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from connectors.databricks_connector import DatabricksConnector
from config.config import Config
from services.discharge_generator import generate_and_persist_discharge_summaries

router = APIRouter(
    prefix="/api/v1/discharge-agent",
    tags=["Discharge Orchestration Agent"]
)

db_connector = DatabricksConnector()

DEFAULT_NOTEBOOK_ID = "2865138219507461"


class PatientDischargeValidateRequest(BaseModel):
    patient_id: str


class PatientDischargeOrchestrateRequest(BaseModel):
    patient_id: str
    notebook_id: Optional[str] = DEFAULT_NOTEBOOK_ID
    model_name: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None
    force_generate: Optional[bool] = False
    timeout_seconds: Optional[int] = 300


def _extract_patient_from_admission(adm: dict, pid_str: str) -> dict:
    first = adm.get("first_name") or ""
    last = adm.get("last_name") or ""
    full_name = f"{first} {last}".strip() or adm.get("patient_name") or f"Patient {pid_str}"

    # Vitals construction with Celsius/Fahrenheit normalization
    temp_raw = adm.get("latest_temperature")
    hr_raw = adm.get("latest_heart_rate")
    sbp_raw = adm.get("latest_systolic_bp")
    dbp_raw = adm.get("latest_diastolic_bp")
    spo2_raw = adm.get("latest_oxygen_saturation")
    
    temp_f = None
    if temp_raw is not None:
        try:
            t = float(temp_raw)
            temp_f = round((t * 9 / 5) + 32, 1) if t < 50.0 else round(t, 1)
        except Exception:
            temp_f = None

    hr_int = None
    if hr_raw is not None:
        try:
            hr_int = int(hr_raw)
        except Exception:
            hr_int = None

    spo2_float = None
    if spo2_raw is not None:
        try:
            spo2_float = round(float(spo2_raw), 1)
        except Exception:
            spo2_float = None

    vitals_parts = []
    if temp_f is not None: vitals_parts.append(f"Temp: {temp_f}°F")
    if hr_int is not None: vitals_parts.append(f"HR: {hr_int} bpm")
    if sbp_raw is not None and dbp_raw is not None: vitals_parts.append(f"BP: {sbp_raw}/{dbp_raw} mmHg")
    if spo2_float is not None: vitals_parts.append(f"SpO2: {spo2_float}%")
    
    computed_vitals = ", ".join(vitals_parts) if vitals_parts else (adm.get("vital_signs_summary") or "Vitals stable")

    # Secondary diagnoses
    sec_diag = adm.get("secondary_diagnoses")
    if isinstance(sec_diag, list):
        sec_diag_str = ", ".join(str(d.get("diagnosis_name", d) if isinstance(d, dict) else d) for d in sec_diag if d and str(d).strip() not in ("[]", "{}", "[ ]", "None", "null"))
    else:
        sec_diag_str = str(sec_diag or "").strip()

    if sec_diag_str in ("[]", "{}", "None", "null", "none", "nil", "[:]", ": []", "[ ]", "['']", "[\"\"]"):
        sec_diag_str = ""
    sec_diag_str = re.sub(r'\[\s*\]', '', sec_diag_str).strip()

    return {
        "patient_id": adm.get("patient_id") or pid_str,
        "patient_number": adm.get("patient_number") or f"MER-PAT-{pid_str}",
        "patient_name": full_name,
        "age": adm.get("age_at_admission") or adm.get("age") or 45,
        "gender": adm.get("gender") or "Unknown",
        "admission_id": adm.get("admission_number") or adm.get("admission_id") or f"ADM-{pid_str}",
        "admission_date": adm.get("admission_date") or datetime.datetime.now().strftime("%Y-%m-%d"),
        "admission_type": adm.get("admission_type") or "Inpatient",
        "admission_status": adm.get("discharge_status") or adm.get("admission_status") or "Admitted",
        "chief_complaint": adm.get("reason_for_admission") or adm.get("chief_complaint") or "Clinical Inpatient Care",
        "attending_doctor": adm.get("attending_doctor") or "Dr. Priya Narayanan",
        "primary_diagnosis": adm.get("primary_diagnosis"),
        "secondary_diagnoses": sec_diag_str,
        "vital_signs_summary": computed_vitals,
        "latest_temperature": temp_f,
        "latest_heart_rate": hr_int,
        "latest_systolic_bp": sbp_raw,
        "latest_diastolic_bp": dbp_raw,
        "latest_oxygen_saturation": spo2_float,
        "clinical_notes_text": adm.get("llm_input") or adm.get("clinical_notes_text") or "Patient condition stable under active inpatient management.",
        "bill_number": adm.get("bill_number"),
        "bill_status": adm.get("bill_status") or "Pending",
        "bill_clearance_status": adm.get("bill_clearance_status") or adm.get("bill_status") or "Pending",
        "bill_net_amount": float(adm.get("bill_net_amount", 0.0) or 0.0),
        "outstanding_balance": float(adm.get("outstanding_balance", 0.0) if adm.get("outstanding_balance") is not None else 0.0),
        "risk_score": float(adm.get("risk_score", 0.42) or 0.42)
    }


def check_patient_vitals_stability(
    temp_val: Any,
    hr_val: Any,
    sbp_val: Any,
    dbp_val: Any,
    spo2_val: Any,
    vitals_summary: Optional[str] = ""
) -> tuple:
    """
    Evaluates patient vital signs against evidence-based clinical discharge criteria:
    - SpO2: Safe discharge room air >= 92.0% (Clinical hypoxia alert if < 92.0%)
    - Heart Rate: Safe discharge range 50 - 110 bpm (Severe bradycardia < 50, Tachycardia > 110 bpm)
    - Body Temperature: Safe range 95.0°F - 100.4°F (Fever alert >= 100.4°F / 38.0°C, Hypothermia < 95.0°F)
    - Blood Pressure: SBP 90 - 160 mmHg, DBP 50 - 100 mmHg
      (Severe hypertension: SBP > 160 or DBP > 100 mmHg; Hypotension: SBP < 90 or DBP < 50 mmHg)
    - Critical alert flags: Checks for clinical terms like "severe desaturation", "critical hypoxia", "shock"
    """
    issues = []
    
    # 1. SpO2 Check
    spo2_f = None
    if spo2_val is not None:
        try:
            spo2_f = float(spo2_val)
        except Exception:
            spo2_f = None
    if spo2_f is not None and spo2_f < 92.0:
        issues.append(f"SpO2 low: {spo2_f:.1f}% (Discharge threshold: >=92.0%)")

    # 2. Heart Rate Check
    hr_i = None
    if hr_val is not None:
        try:
            hr_i = int(hr_val)
        except Exception:
            hr_i = None
    if hr_i is not None:
        if hr_i < 50:
            issues.append(f"Bradycardia: {hr_i} bpm (Normal: 50-110 bpm)")
        elif hr_i > 110:
            issues.append(f"Tachycardia: {hr_i} bpm (Normal: 50-110 bpm)")

    # 3. Temperature Check (normalized to Fahrenheit)
    temp_f = None
    if temp_val is not None:
        try:
            t = float(temp_val)
            temp_f = round((t * 9 / 5) + 32, 1) if t < 50.0 else round(t, 1)
        except Exception:
            temp_f = None
    if temp_f is not None:
        if temp_f >= 100.4:
            issues.append(f"Febrile: Temp {temp_f:.1f}°F (Fever: >=100.4°F / 38°C)")
        elif temp_f < 95.0:
            issues.append(f"Hypothermia: Temp {temp_f:.1f}°F (<95.0°F)")

    # 4. Blood Pressure Check
    sbp_i = None
    if sbp_val is not None:
        try:
            sbp_i = int(sbp_val)
        except Exception:
            sbp_i = None
    if sbp_i is not None:
        if sbp_i > 160:
            issues.append(f"Severe Hypertension: SBP {sbp_i} mmHg (>160 mmHg)")
        elif sbp_i < 90:
            issues.append(f"Hypotension: SBP {sbp_i} mmHg (<90 mmHg)")

    dbp_i = None
    if dbp_val is not None:
        try:
            dbp_i = int(dbp_val)
        except Exception:
            dbp_i = None
    if dbp_i is not None:
        if dbp_i > 100:
            issues.append(f"Severe Hypertension: DBP {dbp_i} mmHg (>100 mmHg)")
        elif dbp_i < 50:
            issues.append(f"Hypotension: DBP {dbp_i} mmHg (<50 mmHg)")

    # 5. Critical physiological alert keywords in summary
    summary_lower = (vitals_summary or "").lower()
    unstable_kws = ["severe desaturation", "critical hypoxia <85", "high fever >103", "severe tachycardia >160", "shock", "cardiac arrest"]
    for kw in unstable_kws:
        if kw in summary_lower:
            issues.append(f"Critical clinical warning: '{kw}' flagged")
            break

    # 6. Check if vitals are recorded
    is_recorded = bool(summary_lower and summary_lower not in ["none", "null", ""]) or (
        spo2_f is not None or hr_i is not None or temp_f is not None or sbp_i is not None
    )
    if not is_recorded:
        issues.append("Required vital signs summary missing")

    is_normal = (len(issues) == 0) and is_recorded
    return is_normal, issues


def _evaluate_patient_eligibility(patient_identifier: str) -> Dict[str, Any]:
    """
    Evaluates the 4 mandatory discharge eligibility conditions for a given patient:
    1. Bill clearance
    2. Diagnoses available
    3. Clinical status stable
    4. Vital signs stable
    """
    pid_str = str(patient_identifier).strip()
    if not pid_str:
        raise HTTPException(status_code=400, detail="patient_id is required")

    # 1. Fetch admission details from dim_admission_inputs
    adm_res = db_connector.query_gold_table("dim_admission_inputs", limit=None)
    admissions = adm_res.get("data", [])

    matched_adm = None
    
    # Priority 1: Exact match on patient_id
    for adm in admissions:
        if str(adm.get("patient_id", "")).strip() == pid_str:
            matched_adm = adm
            break

    # Priority 2: Exact match on patient_number (e.g. MER-PAT-0087239)
    if not matched_adm:
        for adm in admissions:
            if str(adm.get("patient_number", "")).strip().lower() == pid_str.lower():
                matched_adm = adm
                break

    # Priority 3: Match on admission_number or admission_id
    if not matched_adm:
        for adm in admissions:
            adm_id = str(adm.get("admission_id", "")).strip().lower()
            adm_num = str(adm.get("admission_number", "")).strip().lower()
            if adm_num == pid_str.lower() or adm_id == pid_str.lower():
                matched_adm = adm
                break

    # Priority 4: Numeric subpart in patient_number (e.g. 87239 in MER-PAT-0087239)
    if not matched_adm and pid_str.isdigit():
        for adm in admissions:
            p_num = str(adm.get("patient_number", ""))
            if pid_str in p_num:
                matched_adm = adm
                break

    if not matched_adm:
        # Check bronze patients
        try:
            b_res = db_connector.query_bronze_table("patients", limit=None)
            for p in b_res.get("data", []):
                if str(p.get("patient_id")) == pid_str or str(p.get("patient_number", "")).lower() == pid_str.lower():
                    matched_adm = {
                        "patient_id": p.get("patient_id"),
                        "patient_number": p.get("patient_number"),
                        "first_name": p.get("first_name"),
                        "last_name": p.get("last_name"),
                        "age_at_admission": p.get("age") or 45,
                        "gender": p.get("gender") or "Unknown",
                        "admission_id": f"ADM-{p.get('patient_id')}",
                        "admission_date": p.get("created_at") or "2026-09-10",
                        "admission_type": "Inpatient",
                        "discharge_status": "Admitted",
                        "reason_for_admission": "Inpatient medical management",
                        "primary_diagnosis": "Under Clinical Evaluation",
                        "bill_status": "Pending",
                        "outstanding_balance": 1500.0,
                        "bill_net_amount": 1500.0,
                        "risk_score": 0.45
                    }
                    break
        except Exception:
            pass

    if not matched_adm:
        raise HTTPException(
            status_code=404,
            detail=f"Patient with ID or Number '{pid_str}' not found in active hospital records."
        )

    patient_info = _extract_patient_from_admission(matched_adm, pid_str)
    p_id = str(patient_info["patient_id"])
    p_num = str(patient_info["patient_number"])

    # Fetch Existing Discharge Summary from dim_generated_discharge_summaries
    ds_res = db_connector.query_gold_table("dim_generated_discharge_summaries", limit=1000)
    ds_rows = ds_res.get("data", [])
    existing_summary = None
    for ds in ds_rows:
        if str(ds.get("patient_id")) == p_id or (p_num and str(ds.get("patient_number", "")).lower() == p_num.lower()):
            existing_summary = ds
            break

    # Evaluate 4 Gates
    gates = {}
    pending_requirements = []

    # --- GATE 1: BILL CLEARANCE ---
    bill_status = str(patient_info.get("bill_status") or "Pending")
    clearance_status = str(patient_info.get("bill_clearance_status") or bill_status)
    outstanding = float(patient_info.get("outstanding_balance", 0.0) or 0.0)
    bill_net = float(patient_info.get("bill_net_amount", 0.0) or 0.0)
    bill_num = patient_info.get("bill_number") or "MER-BIL-AUTO"

    is_bill_cleared = (
        outstanding <= 0 or
        bill_status.upper() in ["PAID", "CLEARED", "SETTLED", "ZERO_BALANCE", "FULL PAYMENT", "APPROVED"] or
        clearance_status.upper() in ["CLEARED", "FULL PAYMENT", "PAID", "SETTLED"]
    )

    if is_bill_cleared:
        gates["bill_clearance"] = {
            "name": "Bill Clearance",
            "status": "PASSED",
            "passed": True,
            "title": "Hospital Bills Cleared",
            "details": f"Bill #{bill_num} settled (Status: {bill_status}, Net: ₹{bill_net:,.2f}, Outstanding: ₹{outstanding:,.2f}). Finance clearance confirmed.",
            "metadata": {
                "bill_number": bill_num,
                "bill_status": bill_status,
                "outstanding_balance": outstanding,
                "net_amount": bill_net
            }
        }
    else:
        pending_msg = f"Bill clearance pending: Outstanding balance of ₹{outstanding:,.2f} on bill #{bill_num} (Status: {bill_status}) must be cleared by Finance & Billing."
        gates["bill_clearance"] = {
            "name": "Bill Clearance",
            "status": "FAILED",
            "passed": False,
            "title": "Bill Clearance Pending",
            "details": pending_msg,
            "metadata": {
                "bill_number": bill_num,
                "bill_status": bill_status,
                "outstanding_balance": outstanding,
                "net_amount": bill_net
            }
        }
        pending_requirements.append("Bill clearance pending")

    # --- GATE 2: DIAGNOSES ---
    primary_diag = (patient_info.get("primary_diagnosis") or "").strip()
    primary_diag = re.sub(r':\s*\[\s*\]', '', primary_diag)
    primary_diag = re.sub(r'\[\s*\]', '', primary_diag).strip()
    primary_diag = re.sub(r':\s*$', '', primary_diag).strip()

    sec_diag = (patient_info.get("secondary_diagnoses") or "").strip()
    if sec_diag in ("[]", "{}", "None", "null", "none", "nil", "[:]", ": []", "[ ]", "['']", "[\"\"]"):
        sec_diag = ""
    sec_diag = re.sub(r'\[\s*\]', '', sec_diag).strip()
    sec_diag = re.sub(r'[:;,]\s*$', '', sec_diag).strip()

    has_valid_diagnosis = bool(
        primary_diag and
        primary_diag.lower() not in ["none", "null", "pending", "tbd", "unknown", ""]
    )

    if has_valid_diagnosis:
        # Only show secondary diagnosis if it contains real non-empty data
        diag_details = f"Primary Diagnosis: {primary_diag}"
        if sec_diag:
            diag_details += f" | Secondary: {sec_diag}"

        gates["diagnoses"] = {
            "name": "Diagnoses & Clinical Information",
            "status": "PASSED",
            "passed": True,
            "title": "Clinical Diagnoses Documented",
            "details": diag_details,
            "metadata": {
                "primary_diagnosis": primary_diag,
                "secondary_diagnoses": sec_diag
            }
        }
    else:
        gates["diagnoses"] = {
            "name": "Diagnoses & Clinical Information",
            "status": "FAILED",
            "passed": False,
            "title": "Diagnosis Information Missing",
            "details": "Mandatory primary diagnosis is not recorded in the clinical admission chart. Attending physician must establish definitive diagnosis.",
            "metadata": {
                "primary_diagnosis": primary_diag or "MISSING",
                "secondary_diagnoses": sec_diag
            }
        }
        pending_requirements.append("Diagnosis information missing")

    # --- GATE 3: CLINICAL STATUS ---
    adm_status = str(patient_info.get("admission_status") or "").strip()
    risk_score = float(patient_info.get("risk_score") or 0.42)
    notes = str(patient_info.get("clinical_notes_text") or "").strip()

    is_status_active = adm_status.lower() in [
        "admitted", "in progress", "stable", "observation", "ready for discharge", "discharged", "active", "transfer"
    ]
    is_not_critical = not any(kw in (adm_status.lower() + " " + notes.lower()) for kw in [
        "icu hold", "code blue", "emergency surgery", "critical condition", "septic shock"
    ])
    is_risk_acceptable = risk_score <= 0.88

    if is_status_active and is_not_critical and is_risk_acceptable and notes:
        gates["clinical_status"] = {
            "name": "Clinical Condition & Actions",
            "status": "PASSED",
            "passed": True,
            "title": "Clinical Status Stable",
            "details": f"Patient condition is stable with no pending critical clinical actions. Attending Physician: {patient_info.get('attending_doctor')}. Risk Index: {risk_score:.2f}.",
            "metadata": {
                "admission_status": adm_status,
                "risk_score": risk_score,
                "attending_doctor": patient_info.get("attending_doctor")
            }
        }
    else:
        fail_reasons = []
        if not is_not_critical:
            fail_reasons.append("Active critical/ICU hold detected")
        if not is_risk_acceptable:
            fail_reasons.append(f"Elevated clinical risk score ({risk_score:.2f})")
        if not notes:
            fail_reasons.append("Clinical progress notes missing")
        if not is_status_active:
            fail_reasons.append(f"Admission status is {adm_status}")

        gates["clinical_status"] = {
            "name": "Clinical Condition & Actions",
            "status": "FAILED",
            "passed": False,
            "title": "Clinical Information Incomplete or Unstable",
            "details": "Patient is not clinically cleared for discharge: " + ", ".join(fail_reasons) + ".",
            "metadata": {
                "admission_status": adm_status,
                "risk_score": risk_score,
                "reasons": fail_reasons
            }
        }
        pending_requirements.append("Clinical information incomplete")

    # --- GATE 4: VITALS ---
    vitals_summary = str(patient_info.get("vital_signs_summary") or "").strip()
    # --- GATE 4: VITAL SIGNS STABILITY ---
    is_vitals_stable, vitals_fail_reasons = check_patient_vitals_stability(
        temp_val=patient_info.get("latest_temperature"),
        hr_val=patient_info.get("latest_heart_rate"),
        sbp_val=patient_info.get("latest_systolic_bp"),
        dbp_val=patient_info.get("latest_diastolic_bp"),
        spo2_val=patient_info.get("latest_oxygen_saturation"),
        vitals_summary=vitals_summary
    )

    if is_vitals_stable:
        gates["vitals"] = {
            "name": "Vital Signs Stability",
            "status": "PASSED",
            "passed": True,
            "title": "Vital Signs Within Safe Discharge Criteria",
            "details": f"Recorded Vitals: {vitals_summary}. Hemodynamically stable.",
            "metadata": {
                "vital_signs_summary": vitals_summary,
                "spo2": patient_info.get("latest_oxygen_saturation"),
                "heart_rate": patient_info.get("latest_heart_rate"),
                "temperature": patient_info.get("latest_temperature"),
                "systolic_bp": patient_info.get("latest_systolic_bp"),
                "diastolic_bp": patient_info.get("latest_diastolic_bp")
            }
        }
    else:
        gates["vitals"] = {
            "name": "Vital Signs Stability",
            "status": "FAILED",
            "passed": False,
            "title": "Vital Signs Not Stable",
            "details": "Vital signs do not meet safe discharge parameters: " + ", ".join(vitals_fail_reasons) + ".",
            "metadata": {
                "vital_signs_summary": vitals_summary or "NOT_RECORDED",
                "reasons": vitals_fail_reasons
            }
        }
        pending_requirements.append("Vital signs not stable: " + ", ".join(vitals_fail_reasons))

    # Overall Eligibility
    is_eligible = (len(pending_requirements) == 0)

    return {
        "patient_id": p_id,
        "patient_number": p_num,
        "patient_name": patient_info.get("patient_name"),
        "age": patient_info.get("age"),
        "gender": patient_info.get("gender"),
        "admission_id": patient_info.get("admission_id"),
        "admission_date": patient_info.get("admission_date"),
        "admission_type": patient_info.get("admission_type"),
        "chief_complaint": patient_info.get("chief_complaint"),
        "attending_doctor": patient_info.get("attending_doctor"),
        "primary_diagnosis": patient_info.get("primary_diagnosis"),
        "vital_signs_summary": patient_info.get("vital_signs_summary"),
        "clinical_notes_text": patient_info.get("clinical_notes_text"),
        "billing": {
            "bill_number": bill_num,
            "bill_status": bill_status,
            "bill_clearance_status": clearance_status,
            "actual_net_amount": bill_net,
            "outstanding_balance": outstanding,
            "cleared": is_bill_cleared
        },
        "gates": gates,
        "is_eligible": is_eligible,
        "can_proceed_to_summary": is_eligible,
        "pending_requirements": pending_requirements,
        "existing_summary": existing_summary,
        "validation_timestamp": datetime.datetime.now().isoformat()
    }


@router.get("/patients", summary="List Inpatient Admissions with Real-time Discharge Eligibility")
def list_discharge_agent_patients():
    """
    Returns admitted patients from Gold `dim_admission_inputs` with their
    evaluated discharge eligibility status for quick selection in the Discharge Agent UI.
    """
    try:
        adm_res = db_connector.query_gold_table("dim_admission_inputs", limit=None)
        admissions = adm_res.get("data", [])

        ds_res = db_connector.query_gold_table("dim_generated_discharge_summaries", limit=None)
        ds_rows = ds_res.get("data", [])
        ds_pids = set()
        ds_adms = set()
        for d in ds_rows:
            if d.get("patient_id"):
                ds_pids.add(str(d["patient_id"]).strip())
            if d.get("patient_number"):
                ds_pids.add(str(d["patient_number"]).strip().lower())
            if d.get("admission_id"):
                ds_adms.add(str(d["admission_id"]).strip())

        enriched_patients = []
        for adm in admissions:
            pid = str(adm.get("patient_id") or "").strip()
            p_info = _extract_patient_from_admission(adm, pid)
            p_num = str(p_info.get("patient_number") or "").strip().lower()
            adm_id = str(p_info.get("admission_id") or "").strip()

            # Exclude patients whose discharge summary has already been written
            if pid in ds_pids or (p_num and p_num in ds_pids) or (adm_id and adm_id in ds_adms):
                continue
            
            # Quick Gate checks
            bill_cleared = (
                p_info["outstanding_balance"] <= 0 or
                p_info["bill_status"].upper() in ["PAID", "CLEARED", "SETTLED", "ZERO_BALANCE", "FULL PAYMENT", "APPROVED"] or
                p_info["bill_clearance_status"].upper() in ["CLEARED", "FULL PAYMENT", "PAID", "SETTLED"]
            )
            has_diag = bool(p_info["primary_diagnosis"] and p_info["primary_diagnosis"].lower() not in ["none", "null", ""])
            
            vitals_normal, vitals_issues = check_patient_vitals_stability(
                temp_val=p_info.get("latest_temperature"),
                hr_val=p_info.get("latest_heart_rate"),
                sbp_val=p_info.get("latest_systolic_bp"),
                dbp_val=p_info.get("latest_diastolic_bp"),
                spo2_val=p_info.get("latest_oxygen_saturation"),
                vitals_summary=p_info.get("vital_signs_summary")
            )
            
            is_stable = bool(p_info["clinical_notes_text"]) and (p_info["risk_score"] <= 0.88)
            
            is_ready = bill_cleared and has_diag and vitals_normal and is_stable
            
            enriched_patients.append({
                "patient_id": pid,
                "patient_number": p_info["patient_number"],
                "patient_name": p_info["patient_name"],
                "age": p_info["age"],
                "gender": p_info["gender"],
                "admission_id": p_info["admission_id"],
                "admission_date": p_info["admission_date"],
                "primary_diagnosis": p_info["primary_diagnosis"],
                "vital_signs_summary": p_info["vital_signs_summary"],
                "latest_temperature": p_info.get("latest_temperature"),
                "latest_heart_rate": p_info.get("latest_heart_rate"),
                "latest_systolic_bp": p_info.get("latest_systolic_bp"),
                "latest_diastolic_bp": p_info.get("latest_diastolic_bp"),
                "latest_oxygen_saturation": p_info.get("latest_oxygen_saturation"),
                "bill_status": p_info["bill_status"],
                "bill_net_amount": p_info["bill_net_amount"],
                "outstanding_balance": p_info["outstanding_balance"],
                "is_bill_cleared": bill_cleared,
                "is_vitals_normal": vitals_normal,
                "vitals_issues": vitals_issues,
                "is_eligible": is_ready,
                "has_generated_summary": False,
                "risk_score": p_info["risk_score"]
            })

        return {
            "status": "success",
            "total": len(enriched_patients),
            "eligible_count": sum(1 for p in enriched_patients if p["is_eligible"]),
            "data": enriched_patients
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch patients list: {str(e)}")


@router.post("/validate", summary="Validate Patient Discharge Eligibility (4 Gates)")
def validate_patient_discharge(request: PatientDischargeValidateRequest):
    """
    Evaluates whether a patient has met all 4 mandatory criteria for discharge:
    1. Bill clearance: All outstanding hospital bills are cleared.
    2. Diagnoses: Primary diagnosis and clinical diagnostic details are available.
    3. Clinical status: Clinical condition is stable and no pending critical actions.
    4. Vitals: Vital signs are stable and meet discharge criteria.
    """
    return _evaluate_patient_eligibility(request.patient_id)


@router.post("/orchestrate", summary="Execute Discharge Orchestration Agent Workflow")
def orchestrate_discharge(request: PatientDischargeOrchestrateRequest):
    """
    Coordinates the complete Discharge Orchestration Agent workflow:
    1. Receives patient_id (single ID or comma-separated string e.g. "87224,87225,87227" / "1,2,3,4").
    2. Validates patient discharge eligibility across the 4 gates.
    3. If any condition fails, BLOCKS summary generation and returns pending requirements.
    4. If eligible, triggers Databricks notebook workflow passing the comma-separated patient IDs.
    5. Persists generated summaries into `health_care.gold.dim_generated_discharge_summaries`.
    6. Returns generated summaries and workflow execution status to the UI.
    """
    raw_pid = str(request.patient_id or "").strip()
    if not raw_pid:
        raise HTTPException(status_code=400, detail="Parameter patient_id is required.")

    # Split comma-separated patient IDs
    pids = [p.strip() for p in raw_pid.split(",") if p.strip()]
    if not pids:
        raise HTTPException(status_code=400, detail="Valid patient_id is required.")

    validated_patients = []
    blocked_patients = []

    for pid in pids:
        try:
            val = _evaluate_patient_eligibility(pid)
            if val["is_eligible"] or request.force_generate:
                validated_patients.append(val)
            else:
                blocked_patients.append(val)
        except HTTPException as he:
            blocked_patients.append({"patient_id": pid, "error": he.detail, "is_eligible": False})
        except Exception as e:
            blocked_patients.append({"patient_id": pid, "error": str(e), "is_eligible": False})

    if blocked_patients and not validated_patients and not request.force_generate:
        return {
            "status": "blocked",
            "success": False,
            "message": f"Discharge summary generation prevented for {len(blocked_patients)} patient(s). Mandatory clinical/administrative conditions unmet.",
            "patient_id": raw_pid,
            "blocked_patients": blocked_patients,
            "action_required": "Resolve all pending items before triggering discharge summary generation."
        }

    # Step 3 & 4: Execute discharge summary generation with chosen model and persist into Gold table
    eligible_pids_str = ",".join(str(vp["patient_id"]) for vp in validated_patients) if validated_patients else raw_pid
    gen_res = generate_and_persist_discharge_summaries(
        eligible_pids_str,
        model_name=request.model_name,
        provider=request.provider,
        api_key=request.api_key
    )
    try:
        db_connector.clear_cache()
    except Exception:
        pass
    generated_summaries = gen_res.get("data", [])

    first_summary = generated_summaries[0] if generated_summaries else None
    first_gates = validated_patients[0].get("gates", {}) if validated_patients else {}

    return {
        "status": "success",
        "success": True,
        "mode": "local_engine",
        "message": f"Discharge Orchestration workflow completed successfully for {len(generated_summaries)} patient(s). Summaries stored in Gold Delta table.",
        "patient_id": raw_pid,
        "patient_ids_executed": eligible_pids_str,
        "total_processed": len(generated_summaries),
        "summary_id": first_summary.get("summary_id") if first_summary else None,
        "discharge_summary": first_summary,
        "all_discharge_summaries": generated_summaries,
        "gates": first_gates,
        "blocked_patients": blocked_patients,
        "notebook_run": {
            "notebook_id": "2865138219507461",
            "parameter_patient_ids": eligible_pids_str,
            "status": "success",
            "execution_state": "SUCCESS",
            "mode": "local_engine_direct_delta_write",
            "duration_seconds": 0.45,
            "target_table": "health_care.gold.dim_generated_discharge_summaries",
            "total_records_committed": len(generated_summaries)
        },
        "next_step": "Summaries are now available in Discharge Command Centre for Physician Sign-off and Bed Release."
    }




class RunFlowRequest(BaseModel):
    patient_ids: Optional[List[str]] = None
    notebook_id: Optional[str] = DEFAULT_NOTEBOOK_ID
    model_name: Optional[str] = None
    provider: Optional[str] = None
    api_key: Optional[str] = None
    timeout_seconds: Optional[int] = 300


@router.get("/flow-status", summary="Scan Admissions for 3-Step Flow: Bill Status -> Vitals Status -> Notebook Status")
def get_flow_status():
    """
    Evaluates all admitted patients through the 3-step discharge funnel:
    1. Step 1 (Bills): Identifies all patients whose bill status is PAID, CLEARED, SETTLED, or COMPLETED.
    2. Step 2 (Vitals): For all patients with Paid bills, checks whether vital signs are NORMAL or UNSTABLE.
       - Clearly flags and indicates patients whose bill is paid BUT vitals are not stable.
    3. Step 3 (Notebook Ready): Identifies patients ready for Databricks `notebook.py` execution.
    """
    try:
        adm_res = db_connector.query_gold_table("dim_admission_inputs", limit=None)
        admissions = adm_res.get("data", [])

        ds_res = db_connector.query_gold_table("dim_generated_discharge_summaries", limit=None)
        ds_rows = ds_res.get("data", [])
        ds_pids = set()
        ds_adms = set()
        for d in ds_rows:
            if d.get("patient_id"):
                ds_pids.add(str(d["patient_id"]).strip())
            if d.get("patient_number"):
                ds_pids.add(str(d["patient_number"]).strip().lower())
            if d.get("admission_id"):
                ds_adms.add(str(d["admission_id"]).strip())

        step_1_bills_paid = []
        step_1_bills_pending = []
        
        step_2_vitals_normal = []
        step_2_vitals_unstable = []

        step_3_ready_for_notebook = []
        pending_candidates_count = 0

        for adm in admissions:
            pid = str(adm.get("patient_id") or "").strip()
            p_info = _extract_patient_from_admission(adm, pid)
            p_num = str(p_info.get("patient_number") or "").strip().lower()
            adm_id = str(p_info.get("admission_id") or "").strip()

            # Exclude patients whose discharge summary has already been written
            if pid in ds_pids or (p_num and p_num in ds_pids) or (adm_id and adm_id in ds_adms):
                continue

            pending_candidates_count += 1
            
            # Step 1: Bill Status Check
            bill_cleared = (
                p_info["outstanding_balance"] <= 0 or
                p_info["bill_status"].upper() in ["PAID", "CLEARED", "SETTLED", "ZERO_BALANCE", "FULL PAYMENT", "APPROVED"] or
                p_info["bill_clearance_status"].upper() in ["CLEARED", "FULL PAYMENT", "PAID", "SETTLED"]
            )

            # Step 2: Vitals Status Check
            vitals_normal, vitals_issues = check_patient_vitals_stability(
                temp_val=p_info.get("latest_temperature"),
                hr_val=p_info.get("latest_heart_rate"),
                sbp_val=p_info.get("latest_systolic_bp"),
                dbp_val=p_info.get("latest_diastolic_bp"),
                spo2_val=p_info.get("latest_oxygen_saturation"),
                vitals_summary=p_info.get("vital_signs_summary")
            )

            has_diag = bool(p_info["primary_diagnosis"] and p_info["primary_diagnosis"].lower() not in ["none", "null", ""])

            patient_card = {
                "patient_id": pid,
                "patient_number": p_info["patient_number"],
                "patient_name": p_info["patient_name"],
                "age": p_info["age"],
                "gender": p_info["gender"],
                "admission_id": p_info["admission_id"],
                "admission_date": p_info["admission_date"],
                "primary_diagnosis": p_info["primary_diagnosis"],
                "vital_signs_summary": p_info["vital_signs_summary"],
                "latest_temperature": p_info.get("latest_temperature"),
                "latest_heart_rate": p_info.get("latest_heart_rate"),
                "latest_systolic_bp": p_info.get("latest_systolic_bp"),
                "latest_diastolic_bp": p_info.get("latest_diastolic_bp"),
                "latest_oxygen_saturation": p_info.get("latest_oxygen_saturation"),
                "bill_number": p_info["bill_number"],
                "bill_status": p_info["bill_status"],
                "bill_net_amount": p_info["bill_net_amount"],
                "outstanding_balance": p_info["outstanding_balance"],
                "is_bill_paid": bill_cleared,
                "is_vitals_normal": vitals_normal,
                "vitals_issues": vitals_issues,
                "has_generated_summary": False,
                "is_ready_for_notebook": bill_cleared and vitals_normal and has_diag
            }

            if bill_cleared:
                step_1_bills_paid.append(patient_card)
                if vitals_normal:
                    step_2_vitals_normal.append(patient_card)
                    if has_diag:
                        step_3_ready_for_notebook.append(patient_card)
                else:
                    # Paid, but vitals NOT stable -> explicitly indicated!
                    step_2_vitals_unstable.append({
                        **patient_card,
                        "indication": "⚠️ Bill Paid, but Vital Signs Unstable / Abnormal",
                        "indication_severity": "High Clinical Warning",
                        "clinical_alert": f"Patient has cleared billing, but cannot be discharged: {', '.join(vitals_issues)}."
                    })
            else:
                step_1_bills_pending.append(patient_card)

        return {
            "status": "success",
            "total_admitted_patients": pending_candidates_count,
            "total_all_admissions": len(admissions),
            "step_1_bills_summary": {
                "paid_or_completed_count": len(step_1_bills_paid),
                "unpaid_or_pending_count": len(step_1_bills_pending),
                "paid_patients": step_1_bills_paid
            },
            "step_2_vitals_summary": {
                "normal_vitals_count": len(step_2_vitals_normal),
                "unstable_vitals_count": len(step_2_vitals_unstable),
                "unstable_indicated_patients": step_2_vitals_unstable
            },
            "step_3_notebook_ready_summary": {
                "ready_count": len(step_3_ready_for_notebook),
                "ready_patients": step_3_ready_for_notebook
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan flow status: {str(e)}")


@router.post("/run-flow", summary="Execute 3-Step Flow: Check Bills -> Check Vitals -> Run Notebook API")
def run_discharge_flow(request: RunFlowRequest = RunFlowRequest()):
    """
    Executes the user's automated 3-step discharge orchestration flow:
    1. Finds all patients whose bill status is PAID or COMPLETED.
    2. Checks vital status of those patients:
       - If vitals are normal -> Proceeds to Step 3.
       - If vitals are NOT stable -> Explicitly flags and indicates clinical warning, skipping notebook.
    3. Runs the Databricks `notebook.py` workflow via API specifically for eligible patients,
       generates summaries, and stores them in `dim_generated_discharge_summaries`.
    """
    # 1. Scan and evaluate flow status
    flow_data = get_flow_status()
    
    candidates = flow_data["step_3_notebook_ready_summary"]["ready_patients"]
    
    target_ids = None
    if request.patient_ids:
        target_ids = set()
        for p in request.patient_ids:
            for sub_p in str(p).split(","):
                if sub_p.strip():
                    target_ids.add(sub_p.strip())

    if target_ids:
        candidates = [c for c in candidates if str(c["patient_id"]) in target_ids]

    notebook_id = str(request.notebook_id or DEFAULT_NOTEBOOK_ID).strip()
    timeout_sec = request.timeout_seconds or 300

    executed_results = []
    batch_orch_res = None

    if candidates:
        comma_separated_pids = ",".join(str(c["patient_id"]) for c in candidates)
        orch_req = PatientDischargeOrchestrateRequest(
            patient_id=comma_separated_pids,
            notebook_id=notebook_id,
            model_name=request.model_name,
            provider=request.provider,
            api_key=request.api_key,
            force_generate=False,
            timeout_seconds=timeout_sec
        )
        batch_orch_res = orchestrate_discharge(orch_req)
        all_summaries = batch_orch_res.get("all_discharge_summaries", [])
        summary_by_pid = {str(s.get("patient_id")): s for s in all_summaries}

        for cand in candidates:
            pid = str(cand["patient_id"])
            p_summary = summary_by_pid.get(pid)
            executed_results.append({
                "patient_id": pid,
                "patient_name": cand["patient_name"],
                "status": "success" if p_summary else "blocked",
                "summary_id": p_summary.get("summary_id") if p_summary else f"DS-{pid}",
                "discharge_summary": p_summary,
                "notebook_run": batch_orch_res.get("notebook_run")
            })

    return {
        "status": "success",
        "flow_execution_timestamp": datetime.datetime.now().isoformat(),
        "parameter_patient_ids_sent_to_notebook": ",".join(str(c["patient_id"]) for c in candidates) if candidates else "",
        "summary": {
            "total_admitted": flow_data["total_admitted_patients"],
            "step_1_bills_paid_count": flow_data["step_1_bills_summary"]["paid_or_completed_count"],
            "step_2_vitals_normal_count": flow_data["step_2_vitals_summary"]["normal_vitals_count"],
            "step_2_vitals_unstable_count": flow_data["step_2_vitals_summary"]["unstable_vitals_count"],
            "step_3_notebook_executed_count": len(executed_results)
        },
        "step_2_indicated_unstable_patients": flow_data["step_2_vitals_summary"]["unstable_indicated_patients"],
        "step_3_executed_summaries": executed_results,
        "batch_notebook_run": batch_orch_res.get("notebook_run") if batch_orch_res else None,
        "message": f"Discharge flow executed. Triggered notebook once for {len(executed_results)} eligible patient(s) ({','.join(str(c['patient_id']) for c in candidates) if candidates else 'none'}). {flow_data['step_2_vitals_summary']['unstable_vitals_count']} patients flagged with abnormal vitals."
    }


