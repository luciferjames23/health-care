import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from routers.gold import get_dim_admission_inputs

res = get_dim_admission_inputs(discharge_status="all")
data = res.get("data", [])
print(f"Total returned by get_dim_admission_inputs: {len(data)}")

admitted = [r for r in data if str(r.get('discharge_status', '')).strip().lower() != 'discharged']
discharged = [r for r in data if str(r.get('discharge_status', '')).strip().lower() == 'discharged']

print(f"Admitted/Ready: {len(admitted)}")
print(f"Discharged: {len(discharged)}")

# Check if 209 active admissions are in data
import db_config
conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT a.admission_id, a.patient_id, p.first_name, p.last_name, b.bed_number
    FROM beds b
    JOIN admissions a ON b.bed_id = a.bed_id
    JOIN patients p ON a.patient_id = p.id
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id;
""")
db_admitted = cur.fetchall()
cur.close()
conn.close()

print(f"\nTotal Occupied Bed Admissions in DB: {len(db_admitted)}")

data_pids = {r.get('patient_id') for r in admitted}
data_aids = {r.get('admission_id') for r in admitted}

missing_from_admitted = []
for row in db_admitted:
    aid, pid, fn, ln, bnum = row
    if pid not in data_pids and aid not in data_aids:
        missing_from_admitted.append(row)

print(f"Occupied Bed Admissions missing from 'admitted' list in API: {len(missing_from_admitted)}")
for m in missing_from_admitted:
    print("  Missing:", m)
