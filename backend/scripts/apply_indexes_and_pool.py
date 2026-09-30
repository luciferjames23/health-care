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
            "CREATE INDEX IF NOT EXISTS idx_conversations_wa_num ON conversations (whatsapp_number);",
            "CREATE INDEX IF NOT EXISTS idx_conversations_code ON conversations (conversation_code);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_doc_date ON appointments (doctor_id, appointment_date);",
            "CREATE INDEX IF NOT EXISTS idx_appointments_pat_id ON appointments (patient_id);"
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
