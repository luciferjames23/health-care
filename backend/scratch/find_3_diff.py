import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. 209 Occupied beds in beds table
cur.execute("""
    SELECT DISTINCT ON (b.bed_id)
        b.bed_id, b.bed_number, b.status as bed_status,
        a.admission_id, a.admission_number, a.patient_id, a.discharge_status as adm_ds,
        p.patient_code, p.first_name, p.last_name
    FROM beds b
    JOIN admissions a ON b.bed_id = a.bed_id
    JOIN patients p ON a.patient_id = p.id
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id, a.admission_id DESC;
""")
active_209 = cur.fetchall()
print(f"Active in DB on occupied beds: {len(active_209)}")

# 2. dim_admission_inputs rows
cur.execute("SELECT admission_id, patient_id, first_name, last_name, discharge_status, bed_number FROM dim_admission_inputs;")
dim_rows = cur.fetchall()
dim_active = [r for r in dim_rows if str(r['discharge_status']).strip().lower() != 'discharged']
print(f"dim_admission_inputs active (Admitted + Ready): {len(dim_active)}")

dim_active_pids = {r['patient_id'] for r in dim_active if r['patient_id'] is not None}
dim_active_aids = {r['admission_id'] for r in dim_active if r['admission_id'] is not None}

diff = [r for r in active_209 if r['patient_id'] not in dim_active_pids and r['admission_id'] not in dim_active_aids]
print(f"Difference ({len(diff)} patients):")
for r in diff:
    print(dict(r))

cur.close()
conn.close()
