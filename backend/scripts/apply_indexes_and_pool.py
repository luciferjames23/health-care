"""
apply_indexes_and_pool.py
=========================
Creates high-performance PostgreSQL indexes for fast patient lookup,
conversation history, doctor availability, and appointment queries.
"""

import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import db_config

def apply_indexes():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        queries = [
            "CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);",
            "CREATE INDEX IF NOT EXISTS idx_patients_code ON patients (patient_code);",
            "CREATE INDEX IF NOT EXISTS idx_conversations_wa_num ON conversations (whatsapp_number);",
            "CREATE INDEX IF NOT EXISTS idx_conversations_code ON conversations (conversation_code);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_doc_date ON appointments (doctor_id, appointment_date);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_pat_id ON appointments (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient_id ON insurance_claims (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_patient_insurance_patient_id ON patient_insurance (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_dim_gen_ds_pat_id ON dim_generated_discharge_summaries (patient_id);",
            "CREATE INDEX IF NOT EXISTS idx_dim_gen_ds_adm_id ON dim_generated_discharge_summaries (admission_id);",
            "CREATE INDEX IF NOT EXISTS idx_admissions_discharge_status ON admissions (discharge_status);",
            "CREATE INDEX IF NOT EXISTS idx_admissions_bed_id ON admissions (bed_id);",
            "CREATE INDEX IF NOT EXISTS idx_beds_status ON beds (status);",
            "CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (payment_status);",
            "CREATE INDEX IF NOT EXISTS idx_bills_patient_id ON bills (patient_id);"
        ]
        for q in queries:
            cur.execute(q)
        conn.commit()
        print("[DB_INDEXES] Successfully verified/created high-performance DB indexes.")
    except Exception as e:
        print(f"[DB_INDEXES_ERROR] Index creation warning: {e}")
        if conn:
            conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    apply_indexes()
