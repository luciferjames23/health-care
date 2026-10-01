import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("--- 87501 to 87508 ---")
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.bed_number, d.discharge_status,
           b.status as bed_status,
           s.summary_id, s.approval_status
    FROM dim_admission_inputs d
    LEFT JOIN beds b ON d.bed_number = b.bed_number
    LEFT JOIN dim_generated_discharge_summaries s ON d.admission_id = s.admission_id
    WHERE d.admission_id BETWEEN 87501 AND 87508
    ORDER BY d.admission_id;
""")
for r in cur.fetchall():
    print(dict(r))

print("\n--- 87222 to 87230 ---")
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.bed_number, d.discharge_status,
           b.status as bed_status,
           s.summary_id, s.approval_status
    FROM dim_admission_inputs d
    LEFT JOIN beds b ON d.bed_number = b.bed_number
    LEFT JOIN dim_generated_discharge_summaries s ON d.admission_id = s.admission_id
    WHERE d.admission_id BETWEEN 87222 AND 87230
    ORDER BY d.admission_id;
""")
for r in cur.fetchall():
    print(dict(r))

cur.close()
conn.close()
