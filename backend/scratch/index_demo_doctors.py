import sys
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config
import psycopg2.extras
from services.rag_ingestion_service import ingestion_service

def index_all_demo_doctors():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, display_name FROM doctors WHERE id <= 15 ORDER BY id")
    docs = cur.fetchall()
    total_indexed = 0
    for d in docs:
        doc_id = d["id"]
        doc_name = d["display_name"]
        cur.execute(
            "SELECT DISTINCT a.patient_id FROM admissions a WHERE a.doctor_id = %s AND a.discharge_date IS NULL AND a.patient_id IS NOT NULL LIMIT 8",
            (doc_id,)
        )
        pts = [r["patient_id"] for r in cur.fetchall()]
        indexed_count = 0
        for pid in pts:
            ingestion_service.reindex_patient(pid)
            indexed_count += 1
            total_indexed += 1
        print(f"Doctor {doc_id} ({doc_name}): indexed {indexed_count} active inpatients.")
    conn.close()
    print(f"Done! Successfully indexed active patients across all 15 demo doctors (total {total_indexed}).")

if __name__ == "__main__":
    index_all_demo_doctors()
