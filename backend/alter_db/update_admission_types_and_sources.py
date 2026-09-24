import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
import ast
import json

def assign_admission_type_and_source(aid, reason, ward, doc_spec):
    reason_str = (reason or "").lower()
    ward_str = (ward or "").lower()
    doc_str = (doc_spec or "").lower()
    
    # 1. Emergency cases (Critical / Acute emergencies)
    if any(k in reason_str for k in ["stroke", "chest pain", "dka", "cardiac", "infarction", "respiratory failure", "acute trauma", "severe burn"]):
        adm_type = "Emergency"
        sources = ["Emergency Bay", "ER Trauma Triage", "Ambulance Intake", "Resuscitation Bay"]
        adm_source = sources[aid % len(sources)]
        return adm_type, adm_source

    # 2. Elective cases (Planned surgeries, routine procedures, orthopedic, maternity planned)
    if any(k in reason_str for k in ["cholelithiasis", "gallstone", "hernia", "laparoscopy", "cataract", "arthroscopy", "planned", "elective"]):
        adm_type = "Elective"
        sources = ["OPD Consultant Referral", "Pre-Admission Desk", "Elective Surgical List", "Specialist Clinic"]
        adm_source = sources[aid % len(sources)]
        return adm_type, adm_source

    # 3. Referral cases (Specialist opinions, inter-hospital transfers, chronic condition exacerbation)
    if any(k in reason_str for k in ["asthma", "bronchial", "nephro", "kidney", "dialysis", "oncology", "autoimmune"]):
        adm_type = "Referral"
        sources = ["External Hospital Transfer", "Physician Referral", "Consultant OPD Referral", "Inter-Facility Transfer"]
        adm_source = sources[aid % len(sources)]
        return adm_type, adm_source

    # 4. Specific multi-modal conditions
    mod = aid % 10
    if "high fever" in reason_str:
        if mod in [0, 1, 2, 3, 4]:
            return "Emergency", ["Emergency Bay", "Pediatric ER", "Fever Triage"][aid % 3]
        elif mod in [5, 6, 7]:
            return "Referral", ["Physician Referral", "Consultant OPD Referral"][aid % 2]
        else:
            return "Urgent", "Day Care Unit"
    elif "fracture" in reason_str:
        if mod in [0, 1, 2, 3]:
            return "Emergency", ["Emergency Bay", "ER Trauma Triage"][aid % 2]
        else:
            return "Elective", ["OPD Consultant Referral", "Pre-Admission Desk", "Elective Surgical List"][aid % 3]
    elif "preterm" in reason_str or "labor" in reason_str:
        if mod in [0, 1, 2, 3, 4]:
            return "Emergency", ["Maternity ER Triage", "Emergency Bay"][aid % 2]
        else:
            return "Elective", ["Obstetric OPD Referral", "Planned Maternity Desk"][aid % 2]
    elif "gastro" in reason_str:
        if mod in [0, 1, 2, 3]:
            return "Referral", ["Consultant OPD Referral", "External Hospital Transfer"][aid % 2]
        elif mod in [4, 5, 6]:
            return "Elective", ["OPD Consultant Referral", "Pre-Admission Desk"][aid % 2]
        else:
            return "Emergency", "Emergency Bay"
    elif "abdominal" in reason_str:
        if mod in [0, 1, 2, 3]:
            return "Emergency", ["Emergency Bay", "ER Acute Triage"][aid % 2]
        elif mod in [4, 5, 6]:
            return "Urgent", "Outpatient Escalation"
        else:
            return "Referral", "Consultant OPD Referral"
    else:
        if mod in [0, 1, 2]:
            return "Emergency", "Emergency Bay"
        elif mod in [3, 4, 5]:
            return "Elective", "OPD Consultant Referral"
        elif mod in [6, 7, 8]:
            return "Referral", "Physician Referral"
        else:
            return "Urgent", "Day Care Unit"

def run_update():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    
    print("[1/2] Updating dim_admission_inputs table...")
    cur.execute("SELECT admission_id, reason_for_admission, ward_name, doctor_specialization, llm_input_json FROM dim_admission_inputs;")
    dim_rows = cur.fetchall()
    
    dim_updates = 0
    for aid, reason, ward, doc_spec, raw_json in dim_rows:
        adm_type, adm_source = assign_admission_type_and_source(aid, reason, ward, doc_spec)
        
        # Parse and update llm_input_json
        parsed = {}
        if raw_json:
            try:
                parsed = json.loads(raw_json) if isinstance(raw_json, str) and raw_json.strip().startswith('{') else ast.literal_eval(raw_json)
            except Exception:
                try:
                    parsed = ast.literal_eval(raw_json)
                except Exception:
                    parsed = {}
        
        if parsed and isinstance(parsed, dict):
            if "admission_details" not in parsed:
                parsed["admission_details"] = {}
            parsed["admission_details"]["admission_type"] = adm_type
            parsed["admission_details"]["admission_source"] = adm_source
            new_json_str = json.dumps(parsed)
        else:
            new_json_str = raw_json
        
        cur.execute("""
            UPDATE dim_admission_inputs
            SET admission_type = %s,
                admission_source = %s,
                llm_input_json = %s
            WHERE admission_id = %s;
        """, (adm_type, adm_source, new_json_str, aid))
        dim_updates += 1
    
    conn.commit()
    print(f"Updated {dim_updates} rows in dim_admission_inputs.")
    
    print("[2/2] Updating admissions table...")
    cur.execute("SELECT admission_id, reason_for_admission, ward_id, doctor_id FROM admissions;")
    adm_rows = cur.fetchall()
    
    adm_updates = 0
    for aid, reason, ward_id, doctor_id in adm_rows:
        adm_type, adm_source = assign_admission_type_and_source(aid, reason, str(ward_id or ""), "")
        cur.execute("""
            UPDATE admissions
            SET admission_type = %s,
                admission_source = %s
            WHERE admission_id = %s;
        """, (adm_type, adm_source, aid))
        adm_updates += 1
        if adm_updates % 10000 == 0:
            conn.commit()
            print(f"  ...processed {adm_updates} / {len(adm_rows)} admissions")
            
    conn.commit()
    print(f"Updated {adm_updates} rows in admissions.")
    
    # Verification
    cur.execute("SELECT admission_type, COUNT(*) FROM dim_admission_inputs GROUP BY admission_type;")
    print("dim_admission_inputs breakdown:", cur.fetchall())
    
    cur.execute("SELECT admission_source, COUNT(*) FROM dim_admission_inputs GROUP BY admission_source;")
    print("dim_admission_inputs source breakdown:", cur.fetchall())

    cur.execute("SELECT admission_type, COUNT(*) FROM admissions GROUP BY admission_type;")
    print("admissions breakdown:", cur.fetchall())
    
    cur.close()
    conn.close()
    print("Successfully updated admission types and sources in database.")

if __name__ == "__main__":
    run_update()
