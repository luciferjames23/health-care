import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT s.summary_id, s.patient_id, s.admission_id, s.approval_status,
           b.bed_id, b.bed_number, b.status as bed_status,
           a.discharge_status as adm_ds,
           d.discharge_status as dim_ds
    FROM dim_generated_discharge_summaries s
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    LEFT JOIN dim_admission_inputs d ON s.admission_id = d.admission_id
    ORDER BY s.summary_id;
""")
rows = cur.fetchall()
print("dim_generated_discharge_summaries count:", len(rows))
for r in rows:
    if r['approval_status'] == 'Approved' or r['bed_status'] == 'Occupied':
        print(dict(r))

cur.close()
conn.close()
