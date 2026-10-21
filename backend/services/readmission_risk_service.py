"""
Readmission Risk Prediction Service (7-Day, 14-Day, 30-Day)
============================================================
Implements the hybrid clinical AI architecture recommended in the HIMS
Discharge Module specification:
1. Evidence-based scoring engine (LACE+ Index, Charlson Comorbidity Index,
   Physiological Vitals Stability, Lab Derangement, Medication Complexity).
2. Multi-horizon calibration:
   - 7-Day Window (Acute post-discharge deterioration, premature discharge, acute meds)
   - 14-Day Window (Sub-acute recovery, wound infection, antibiotic conclusion, follow-up gaps)
   - 30-Day Window (Chronic disease decompensation, long-term adherence, ambulatory failure)
3. LLM Synthesis & Explainability Layer (Groq / Gemini / OpenAI / Databricks / Deterministic Fallback).
4. Full Clinician-in-the-loop audit trail and persistence.
"""

import os
import re
import json
import datetime
import urllib.request
import logging
from typing import Optional, Dict, Any, List, Tuple
import psycopg2.extras

from connectors.databricks_connector import DatabricksConnector
from services.discharge_generator import resolve_llm_provider, SUPPORTED_LLM_PROVIDERS

logger = logging.getLogger("readmission_risk_service")
db_connector = DatabricksConnector()

# ─────────────────────────────────────────────────────────────────────────────
# 1. CHARLSON COMORBIDITY INDEX MAPPING
# ─────────────────────────────────────────────────────────────────────────────
CHARLSON_CONDITIONS = {
    # 1 Point
    "myocardial infarction": (1, ["infarct", "stemi", "nstemi", "heart attack", "coronary artery disease", "cad"]),
    "congestive heart failure": (1, ["heart failure", "chf", "congestive", "cardiomyopathy", "lv failure", "reduced ejection fraction"]),
    "peripheral vascular disease": (1, ["peripheral vascular", "pvd", "pad", "claudication", "arterial disease"]),
    "cerebrovascular disease": (1, ["stroke", "cva", "transient ischemic", "tia", "cerebrovascular"]),
    "dementia": (1, ["dementia", "alzheimer", "cognitive impairment"]),
    "chronic pulmonary disease": (1, ["copd", "asthma", "emphysema", "chronic bronchitis", "interstitial lung"]),
    "rheumatologic disease": (1, ["rheumatoid", "lupus", "sle", "connective tissue", "scleroderma"]),
    "peptic ulcer disease": (1, ["peptic ulcer", "gastric ulcer", "duodenal ulcer", "pud"]),
    "mild liver disease": (1, ["fatty liver", "hepatitis", "cirrhosis without portal"]),
    "diabetes mellitus (uncomplicated)": (1, ["diabetes", "type 2 diabetes", "t2dm", "t1dm", "dm"]),
    
    # 2 Points
    "hemiplegia or paraplegia": (2, ["hemiplegia", "paraplegia", "quadriplegia", "stroke with paralysis"]),
    "renal disease (moderate to severe)": (2, ["renal failure", "ckd", "chronic kidney", "creatinine elevation", "dialysis", "nephropathy"]),
    "diabetes with end-organ damage": (2, ["diabetic nephropathy", "diabetic neuropathy", "diabetic retinopathy", "dka", "ketoacidosis"]),
    "solid tumor / malignancy": (2, ["cancer", "carcinoma", "malignancy", "tumor", "neoplasm", "adenocarcinoma"]),
    "leukemia": (2, ["leukemia", "aml", "all", "cml", "cll"]),
    "lymphoma": (2, ["lymphoma", "hodgkin", "non-hodgkin", "myeloma"]),
    
    # 3 Points
    "moderate or severe liver disease": (3, ["cirrhosis with ascites", "hepatic encephalopathy", "portal hypertension", "variceal bleeding", "end stage liver"]),
    
    # 6 Points
    "metastatic solid tumor": (6, ["metastatic", "stage iv", "metastasis"]),
    "aids / hiv advanced": (6, ["aids", "hiv with opportunist"])
}

HIGH_ALERT_MEDICATION_CLASSES = [
    ("Anticoagulant / Antiplatelet", ["enoxaparin", "heparin", "warfarin", "aspirin", "clopidogrel", "rivaroxaban", "apixaban", "ticagrelor"]),
    ("Insulin / Hypoglycemic", ["insulin", "glargine", "glipizide", "metformin", "gliclazide"]),
    ("Antiarrhythmic / Inotrope", ["digoxin", "amiodarone", "metoprolol", "carvedilol", "diltiazem", "flecainide"]),
    ("Opioid / Sedative", ["tramadol", "morphine", "fentanyl", "midazolam", "lorazepam"]),
    ("Loop Diuretic", ["furosemide", "lasix", "torsemide", "spironolactone"]),
    ("Broad Spectrum Antibiotic", ["ceftriaxone", "meropenem", "piperacillin", "tazobactam", "vancomycin", "cefixime"])
]


def extract_charlson_score(diagnoses: List[str]) -> Tuple[int, List[Dict[str, Any]]]:
    """Scores Charlson comorbidities based on documented primary and secondary diagnoses."""
    score = 0
    matched = []
    text_corpus = " ".join(d.lower() for d in diagnoses if d)

    for cond_name, (points, keywords) in CHARLSON_CONDITIONS.items():
        if any(re.search(r'\b' + re.escape(kw) + r'\b', text_corpus) for kw in keywords):
            score += points
            matched.append({
                "condition": cond_name.title(),
                "points": points,
                "category": "Charlson Comorbidity"
            })
    return score, matched


def calculate_lace_score(
    los_days: int,
    is_emergency: bool,
    charlson_score: int,
    prior_ed_visits: int
) -> Tuple[int, Dict[str, int]]:
    """
    Standard LACE Index calculation:
    - L (Length of stay): 0 to 7 points
    - A (Acuity of admission): 0 or 3 points
    - C (Comorbidities): 0 to 5+ points (capped at 5 for standard index)
    - E (Emergency/Inpatient visits in past 6 months): 0 to 4 points
    Total standard range: 0 - 19. (>=10 is clinically high risk)
    """
    # L
    if los_days < 1: l_pts = 0
    elif los_days == 1: l_pts = 1
    elif los_days == 2: l_pts = 2
    elif los_days == 3: l_pts = 3
    elif 4 <= los_days <= 6: l_pts = 4
    elif 7 <= los_days <= 13: l_pts = 5
    else: l_pts = 7

    # A
    a_pts = 3 if is_emergency else 0

    # C
    c_pts = min(charlson_score, 5)

    # E
    if prior_ed_visits <= 0: e_pts = 0
    elif prior_ed_visits == 1: e_pts = 1
    elif prior_ed_visits == 2: e_pts = 2
    elif prior_ed_visits == 3: e_pts = 3
    else: e_pts = 4

    total_lace = l_pts + a_pts + c_pts + e_pts
    return total_lace, {
        "length_of_stay_pts": l_pts,
        "acuity_pts": a_pts,
        "comorbidity_pts": c_pts,
        "emergency_visits_pts": e_pts,
        "total_lace": total_lace
    }


def evaluate_vitals_risk(
    temp_f: Optional[float],
    hr: Optional[int],
    sbp: Optional[int],
    dbp: Optional[int],
    spo2: Optional[float]
) -> Tuple[float, List[str]]:
    """Evaluates hemodynamic and vital sign instability at the time of discharge evaluation."""
    vitals_score = 0.0
    flags = []

    if spo2 is not None:
        if spo2 < 90.0:
            vitals_score += 4.0
            flags.append(f"Critical Hypoxia: SpO2 {spo2:.1f}% (<90%)")
        elif spo2 < 93.0:
            vitals_score += 2.5
            flags.append(f"Borderline Oxygenation: SpO2 {spo2:.1f}% (<93%)")

    if hr is not None:
        if hr > 115:
            vitals_score += 2.5
            flags.append(f"Resting Tachycardia: HR {hr} bpm (>115 bpm)")
        elif hr < 48:
            vitals_score += 2.5
            flags.append(f"Marked Bradycardia: HR {hr} bpm (<48 bpm)")

    if sbp is not None:
        if sbp > 170:
            vitals_score += 2.5
            flags.append(f"Stage 2 Hypertension: SBP {sbp} mmHg (>170)")
        elif sbp < 90:
            vitals_score += 3.5
            flags.append(f"Systemic Hypotension: SBP {sbp} mmHg (<90)")

    if temp_f is not None:
        if temp_f >= 101.0:
            vitals_score += 3.0
            flags.append(f"Persistent Pyrexia: Temp {temp_f:.1f}°F (>=101.0°F)")
        elif temp_f >= 100.0:
            vitals_score += 1.5
            flags.append(f"Low-grade Fever: Temp {temp_f:.1f}°F")

    return vitals_score, flags


def evaluate_labs_risk(lab_results: List[Dict[str, Any]]) -> Tuple[float, List[str]]:
    """Evaluates critical lab derangements (renal, CBC, electrolytes, inflammatory markers)."""
    labs_score = 0.0
    flags = []

    for lab in lab_results:
        param = str(lab.get("test_parameter") or "").lower()
        val_str = str(lab.get("result_value") or "").strip()
        is_abnormal = bool(lab.get("abnormal_flag"))

        try:
            val_f = float(re.findall(r"[-+]?\d*\.\d+|\d+", val_str)[0])
        except (IndexError, ValueError):
            val_f = None

        if val_f is None:
            continue

        # Creatinine
        if "creatinine" in param:
            if val_f >= 2.0:
                labs_score += 3.5
                flags.append(f"Significantly Elevated Creatinine: {val_f} mg/dL (Baseline >2.0)")
            elif val_f >= 1.4:
                labs_score += 2.0
                flags.append(f"Mildly Impaired Renal Function: Creatinine {val_f} mg/dL")

        # Hemoglobin
        elif "hemoglobin" in param or "hb" == param:
            if val_f < 8.5:
                labs_score += 3.0
                flags.append(f"Severe Anemia: Hb {val_f} g/dL (<8.5)")
            elif val_f < 10.5:
                labs_score += 1.5
                flags.append(f"Moderate Anemia: Hb {val_f} g/dL (<10.5)")

        # Sodium
        elif "sodium" in param:
            if val_f < 130 or val_f > 150:
                labs_score += 2.5
                flags.append(f"Dysnatremia: Sodium {val_f} mmol/L")

        # Potassium
        elif "potassium" in param:
            if val_f < 3.2 or val_f > 5.5:
                labs_score += 2.5
                flags.append(f"Electrolyte Derangement: Potassium {val_f} mmol/L")

        # WBC / Leukocytes
        elif "wbc" in param or "leukocyte" in param or "total count" in param:
            if val_f > 14.0 or val_f > 14000:
                labs_score += 2.5
                flags.append(f"Leukocytosis: WBC {val_f}")

        # Generic abnormal flag
        elif is_abnormal and labs_score < 4.0:
            labs_score += 0.5
            flags.append(f"Abnormal {lab.get('test_parameter')}: {val_str}")

    return min(labs_score, 8.0), flags[:5]


def evaluate_medications_risk(prescriptions: List[Dict[str, Any]]) -> Tuple[float, List[str], int]:
    """Evaluates polypharmacy and high-alert medication regimens."""
    med_score = 0.0
    flags = []
    med_names = []

    for rx in prescriptions:
        name = str(rx.get("medication_name") or rx.get("instructions") or "").lower()
        if name:
            med_names.append(name)

    total_meds = len(prescriptions)
    if total_meds >= 9:
        med_score += 3.0
        flags.append(f"Severe Polypharmacy: {total_meds} concurrent active discharge medications")
    elif total_meds >= 6:
        med_score += 1.5
        flags.append(f"Moderate Polypharmacy: {total_meds} active medications")

    # High alert scan
    text_corpus = " ".join(med_names)
    for class_name, drugs in HIGH_ALERT_MEDICATION_CLASSES:
        if any(d in text_corpus for d in drugs):
            med_score += 1.0
            flags.append(f"High-Alert Regimen: Contains {class_name}")

    return min(med_score, 5.0), flags[:4], total_meds


# ─────────────────────────────────────────────────────────────────────────────
# 2. MULTI-HORIZON READMISSION ENGINE (7-Day, 14-Day, 30-Day)
# ─────────────────────────────────────────────────────────────────────────────
def compute_multi_horizon_readmission_risk(
    patient_data: Dict[str, Any],
    lab_results: List[Dict[str, Any]],
    prescriptions: List[Dict[str, Any]],
    prior_admissions_count: int = 0
) -> Dict[str, Any]:
    """
    Computes rigorous calibrated readmission risk across 7, 14, and 30 days
    combining LACE Index, Charlson Comorbidities, acute vitals, labs, and med complexity.
    """
    # 1. Basic admission metrics
    los_days = int(patient_data.get("current_stay_days") or 1)
    adm_type = str(patient_data.get("admission_type") or "Emergency").lower()
    is_emergency = "emerg" in adm_type or "urgent" in adm_type
    age = int(patient_data.get("age_at_admission") or patient_data.get("age") or 50)

    # 2. Diagnoses & Charlson
    primary_dx = str(patient_data.get("primary_diagnosis") or "")
    secondary_dx = patient_data.get("secondary_diagnoses") or []
    if isinstance(secondary_dx, str):
        try:
            secondary_dx = json.loads(secondary_dx) if secondary_dx.startswith("[") else [secondary_dx]
        except Exception:
            secondary_dx = [secondary_dx]
    all_diagnoses = [primary_dx] + [str(d) for d in secondary_dx if d]

    charlson_score, charlson_matches = extract_charlson_score(all_diagnoses)

    # 3. LACE Index
    lace_score, lace_breakdown = calculate_lace_score(
        los_days=los_days,
        is_emergency=is_emergency,
        charlson_score=charlson_score,
        prior_ed_visits=prior_admissions_count
    )

    # 4. Physiological Vitals Stability
    temp_raw = patient_data.get("latest_temperature")
    temp_f = float(temp_raw) if temp_raw is not None else None
    if temp_f and temp_f < 50.0: # Celsius to F conversion
        temp_f = round((temp_f * 9 / 5) + 32, 1)

    hr_raw = patient_data.get("latest_heart_rate")
    hr = int(hr_raw) if hr_raw is not None else None
    sbp_raw = patient_data.get("latest_systolic_bp")
    sbp = int(sbp_raw) if sbp_raw is not None else None
    dbp_raw = patient_data.get("latest_diastolic_bp")
    dbp = int(dbp_raw) if dbp_raw is not None else None
    spo2_raw = patient_data.get("latest_oxygen_saturation")
    spo2 = float(spo2_raw) if spo2_raw is not None else None

    vitals_score, vitals_flags = evaluate_vitals_risk(temp_f, hr, sbp, dbp, spo2)

    # 5. Lab Derangements
    labs_score, labs_flags = evaluate_labs_risk(lab_results)

    # 6. Medication Complexity
    med_score, med_flags, total_meds = evaluate_medications_risk(prescriptions)

    # 7. Age / Frailty Factor
    age_pts = 0.0
    if age >= 80: age_pts = 3.0
    elif age >= 65: age_pts = 1.5
    elif age < 1: age_pts = 2.0  # Neonatal risk

    # ─────────────────────────────────────────────────────────────────────────
    # HORIZON 1: 7-DAY READMISSION RISK (Acute breakdown / Premature discharge)
    # ─────────────────────────────────────────────────────────────────────────
    # Heavily driven by: Vitals Instability (35%), Critical Labs (25%),
    # Premature stay (<2d for acute condition) (20%), Acute Med Toxicity (20%)
    acute_weight = (vitals_score * 1.8) + (labs_score * 1.5) + (med_score * 0.8)
    lace_7d_component = (lace_score / 19.0) * 12.0
    premature_penalty = 6.0 if (los_days <= 1 and is_emergency and charlson_score >= 2) else 0.0

    raw_7day_pct = 3.5 + (acute_weight * 2.2) + lace_7d_component + premature_penalty + (prior_admissions_count * 2.0)
    risk_7day = min(round(max(raw_7day_pct, 2.5), 1), 78.5)

    if risk_7day < 8.0: tier_7day = "Low"
    elif risk_7day <= 18.0: tier_7day = "Moderate"
    else: tier_7day = "High"

    # ─────────────────────────────────────────────────────────────────────────
    # HORIZON 2: 14-DAY READMISSION RISK (Subacute transition / Surgical / Infection)
    # ─────────────────────────────────────────────────────────────────────────
    # Captures: Early treatment completion failure, wound/surgical recovery,
    # medication adverse reactions, missed 1st follow-up visit.
    subacute_weight = (labs_score * 1.2) + (vitals_score * 1.0) + (charlson_score * 1.4) + (med_score * 1.2)
    lace_14d_component = (lace_score / 19.0) * 18.0

    raw_14day_pct = 5.0 + (subacute_weight * 1.8) + lace_14d_component + (prior_admissions_count * 2.5) + (age_pts * 0.8)
    # Post-op elevation if surgical
    if "surg" in adm_type or "cholecystectomy" in primary_dx.lower() or "post-op" in primary_dx.lower():
        raw_14day_pct += 4.5

    risk_14day = min(round(max(raw_14day_pct, risk_7day + 2.0), 1), 84.0)

    if risk_14day < 12.0: tier_14day = "Low"
    elif risk_14day <= 25.0: tier_14day = "Moderate"
    else: tier_14day = "High"

    # ─────────────────────────────────────────────────────────────────────────
    # HORIZON 3: 30-DAY READMISSION RISK (Chronic decompensation / Ambulatory gap)
    # ─────────────────────────────────────────────────────────────────────────
    # Captures: Full LACE Score (40%), Charlson Comorbidity Progression (30%),
    # Polypharmacy (15%), Age & Vulnerability (15%)
    lace_30d_component = (lace_score / 19.0) * 28.0
    chronic_burden = (charlson_score * 2.2) + (med_score * 1.5) + (age_pts * 1.5) + (prior_admissions_count * 3.5)

    raw_30day_pct = 7.0 + lace_30d_component + chronic_burden + (labs_score * 0.8)
    risk_30day = min(round(max(raw_30day_pct, risk_14day + 2.5), 1), 89.5)

    if risk_30day < 15.0: tier_30day = "Low"
    elif risk_30day <= 30.0: tier_30day = "Moderate"
    else: tier_30day = "High"

    # Consolidated Risk Drivers & Modifiable Factors
    all_drivers = []
    all_drivers.extend(vitals_flags)
    all_drivers.extend(labs_flags)
    all_drivers.extend(med_flags)
    for c in charlson_matches:
        all_drivers.append(f"Comorbidity Burden: {c['condition']} (+{c['points']} pts)")
    if prior_admissions_count > 0:
        all_drivers.append(f"Prior Admissions: {prior_admissions_count} previous hospitalizations")
    if los_days >= 7:
        all_drivers.append(f"Prolonged Inpatient Stay: {los_days} days")

    if not all_drivers:
        all_drivers.append("Standard clinical risk profile with no acute physiological derangements detected")

    return {
        "horizons": {
            "7day": {
                "window": "7-Day",
                "risk_score_pct": risk_7day,
                "risk_tier": tier_7day,
                "focus_area": "Acute physiological deterioration, premature discharge, and acute medication errors"
            },
            "14day": {
                "window": "14-Day",
                "risk_score_pct": risk_14day,
                "risk_tier": tier_14day,
                "focus_area": "Sub-acute recovery failure, post-op wound complications, and missed initial follow-up"
            },
            "30day": {
                "window": "30-Day",
                "risk_score_pct": risk_30day,
                "risk_tier": tier_30day,
                "focus_area": "Chronic disease decompensation (CHF/COPD/CKD), ambulatory support failure, and long-term adherence"
            }
        },
        "scoring_metrics": {
            "lace_score": lace_score,
            "lace_max": 19,
            "lace_breakdown": lace_breakdown,
            "charlson_score": charlson_score,
            "charlson_comorbidities": charlson_matches,
            "vitals_score": round(vitals_score, 1),
            "labs_score": round(labs_score, 1),
            "medication_score": round(med_score, 1),
            "total_active_meds": total_meds,
            "prior_admissions_count": prior_admissions_count
        },
        "risk_drivers": all_drivers,
        "evidence_data": {
            "admission_type": adm_type,
            "length_of_stay_days": los_days,
            "age": age,
            "primary_diagnosis": primary_dx,
            "secondary_diagnoses": secondary_dx,
            "latest_vitals": {
                "temperature_f": temp_f,
                "heart_rate_bpm": hr,
                "blood_pressure": f"{sbp}/{dbp}" if sbp and dbp else None,
                "spo2_pct": spo2
            },
            "vitals_alerts": vitals_flags,
            "lab_alerts": labs_flags,
            "med_alerts": med_flags
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. LLM SYNTHESIS & EXPLAINABILITY GENERATOR
# ─────────────────────────────────────────────────────────────────────────────
def generate_clinical_rationale_and_plan(
    calc_result: Dict[str, Any],
    patient_info: Dict[str, Any],
    model_name: Optional[str] = None,
    provider: Optional[str] = None,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Invokes external LLM to generate professional CMO-level clinical rationale,
    modifiable factors, and time-sequenced mitigation plan across 7, 14, and 30 days.
    Falls back gracefully to deterministic clinical rule engine if LLM is unavailable.
    """
    horizons = calc_result["horizons"]
    drivers = calc_result["risk_drivers"]
    metrics = calc_result["scoring_metrics"]
    evidence = calc_result["evidence_data"]

    prompt_payload = {
        "patient": {
            "name": f"{patient_info.get('first_name', '')} {patient_info.get('last_name', '')}".strip() or f"Patient {patient_info.get('patient_id')}",
            "age": evidence.get("age"),
            "diagnosis": evidence.get("primary_diagnosis"),
            "secondary_diagnoses": evidence.get("secondary_diagnoses"),
            "stay_days": evidence.get("length_of_stay_days"),
            "admission_type": evidence.get("admission_type"),
            "vitals": evidence.get("latest_vitals")
        },
        "computed_scores": {
            "7_day_risk": f"{horizons['7day']['risk_score_pct']}% ({horizons['7day']['risk_tier']})",
            "14_day_risk": f"{horizons['14day']['risk_score_pct']}% ({horizons['14day']['risk_tier']})",
            "30_day_risk": f"{horizons['30day']['risk_score_pct']}% ({horizons['30day']['risk_tier']})",
            "lace_score": f"{metrics['lace_score']}/19",
            "charlson_score": metrics['charlson_score']
        },
        "identified_risk_drivers": drivers
    }

    system_prompt = (
        "You are an expert Chief Medical Officer and hospital discharge quality specialist.\n"
        "Evaluate the calculated 7-Day, 14-Day, and 30-Day Hospital Readmission Risk for this inpatient.\n"
        "Return a valid JSON object ONLY with the following exact keys:\n"
        "1. 'clinical_rationale': 2-3 paragraph clinical narrative explaining the pathophysiology and risk trajectory across 7, 14, and 30 days.\n"
        "2. 'modifiable_factors': List of objects with keys ['factor', 'impact', 'mitigation_action'] highlighting factors the care team can actively modify before or immediately following discharge.\n"
        "3. 'mitigation_plan': List of time-sequenced interventions with keys ['timeframe', 'intervention', 'owner', 'priority']. Include specific 48h, 7-day, 14-day, and 30-day touchpoints."
    )

    prov, clean_model, _ = resolve_llm_provider(model_name, provider)

    # If external provider is requested, attempt invocation
    if prov in ("groq", "gemini", "openai"):
        try:
            user_text = "Clinical Readmission Risk Input Data:\n" + json.dumps(prompt_payload, indent=2, default=str)
            
            # Groq
            if prov == "groq":
                key = api_key or os.getenv("GROQ_API_KEY")
                if key:
                    req_payload = {
                        "model": clean_model or "llama-3.3-70b-versatile",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_text}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.2,
                        "max_tokens": 1500
                    }
                    req = urllib.request.Request(
                        "https://api.groq.com/openai/v1/chat/completions",
                        data=json.dumps(req_payload).encode("utf-8"),
                        headers={"Authorization": f"Bearer {key.strip()}", "Content-Type": "application/json"},
                        method="POST"
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        parsed = json.loads(res["choices"][0]["message"]["content"])
                        if "clinical_rationale" in parsed and "mitigation_plan" in parsed:
                            parsed["model_used"] = f"groq/{clean_model}"
                            return parsed

            # Gemini
            elif prov == "gemini":
                key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
                if key:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={key.strip()}"
                    gem_payload = {
                        "contents": [{"parts": [{"text": system_prompt + "\n\n" + user_text + "\nPure JSON only."}]}],
                        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"}
                    }
                    req = urllib.request.Request(url, data=json.dumps(gem_payload).encode("utf-8"), headers={"Content-Type": "application/json"})
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        res = json.loads(resp.read().decode("utf-8"))
                        text_resp = res["candidates"][0]["content"]["parts"][0]["text"]
                        parsed = json.loads(text_resp)
                        if "clinical_rationale" in parsed and "mitigation_plan" in parsed:
                            parsed["model_used"] = f"gemini/{clean_model}"
                            return parsed
        except Exception as e:
            logger.warning(f"External LLM generation failed ({e}), falling back to deterministic clinical engine.")

    # Deterministic Clinical Engine Synthesis Fallback
    dx_name = evidence.get("primary_diagnosis") or "Inpatient Care"
    tier_7 = horizons["7day"]["risk_tier"]
    tier_14 = horizons["14day"]["risk_tier"]
    tier_30 = horizons["30day"]["risk_tier"]
    lace_val = metrics["lace_score"]

    rationale = (
        f"The patient demonstrates a {tier_7.lower()} acute readmission risk in the 7-day post-discharge window ({horizons['7day']['risk_score_pct']}%), "
        f"progressing to a {tier_14.lower()} risk profile by Day 14 ({horizons['14day']['risk_score_pct']}%), and {tier_30.lower()} risk across the standard 30-day horizon ({horizons['30day']['risk_score_pct']}%). "
        f"Scoring is anchored on a validated LACE Index score of {lace_val}/19 with an underlying Charlson Comorbidity Index of {metrics['charlson_score']}.\n\n"
        f"Primary clinical trajectory drivers for {dx_name} include: {'; '.join(drivers[:3])}. "
        f"In the immediate 7-day phase, acute physiological and medication stabilization remain paramount. "
        f"By Day 14 to 30, risk is primarily governed by ambulatory disease management, compliance with complex pharmacotherapy, and scheduled specialist OPD surveillance."
    )

    modifiable_factors = [
        {
            "factor": "Post-Discharge Medication Reconciliation & Adherence",
            "impact": "High",
            "mitigation_action": "Conduct nurse-led 48-hour follow-up phone call to review prescriptions, dosages, and verify prescription pickup."
        },
        {
            "factor": "Outpatient Follow-Up Timing",
            "impact": "High",
            "mitigation_action": "Mandate confirmed OPD clinic appointment within 7-10 days prior to hospital discharge sign-off."
        },
        {
            "factor": "Red-Flag Symptom Recognition by Caregiver",
            "impact": "Medium",
            "mitigation_action": "Provide disease-specific pictorial warning signs guide (fever, dyspnea, edema, chest pain) with 24/7 hospital helpline."
        }
    ]

    mitigation_plan = [
        {
            "timeframe": "24 to 48 Hours Post-Discharge",
            "intervention": "Tele-triage check-in by Clinical Care Coordinator to verify vital signs stability, pain control, and medication administration.",
            "owner": "Discharge Transition Nurse",
            "priority": "Urgent" if tier_7 == "High" else "High"
        },
        {
            "timeframe": "Day 5 to 7",
            "intervention": "Primary Attending Physician / Specialist OPD consultation for clinical examination and repeat critical lab markers.",
            "owner": "Attending Physician",
            "priority": "High"
        },
        {
            "timeframe": "Day 14",
            "intervention": "Post-discharge review of chronic medication titration, wound/surgical recovery check, and symptom trajectory.",
            "owner": "Outpatient Clinic Lead",
            "priority": "Medium"
        },
        {
            "timeframe": "Day 30",
            "intervention": "End-of-month clinical milestone review to confirm ambulatory stability and prevent 30-day readmission penalty.",
            "owner": "Care Management Team",
            "priority": "Routine"
        }
    ]

    return {
        "clinical_rationale": rationale,
        "modifiable_factors": modifiable_factors,
        "mitigation_plan": mitigation_plan,
        "model_used": "deterministic-clinical-rules-engine"
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. DATABASE RETRIEVAL, COMPUTATION & PERSISTENCE
# ─────────────────────────────────────────────────────────────────────────────
class ReadmissionRiskService:
    """Orchestrates multi-horizon readmission risk evaluation and persistence."""

    def __init__(self):
        self.db = db_connector

    def fetch_patient_context(self, patient_id: int) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], int]:
        """Gathers patient admission inputs, recent lab results, active prescriptions, and prior admissions."""
        conn = self.db.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Admission inputs
        cur.execute("""
            SELECT * FROM dim_admission_inputs
            WHERE patient_id = %s
            ORDER BY admission_id DESC LIMIT 1;
        """, (patient_id,))
        patient = cur.fetchone()

        if not patient:
            # Fallback to admissions table
            cur.execute("""
                SELECT 
                    a.admission_id, a.admission_number, a.patient_id,
                    p.patient_number, p.first_name, p.last_name, p.gender, p.date_of_birth,
                    EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth))::int AS age_at_admission,
                    a.admission_date, a.admission_type, a.reason_for_admission,
                    a.primary_diagnosis, a.secondary_diagnoses,
                    a.current_stay_days, a.discharge_status
                FROM admissions a
                JOIN patients p ON a.patient_id = p.patient_id
                WHERE a.patient_id = %s
                ORDER BY a.admission_id DESC LIMIT 1;
            """, (patient_id,))
            patient = cur.fetchone()

        if not patient:
            cur.close()
            conn.close()
            return None, [], [], 0

        # 2. Recent Labs
        cur.execute("""
            SELECT test_parameter, result_value, unit, reference_range, abnormal_flag, result_date
            FROM lab_results
            WHERE patient_id = %s
            ORDER BY result_date DESC LIMIT 15;
        """, (patient_id,))
        labs = cur.fetchall() or []

        # 3. Active / Discharge Prescriptions
        cur.execute("""
            SELECT pi.prescription_item_id, m.medication_name, m.is_high_alert, pi.dosage, pi.frequency, pi.instructions
            FROM prescriptions p
            JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
            LEFT JOIN medications m ON pi.medication_id = m.medication_id
            WHERE p.patient_id = %s
            ORDER BY p.prescription_date DESC LIMIT 20;
        """, (patient_id,))
        prescriptions = cur.fetchall() or []

        # 4. Count of previous admissions
        cur.execute("""
            SELECT COUNT(*) FROM admissions
            WHERE patient_id = %s AND admission_id != %s;
        """, (patient_id, patient.get("admission_id", -1)))
        prior_count = cur.fetchone().get("count", 0)

        cur.close()
        conn.close()
        return dict(patient), [dict(l) for l in labs], [dict(p) for p in prescriptions], int(prior_count)

    def evaluate_patient_readmission_risk(
        self,
        patient_id: int,
        model_name: Optional[str] = None,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        persist: bool = True
    ) -> Dict[str, Any]:
        """
        Executes full 7-day, 14-day, and 30-day evaluation for a patient,
        generates clinical explanation, and persists the record.
        """
        patient, labs, prescriptions, prior_count = self.fetch_patient_context(patient_id)
        if not patient:
            raise ValueError(f"Patient with ID {patient_id} not found in hospital inpatient records.")

        # 1. Multi-horizon scoring
        calc_result = compute_multi_horizon_readmission_risk(
            patient_data=patient,
            lab_results=labs,
            prescriptions=prescriptions,
            prior_admissions_count=prior_count
        )

        # 2. LLM / Clinical narrative generation
        ai_synthesis = generate_clinical_rationale_and_plan(
            calc_result=calc_result,
            patient_info=patient,
            model_name=model_name,
            provider=provider,
            api_key=api_key
        )

        horizons = calc_result["horizons"]
        metrics = calc_result["scoring_metrics"]

        response_payload = {
            "patient_id": patient_id,
            "admission_id": patient.get("admission_id"),
            "patient_name": f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip() or f"Patient {patient_id}",
            "primary_diagnosis": patient.get("primary_diagnosis"),
            "horizons": horizons,
            "scoring_metrics": metrics,
            "risk_drivers": calc_result["risk_drivers"],
            "modifiable_factors": ai_synthesis.get("modifiable_factors", []),
            "mitigation_plan": ai_synthesis.get("mitigation_plan", []),
            "clinical_rationale": ai_synthesis.get("clinical_rationale", ""),
            "evidence_data": calc_result["evidence_data"],
            "model_used": ai_synthesis.get("model_used", "hybrid-clinical-rules"),
            "evaluated_at": datetime.datetime.now().isoformat(),
            "clinician_status": "Pending Review"
        }

        # 3. Persistence
        if persist:
            pred_id = self.persist_prediction(response_payload)
            response_payload["prediction_id"] = pred_id

        return response_payload

    def persist_prediction(self, payload: Dict[str, Any]) -> int:
        """Saves evaluation into patient_readmission_risk_predictions table."""
        conn = self.db.get_connection()
        conn.autocommit = True
        cur = conn.cursor()

        h7 = payload["horizons"]["7day"]
        h14 = payload["horizons"]["14day"]
        h30 = payload["horizons"]["30day"]
        metrics = payload["scoring_metrics"]

        query = """
            INSERT INTO patient_readmission_risk_predictions (
                patient_id, admission_id,
                risk_score_7day, risk_tier_7day,
                risk_score_14day, risk_tier_14day,
                risk_score_30day, risk_tier_30day,
                lace_score, charlson_score,
                primary_risk_factors, modifiable_factors, mitigation_plan,
                clinical_rationale, evidence_data, model_name, clinician_status
            ) VALUES (
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s
            ) RETURNING prediction_id;
        """

        cur.execute(query, (
            payload["patient_id"],
            payload.get("admission_id"),
            h7["risk_score_pct"], h7["risk_tier"],
            h14["risk_score_pct"], h14["risk_tier"],
            h30["risk_score_pct"], h30["risk_tier"],
            metrics.get("lace_score", 0),
            metrics.get("charlson_score", 0),
            json.dumps(payload.get("risk_drivers", [])),
            json.dumps(payload.get("modifiable_factors", [])),
            json.dumps(payload.get("mitigation_plan", [])),
            payload.get("clinical_rationale", ""),
            json.dumps(payload.get("evidence_data", {})),
            payload.get("model_used", "hybrid-clinical-rules"),
            payload.get("clinician_status", "Pending Review")
        ))
        row = cur.fetchone()
        pred_id = row[0] if row else None
        cur.close()
        conn.close()
        return pred_id

    def get_latest_patient_prediction(self, patient_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves the most recent readmission prediction record for a patient."""
        conn = self.db.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("""
            SELECT * FROM patient_readmission_risk_predictions
            WHERE patient_id = %s
            ORDER BY predicted_at DESC LIMIT 1;
        """, (patient_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return None

        # Format into clean frontend structure
        return {
            "prediction_id": row["prediction_id"],
            "patient_id": row["patient_id"],
            "admission_id": row["admission_id"],
            "horizons": {
                "7day": {
                    "window": "7-Day",
                    "risk_score_pct": float(row["risk_score_7day"]),
                    "risk_tier": row["risk_tier_7day"],
                    "focus_area": "Acute deterioration & premature discharge"
                },
                "14day": {
                    "window": "14-Day",
                    "risk_score_pct": float(row["risk_score_14day"]),
                    "risk_tier": row["risk_tier_14day"],
                    "focus_area": "Sub-acute recovery & early follow-up"
                },
                "30day": {
                    "window": "30-Day",
                    "risk_score_pct": float(row["risk_score_30day"]),
                    "risk_tier": row["risk_tier_30day"],
                    "focus_area": "Chronic decompensation & ambulatory management"
                }
            },
            "scoring_metrics": {
                "lace_score": row["lace_score"],
                "charlson_score": row["charlson_score"]
            },
            "risk_drivers": row["primary_risk_factors"] if isinstance(row["primary_risk_factors"], list) else json.loads(row["primary_risk_factors"] or "[]"),
            "modifiable_factors": row["modifiable_factors"] if isinstance(row["modifiable_factors"], list) else json.loads(row["modifiable_factors"] or "[]"),
            "mitigation_plan": row["mitigation_plan"] if isinstance(row["mitigation_plan"], list) else json.loads(row["mitigation_plan"] or "[]"),
            "clinical_rationale": row["clinical_rationale"],
            "evidence_data": row["evidence_data"] if isinstance(row["evidence_data"], dict) else json.loads(row["evidence_data"] or "{}"),
            "model_used": row["model_name"],
            "clinician_status": row["clinician_status"],
            "clinician_notes": row["clinician_notes"],
            "reviewed_by": row["reviewed_by"],
            "reviewed_at": row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
            "predicted_at": row["predicted_at"].isoformat() if row["predicted_at"] else None
        }

    def update_clinician_review(
        self,
        prediction_id: int,
        status: str,
        clinician_notes: Optional[str] = None,
        reviewed_by: Optional[str] = "Attending Physician"
    ) -> bool:
        """Updates clinician sign-off on the readmission prediction (Accepted / Modified / Rejected)."""
        conn = self.db.get_connection()
        conn.autocommit = True
        cur = conn.cursor()

        cur.execute("""
            UPDATE patient_readmission_risk_predictions
            SET clinician_status = %s,
                clinician_notes = %s,
                reviewed_by = %s,
                reviewed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE prediction_id = %s;
        """, (status, clinician_notes, reviewed_by, prediction_id))

        updated = cur.rowcount > 0
        cur.close()
        conn.close()
        return updated

    def get_cohort_readmission_summary(self) -> Dict[str, Any]:
        """Provides cohort risk distribution for admitted patients."""
        conn = self.db.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("""
            SELECT 
                COUNT(*) as total_evaluated,
                COUNT(*) FILTER (WHERE risk_tier_7day = 'High') as high_risk_7d,
                COUNT(*) FILTER (WHERE risk_tier_14day = 'High') as high_risk_14d,
                COUNT(*) FILTER (WHERE risk_tier_30day = 'High') as high_risk_30d,
                ROUND(AVG(risk_score_7day), 1) as avg_7d,
                ROUND(AVG(risk_score_14day), 1) as avg_14d,
                ROUND(AVG(risk_score_30day), 1) as avg_30d
            FROM patient_readmission_risk_predictions;
        """)
        stats = cur.fetchone() or {}
        cur.close()
        conn.close()
        return dict(stats)
