import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

def migrate_vital_signs():
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    print("1. Adding patient_code column to vital_signs if not exists...")
    cur.execute("""
        ALTER TABLE vital_signs 
        ADD COLUMN IF NOT EXISTS patient_code VARCHAR(50);
    """)
    conn.commit()
    print("Column added or already exists.")

    print("\n2. Backfilling patient_code from patients table...")
    cur.execute("""
        UPDATE vital_signs vs
        SET patient_code = p.patient_code
        FROM patients p
        WHERE vs.patient_id = p.id AND (vs.patient_code IS NULL OR vs.patient_code = '');
    """)
    updated_from_patients = cur.rowcount
    conn.commit()
    print(f"Updated {updated_from_patients} rows from patients table.")

    print("\n3. Backfilling any remaining from dim_admission_inputs...")
    cur.execute("""
        UPDATE vital_signs vs
        SET patient_code = dai.patient_number
        FROM dim_admission_inputs dai
        WHERE vs.patient_id = dai.patient_id AND (vs.patient_code IS NULL OR vs.patient_code = '');
    """)
    updated_from_dai = cur.rowcount
    conn.commit()
    print(f"Updated {updated_from_dai} rows from dim_admission_inputs table.")

    print("\n4. Verifying column and sample data in vital_signs:")
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'vital_signs';
    """)
    cols = cur.fetchall()
    print("vital_signs columns:", [c[0] for c in cols])

    cur.execute("""
        SELECT vital_id, patient_id, patient_code, recorded_at, temperature, heart_rate, systolic_bp, diastolic_bp, oxygen_saturation
        FROM vital_signs 
        WHERE patient_code IS NOT NULL
        ORDER BY vital_id DESC
        LIMIT 5;
    """)
    samples = cur.fetchall()
    print("\nLatest 5 rows in vital_signs with patient_code:")
    for s in samples:
        print(s)

    conn.close()

if __name__ == "__main__":
    migrate_vital_signs()
