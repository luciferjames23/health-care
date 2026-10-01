import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== CHECKING ALL DISCHARGED PATIENTS ACROSS TABLES ===")

# 1. Check admissions table where discharge_status = 'Discharged'
cur.execute("""
    SELECT a.admission_id, a.patient_id, p.first_name, p.last_name, a.discharge_status, b.bed_number, b.status as bed_status
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE LOWER(a.discharge_status) = 'discharged'
    ORDER BY a.admission_id;
""")
adm_dis = cur.fetchall()
print(f"admissions table with discharge_status = 'Discharged': {len(adm_dis)}")
for r in adm_dis:
    print(" ", dict(r))

# 2. Check dim_admission_inputs where discharge_status = 'Discharged'
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.discharge_status, d.bed_number
    FROM dim_admission_inputs d
    WHERE LOWER(d.discharge_status) = 'discharged'
    ORDER BY d.admission_id;
""")
dim_dis = cur.fetchall()
print(f"\ndim_admission_inputs with discharge_status = 'Discharged': {len(dim_dis)}")
for r in dim_dis:
    print(" ", dict(r))

# 3. Check dim_generated_discharge_summaries
cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status, s.discharge_date,
           p.first_name, p.last_name, b.bed_number, b.status as bed_status
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    ORDER BY s.summary_id;
""")
sums = cur.fetchall()
print(f"\ndim_generated_discharge_summaries (total {len(sums)}):")
for s in sums:
    print(" ", dict(s))

cur.close()
conn.close()
