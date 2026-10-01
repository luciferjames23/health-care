import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status,
           d.admission_id as dim_aid, d.patient_id as dim_pid, d.discharge_status as dim_ds,
           b.bed_number, b.status as bed_status
    FROM dim_generated_discharge_summaries s
    LEFT JOIN dim_admission_inputs d ON (s.admission_id = d.admission_id OR s.patient_id = d.patient_id)
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    ORDER BY s.summary_id;
""")
rows = cur.fetchall()
print(f"Total 53 summaries in dim_generated_discharge_summaries:")
matched_in_dim = [r for r in rows if r['dim_aid'] is not None]
print(f"Matched in dim_admission_inputs: {len(matched_in_dim)}")
unmatched = [r for r in rows if r['dim_aid'] is None]
print(f"Unmatched in dim_admission_inputs: {len(unmatched)}")
for u in unmatched:
    print("  Unmatched:", dict(u))

cur.close()
conn.close()
