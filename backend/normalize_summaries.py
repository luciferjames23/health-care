"""
Format and normalize all existing records in dim_generated_discharge_summaries in PostgreSQL.
Converts any raw JSON / Python dictionary strings in diagnoses, investigations, treatment, discharge_advice, etc. into clean clinical text.
"""
import re
import json
from db_config import get_db_connection


def format_clinical_diagnoses(val):
    if not val:
        return ""
    if isinstance(val, list):
        items = []
        for item in val:
            if isinstance(item, dict):
                desc = item.get("description") or item.get("name") or item.get("diagnosis") or item.get("primary") or ""
                code = item.get("icd10") or item.get("code") or item.get("icd") or ""
                items.append(f"{desc} (ICD-10: {code})" if code and code not in desc else desc)
            else:
                items.append(str(item).strip())
        return "; ".join(filter(None, items))
    if isinstance(val, dict):
        desc = val.get("description") or val.get("name") or val.get("diagnosis") or val.get("primary") or ""
        code = val.get("icd10") or val.get("code") or val.get("icd") or ""
        res = f"{desc} (ICD-10: {code})" if code and code not in desc else desc
        sec = val.get("secondary")
        if isinstance(sec, list) and sec:
            sec_items = [s.get("description", str(s)) if isinstance(s, dict) else str(s) for s in sec]
            res = f"{res}; Secondary: {'; '.join(sec_items)}"
        return res

    s = str(val).strip()
    if "{" in s or "[" in s:
        # Try JSON parse
        try:
            parsed = json.loads(s)
            return format_clinical_diagnoses(parsed)
        except Exception:
            pass
        # Try Python dict regex extraction
        dict_matches = re.findall(r'\{([^{}]+)\}', s)
        if dict_matches:
            items = []
            for m in dict_matches:
                desc_m = re.search(r'[\'\"](?:description|name|diagnosis|primary)[\'\"]\s*:\s*[\'\"]([^\'\"]+)[\'\"]', m, re.I)
                icd_m = re.search(r'[\'\"](?:icd10|code|icd)[\'\"]\s*:\s*[\'\"]([^\'\"]+)[\'\"]', m, re.I)
                desc = desc_m.group(1).strip() if desc_m else ""
                icd = icd_m.group(1).strip() if icd_m else ""
                if desc and icd and icd not in desc:
                    items.append(f"{desc} (ICD-10: {icd})")
                elif desc:
                    items.append(desc)
            if items:
                return "; ".join(items)

    # Clean up empty brackets and trailing symbols
    s = re.sub(r'(?:[;,|]\s*)?Secondary(?:\s+Diagnoses|\s+Diagnosis)?\s*:\s*\[\s*\]', '', s, flags=re.I)
    s = re.sub(r':\s*\[\s*\]', '', s)
    s = re.sub(r'\[\s*\]', '', s)
    return s.strip(" ;:,")


def format_clinical_investigations(val):
    if not val:
        return "Routine hematology, biochemistry, and diagnostic workup satisfactory."
    
    data = None
    if isinstance(val, dict):
        data = val
    elif isinstance(val, str) and ("{" in val or "[" in val):
        try:
            data = json.loads(val)
        except Exception:
            try:
                # Replace single quotes with double quotes
                cleaned_str = val.replace("'", '"')
                data = json.loads(cleaned_str)
            except Exception:
                pass

    if not data or not isinstance(data, dict):
        # Already plain string or unparseable
        clean_s = str(val).replace("\\u00b5L", "µL").replace("\\u00b0F", "°F").replace("\\u202f", " ")
        return clean_s

    sections = []

    # 1. Vitals
    vitals = data.get("vitals") or data.get("vitals_on_admission") or data.get("vital_signs")
    if vitals:
        if isinstance(vitals, dict):
            adm_v = vitals.get("admission") or vitals
            v_parts = []
            if isinstance(adm_v, dict):
                temp = adm_v.get("temperature_F") or adm_v.get("temperature_f") or adm_v.get("temperature") or adm_v.get("temp")
                hr = adm_v.get("heart_rate_bpm") or adm_v.get("heart_rate") or adm_v.get("hr")
                bp = adm_v.get("blood_pressure_mmHg") or adm_v.get("blood_pressure") or adm_v.get("bp")
                spo2 = adm_v.get("spO2_percent") or adm_v.get("spo2") or adm_v.get("oxygen_saturation")
                rr = adm_v.get("respiratory_rate_bpm") or adm_v.get("rr")

                if temp: v_parts.append(f"Temp {temp}°F")
                if hr: v_parts.append(f"HR {hr} bpm")
                if bp: v_parts.append(f"BP {bp} mmHg")
                if rr: v_parts.append(f"RR {rr}/min")
                if spo2: v_parts.append(f"SpO2 {spo2}%")
            
            v_str = f"Vitals on Admission: {', '.join(v_parts)}" if v_parts else ""
            trend = vitals.get("trend") or vitals.get("trend_summary") or vitals.get("discharge_vitals")
            if trend:
                v_str = f"{v_str} · Inpatient Trend: {trend}" if v_str else f"Vitals Trend: {trend}"
            if v_str:
                sections.append(v_str)
        elif isinstance(vitals, str):
            sections.append(f"Vitals: {vitals}")

    # 2. Laboratory
    lab = data.get("laboratory") or data.get("laboratory_investigations") or data.get("labs") or data.get("blood_tests")
    if lab and isinstance(lab, dict):
        lab_parts = []
        for lab_key, lab_val in lab.items():
            k_title = lab_key.replace("_", " ").upper() if len(lab_key) <= 4 else lab_key.replace("_", " ").title()
            if isinstance(lab_val, dict):
                sub_items = [f"{sub_k}: {sub_v}" for sub_k, sub_v in lab_val.items()]
                lab_parts.append(f"{k_title} ({', '.join(sub_items)})")
            elif isinstance(lab_val, list):
                lab_parts.append(f"{k_title}: {', '.join(str(x) for x in lab_val)}")
            else:
                lab_parts.append(f"{k_title}: {lab_val}")
        if lab_parts:
            sections.append(f"Laboratory Findings: {'; '.join(lab_parts)}")
    elif lab and isinstance(lab, str):
        sections.append(f"Laboratory Findings: {lab}")

    # 3. Imaging & Diagnostics
    img = data.get("imaging") or data.get("imaging_findings") or data.get("radiology") or data.get("diagnostics")
    if img and isinstance(img, dict):
        img_parts = []
        for img_k, img_v in img.items():
            k_title = img_k.replace("_", " ").title()
            img_parts.append(f"{k_title}: {img_v}")
        if img_parts:
            sections.append(f"Imaging & Diagnostics: {'; '.join(img_parts)}")
    elif img and isinstance(img, str):
        sections.append(f"Imaging: {img}")

    # 4. ECG / Other keys
    ecg = data.get("ECG") or data.get("ecg")
    if ecg:
        sections.append(f"ECG: {ecg}")

    if not sections:
        # Fallback to key-value pairs
        for k, v in data.items():
            if k not in ["vitals", "laboratory", "imaging", "ECG"]:
                sections.append(f"{k.replace('_', ' ').title()}: {v}")

    joined = "\n".join(sections)
    return joined.replace("\\u00b5L", "µL").replace("\\u00b0F", "°F").replace("\\u202f", " ")


def format_clinical_treatment(val):
    if not val:
        return "Inpatient care and stabilization administered as per protocol."
    
    data = None
    if isinstance(val, dict):
        data = val
    elif isinstance(val, str) and ("{" in val or "[" in val):
        try:
            data = json.loads(val)
        except Exception:
            try:
                data = json.loads(val.replace("'", '"'))
            except Exception:
                pass

    if not data or not isinstance(data, dict):
        return str(val)

    meds = data.get("medications") or data.get("inpatient_medications") or data.get("treatments") or data.get("prescriptions")
    if isinstance(meds, list) and meds:
        lines = ["Inpatient care and stabilization administered:"]
        for idx, m in enumerate(meds, 1):
            if isinstance(m, dict):
                name = m.get("name") or m.get("medicine") or m.get("drug") or "Medication"
                dose = m.get("dose") or m.get("dosage") or ""
                route = m.get("route") or ""
                freq = m.get("frequency") or m.get("freq") or ""
                ind = m.get("indication") or m.get("indication_notes") or m.get("notes") or ""

                detail_parts = []
                if dose: detail_parts.append(f"Dosage: {dose}")
                if route: detail_parts.append(f"Route: {route}")
                if freq: detail_parts.append(f"Freq: {freq}")
                if ind: detail_parts.append(f"Indication: {ind}")
                details_str = " - ".join(detail_parts) if detail_parts else "As directed"
                lines.append(f"{idx}. Administered: {name} - {details_str}")
            else:
                lines.append(f"{idx}. {m}")
        return "\n".join(lines)
    
    return str(val)


def format_clinical_advice(val):
    if not val:
        return "Follow-up in OPD as advised by attending physician."
    
    data = None
    if isinstance(val, dict):
        data = val
    elif isinstance(val, str) and ("{" in val or "[" in val):
        try:
            data = json.loads(val)
        except Exception:
            try:
                data = json.loads(val.replace("'", '"'))
            except Exception:
                pass

    if not data or not isinstance(data, dict):
        # Strip tamil
        lines = []
        for line in str(val).split("\n"):
            if "தமிழ்" in line or "tamil" in line.lower() or any('\u0B80' <= c <= '\u0BFF' for c in line):
                continue
            lines.append(line)
        return "\n".join(lines).strip()

    lines = []
    idx = 1
    for k in ["discharge_medications", "medications", "diet", "activity", "lifestyle", "red_flags", "emergency_warning", "followup", "follow_up", "review"]:
        v = data.get(k)
        if v:
            if isinstance(v, list):
                for item in v:
                    lines.append(f"{idx}. {item}")
                    idx += 1
            else:
                lines.append(f"{idx}. {v}")
                idx += 1
    
    if not lines:
        for k, v in data.items():
            lines.append(f"{idx}. {k.replace('_', ' ').title()}: {v}")
            idx += 1

    return "\n".join(lines)


def format_clinical_condition(val):
    if not val:
        return "Patient is hemodynamically stable, alert, conscious, and oriented at discharge."
    
    if isinstance(val, dict):
        stab = val.get("stability") or val.get("status") or "Hemodynamically stable"
        vitals = val.get("vital_signs") or val.get("vitals") or ""
        amb = val.get("ambulation") or val.get("diet") or ""
        notes = val.get("notes") or ""
        parts = [stab]
        if vitals: parts.append(f"Vital signs: {vitals}")
        if amb: parts.append(amb)
        if notes: parts.append(notes)
        return ". ".join(parts)
    
    s = str(val).replace("\\u00b0F", "°F").replace("\\u202f", " ")
    s = re.sub(r'([a-zA-Z0-9.,;:%\/°])-(?:\s+|$)', r'\1 ', s)
    s = re.sub(r'-([a-zA-Z0-9.,;:%\/°])', r'\1', s)
    s = re.sub(r'\s+', ' ', s).replace("°°F", "°F").strip(' -')
    return s


def run_migration():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT summary_id, patient_id, diagnoses, investigations, treatment, discharge_advice, patient_condition FROM dim_generated_discharge_summaries;")
    rows = cur.fetchall()
    print(f"Found {len(rows)} records to inspect and normalize...")

    updated_count = 0
    for row in rows:
        sid, pid, raw_diag, raw_inv, raw_trt, raw_adv, raw_cond = row
        clean_diag = format_clinical_diagnoses(raw_diag)
        clean_inv = format_clinical_investigations(raw_inv)
        clean_trt = format_clinical_treatment(raw_trt)
        clean_adv = format_clinical_advice(raw_adv)
        clean_cond = format_clinical_condition(raw_cond)

        cur.execute("""
            UPDATE dim_generated_discharge_summaries
            SET diagnoses = %s,
                investigations = %s,
                treatment = %s,
                discharge_advice = %s,
                patient_condition = %s
            WHERE summary_id = %s;
        """, (clean_diag, clean_inv, clean_trt, clean_adv, clean_cond, sid))
        updated_count += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Successfully normalized {updated_count} discharge summaries in PostgreSQL!")


if __name__ == "__main__":
    run_migration()
