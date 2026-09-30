import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.discharge_status, d.bed_number,
           a.discharge_status as adm_ds, b.status as bed_status,
           ds.approval_status as summary_status
    FROM dim_admission_inputs d
    LEFT JOIN admissions a ON d.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    LEFT JOIN dim_generated_discharge_summaries ds ON d.patient_id = ds.patient_id
    WHERE d.discharge_status = 'Discharged' OR d.discharge_status = 'Ready' OR b.status = 'Occupied'
    ORDER BY d.admission_id;
""")
rows = cur.fetchall()
print(f"Total matching: {len(rows)}")
for r in rows:
    if r['discharge_status'] == 'Discharged' or r['bed_status'] == 'Occupied' and r['discharge_status'] != 'Admitted':
        print(r)

cur.close()
conn.close()
