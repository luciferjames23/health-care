import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. 209 Occupied beds
cur.execute("""
    SELECT DISTINCT ON (b.bed_id)
        b.bed_id, b.bed_number, a.admission_id, a.patient_id, p.first_name, p.last_name, a.admission_number, p.patient_code
    FROM beds b
    JOIN admissions a ON b.bed_id = a.bed_id
    JOIN patients p ON a.patient_id = p.id
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id, a.admission_id DESC;
""")
occ_beds = cur.fetchall()
print(f"Total Occupied Beds: {len(occ_beds)}")

cur.execute("SELECT admission_id, patient_id, discharge_status FROM dim_admission_inputs WHERE discharge_status IN ('Admitted', 'Ready');")
dim_active = cur.fetchall()
print(f"Total Active in dim_admission_inputs: {len(dim_active)}")

dim_aids = {r['admission_id'] for r in dim_active}
dim_pids = {r['patient_id'] for r in dim_active}

missing = [b for b in occ_beds if b['admission_id'] not in dim_aids and b['patient_id'] not in dim_pids]
print(f"Missing from dim_admission_inputs active ({len(missing)}):")
for m in missing:
    print(" ", dict(m))

# Check why missing: is it marked as Discharged in dim_admission_inputs?
for m in missing:
    cur.execute("SELECT * FROM dim_admission_inputs WHERE admission_id = %s OR patient_id = %s;", (m['admission_id'], m['patient_id']))
    print("In dim:", cur.fetchall())

cur.close()
conn.close()
