import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

test_codes = ['MER-PAT-0087264', '87264', 'PAT-0087264', 'PAT-87264']

for code in test_codes:
    print(f"\n--- Testing code: {code} ---")
    # Check dim_admission_inputs
    cur.execute("""
        SELECT admission_id, patient_id, patient_number, first_name, last_name, latest_temperature, latest_heart_rate, latest_systolic_bp, latest_oxygen_saturation
        FROM dim_admission_inputs
        WHERE patient_number = %s
           OR patient_number ILIKE %s
           OR patient_id::text = %s
        LIMIT 1;
    """, (code, f"%{code}%", code.replace('MER-PAT-', '').replace('PAT-', '').lstrip('0')))
    row = cur.fetchone()
    print("dim_admission_inputs match:", row)

    # Check patients
    cur.execute("""
        SELECT id, patient_code, first_name, last_name
        FROM patients
        WHERE patient_code = %s
           OR patient_code ILIKE %s
           OR id::text = %s
        LIMIT 1;
    """, (code, f"%{code}%", code.replace('MER-PAT-', '').replace('PAT-', '').lstrip('0')))
    p_row = cur.fetchone()
    print("patients match:", p_row)

conn.close()
