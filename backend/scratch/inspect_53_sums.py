import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Let's inspect all 53 summaries with patient and admission info:
cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status,
           p.first_name, p.last_name, a.bed_number, a.discharge_status
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN dim_admission_inputs a ON s.admission_id = a.admission_id
    ORDER BY s.summary_id;
""")
sums = cur.fetchall()

print("All 53 summaries:")
for i, s in enumerate(sums):
    print(f"#{i+1:02d} Summary ID: {s['summary_id']}, Adm ID: {s['admission_id']}, Pat ID: {s['patient_id']}, Status: {s['approval_status']}, Name: {s['first_name']} {s['last_name']}, Bed: {s['bed_number']}, Adm Discharge Status: {s['discharge_status']}")

cur.close()
conn.close()
