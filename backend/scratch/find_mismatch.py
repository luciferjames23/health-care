import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Get all occupied beds
cur.execute("""
    SELECT b.bed_id, b.bed_number, b.ward_id, w.ward_name, b.room_id, r.room_number, b.status,
           a.admission_id, a.patient_id, a.discharge_status as adm_discharge_status,
           p.first_name, p.last_name, p.patient_code
    FROM beds b
    LEFT JOIN wards w ON b.ward_id = w.ward_id
    LEFT JOIN rooms r ON b.room_id = r.room_id
    LEFT JOIN (
        SELECT DISTINCT ON (bed_id) *
        FROM admissions
        ORDER BY bed_id, admission_id DESC
    ) a ON b.bed_id = a.bed_id
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id;
""")
occ_beds = cur.fetchall()
print(f"Total Occupied Beds in DB: {len(occ_beds)}")

# 2. Get all rows from dim_admission_inputs
cur.execute("SELECT admission_id, patient_id, first_name, last_name, discharge_status, bed_number FROM dim_admission_inputs;")
dim_rows = cur.fetchall()
print(f"Total Rows in dim_admission_inputs: {len(dim_rows)}")

dim_by_aid = {r['admission_id']: r for r in dim_rows if r['admission_id'] is not None}
dim_by_pid = {r['patient_id']: r for r in dim_rows if r['patient_id'] is not None}
dim_by_bed = {r['bed_number']: r for r in dim_rows if r['bed_number'] is not None}

print("\n--- Checking Occupied Beds vs dim_admission_inputs ---")
missing_or_mismatched = []
for b in occ_beds:
    aid = b['admission_id']
    pid = b['patient_id']
    bnum = b['bed_number']
    
    in_dim_aid = dim_by_aid.get(aid)
    in_dim_pid = dim_by_pid.get(pid)
    in_dim_bed = dim_by_bed.get(bnum)
    
    dim_match = in_dim_aid or in_dim_pid or in_dim_bed
    if not dim_match:
        missing_or_mismatched.append(("Completely Missing from dim", b))
    elif str(dim_match.get('discharge_status', '')).strip().lower() == 'discharged':
        missing_or_mismatched.append(("Marked as Discharged in dim", b, dim_match))

print(f"Found {len(missing_or_mismatched)} issues:")
for item in missing_or_mismatched:
    print(item)

cur.close()
conn.close()
