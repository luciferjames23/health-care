import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT s.summary_id, s.patient_id, s.admission_id, s.approval_status,
           b.bed_number, b.status as bed_status, a.discharge_status as adm_ds
    FROM dim_generated_discharge_summaries s
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    ORDER BY s.summary_id;
""")
summaries = cur.fetchall()
print(f"Total summaries: {len(summaries)}")
approved_on_occupied = [s for s in summaries if s['approval_status'] == 'Approved' and s['bed_status'] == 'Occupied']
print(f"Approved summaries for patients who are currently OCCUPYING a bed: {len(approved_on_occupied)}")
for a in approved_on_occupied:
    print(" ", dict(a))

approved_on_available = [s for s in summaries if s['approval_status'] == 'Approved' and s['bed_status'] != 'Occupied']
print(f"Approved summaries for patients who are truly DISCHARGED (bed available): {len(approved_on_available)}")
for a in approved_on_available:
    print(" ", dict(a))

cur.close()
conn.close()
