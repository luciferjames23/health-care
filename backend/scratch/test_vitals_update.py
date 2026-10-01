import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import datetime
import db_config

def test_manage_vitals(patient_code, status="normal", custom_date=None, custom_time=None):
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    # 1. Resolve date/time
    if custom_date or custom_time:
        d_str = str(custom_date or datetime.date.today().isoformat()).strip()
        t_str = str(custom_time or "12:00:00").strip()
        resolved_dt = datetime.datetime.strptime(f"{d_str} {t_str}", "%Y-%m-%d %H:%M:%S")
    else:
        resolved_dt = datetime.datetime.now()

    # 2. Extract digits
    import re
    digits = re.findall(r'\d+', str(patient_code))
    clean_digits = digits[-1].lstrip('0') if digits else None

    # 3. Lookup patient
    cur.execute("""
        SELECT admission_id, patient_id, patient_number, first_name, last_name, primary_diagnosis
        FROM dim_admission_inputs
        WHERE patient_number = %s
           OR patient_number ILIKE %s
           OR patient_id::text = %s
        LIMIT 1;
    """, (patient_code, f"%{clean_digits}%" if clean_digits else f"%{patient_code}%", clean_digits))
    adm_row = cur.fetchone()
    print("Found patient in dim_admission_inputs:", adm_row)

    if not adm_row:
        print("Not found!")
        conn.close()
        return

    aid, pid, pnum, fn, ln, diag = adm_row
    pat_name = f"{fn or ''} {ln or ''}".strip()

    # 4. Values based on normal / abnormal
    is_abnormal = status.lower() in ["abnormal", "unstable", "critical"]
    if is_abnormal:
        temp_val = 102.6
        hr_val = 126
        sbp_val = 168
        dbp_val = 104
        spo2_val = 88.0
        rr_val = 26
        classification = "ABNORMAL"
    else:
        temp_val = 98.6
        hr_val = 72
        sbp_val = 120
        dbp_val = 80
        spo2_val = 98.5
        rr_val = 16
        classification = "NORMAL"

    # 5. Update dim_admission_inputs
    cur.execute("""
        UPDATE dim_admission_inputs
        SET latest_temperature = %s,
            latest_heart_rate = %s,
            latest_systolic_bp = %s,
            latest_diastolic_bp = %s,
            latest_oxygen_saturation = %s
        WHERE admission_id = %s OR patient_id = %s;
    """, (temp_val, hr_val, sbp_val, dbp_val, spo2_val, aid, pid))

    # 6. Insert vital_signs
    cur.execute("""
        INSERT INTO vital_signs (
            patient_id, admission_id, visit_id, recorded_by,
            recorded_at, temperature, heart_rate, systolic_bp, diastolic_bp,
            respiratory_rate, oxygen_saturation
        ) VALUES (
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s
        ) RETURNING vital_id, recorded_at;
    """, (
        pid, aid, aid, 1,
        resolved_dt, temp_val, hr_val, sbp_val, dbp_val,
        rr_val, spo2_val
    ))
    res = cur.fetchone()
    conn.commit()
    print(f"SUCCESS: Vital signs ({classification}) inserted vital_id={res[0]}, recorded_at={res[1]}")

    # Check updated dim_admission_inputs
    cur.execute("SELECT latest_temperature, latest_heart_rate, latest_systolic_bp, latest_oxygen_saturation FROM dim_admission_inputs WHERE patient_id = %s;", (pid,))
    print("Updated dim_admission_inputs vitals:", cur.fetchone())
    conn.close()

if __name__ == "__main__":
    print("--- Test Normal with default now() ---")
    test_manage_vitals("MER-PAT-0087264", "normal")
    print("\n--- Test Abnormal with custom date/time ---")
    test_manage_vitals("MER-PAT-0087264", "abnormal", custom_date="2026-09-29", custom_time="10:15:00")
    print("\n--- Reset to Normal with now() ---")
    test_manage_vitals("MER-PAT-0087264", "normal")
