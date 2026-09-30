import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Let's check the 11 approved summaries in dim_generated_discharge_summaries
cur.execute("""
    SELECT s.summary_id, s.patient_id, s.admission_id, s.approval_status, s.discharge_date,
           p.first_name, p.last_name, p.patient_code,
           a.admission_number, a.discharge_status as adm_ds, a.bed_id,
           b.bed_number, b.status as bed_status,
           d.discharge_status as dim_ds
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    LEFT JOIN dim_admission_inputs d ON s.admission_id = d.admission_id
    WHERE LOWER(COALESCE(s.approval_status, '')) IN ('approved', 'signed', 'signed off', 'completed')
    ORDER BY s.summary_id;
""")
approved_summaries = cur.fetchall()
print(f"--- 11 APPROVED DISCHARGE SUMMARIES ---")
for r in approved_summaries:
    print(dict(r))

# Also check the 12 records marked as Discharged in dim_admission_inputs
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.discharge_status, d.bed_number,
           a.discharge_status as adm_ds, b.status as bed_status, s.approval_status
    FROM dim_admission_inputs d
    LEFT JOIN admissions a ON d.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    LEFT JOIN dim_generated_discharge_summaries s ON d.admission_id = s.admission_id
    WHERE LOWER(d.discharge_status) = 'discharged'
    ORDER BY d.admission_id;
""")
dim_discharged = cur.fetchall()
print(f"\n--- 12 DISCHARGED IN DIM_ADMISSION_INPUTS ---")
for r in dim_discharged:
    print(dict(r))

cur.close()
conn.close()
