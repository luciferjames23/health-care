import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Let's inspect all summaries in dim_generated_discharge_summaries for the discharged patients
cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status, s.discharge_date,
           p.first_name, p.last_name, p.patient_code,
           d.discharge_status as dim_ds, a.discharge_status as adm_ds, b.bed_number, b.status as bed_status
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    LEFT JOIN dim_admission_inputs d ON (s.admission_id = d.admission_id OR s.patient_id = d.patient_id)
    ORDER BY s.summary_id;
""")
all_sums = cur.fetchall()

# Also check all discharged in dim_admission_inputs
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.discharge_status, d.bed_number,
           s.summary_id, s.approval_status
    FROM dim_admission_inputs d
    LEFT JOIN dim_generated_discharge_summaries s ON (d.admission_id = s.admission_id OR d.patient_id = s.patient_id)
    WHERE LOWER(d.discharge_status) = 'discharged'
    ORDER BY d.admission_id;
""")
dim_dis = cur.fetchall()

print(f"Discharged in dim_admission_inputs ({len(dim_dis)}):")
for d in dim_dis:
    print(" ", dict(d))

# Check the 11 approved discharge summaries that were originally in dim_generated_discharge_summaries
# Or check the 87223..87239 summaries
cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status, s.discharge_date,
           p.first_name, p.last_name, b.bed_number, b.status as bed_status,
           d.discharge_status as dim_ds
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    LEFT JOIN dim_admission_inputs d ON (s.admission_id = d.admission_id OR s.patient_id = d.patient_id)
    WHERE s.summary_id BETWEEN 87223 AND 87240
    ORDER BY s.summary_id;
""")
sums_range = cur.fetchall()
print(f"\nSummaries in 87223..87240 range ({len(sums_range)}):")
for s in sums_range:
    print(" ", dict(s))

cur.close()
conn.close()
