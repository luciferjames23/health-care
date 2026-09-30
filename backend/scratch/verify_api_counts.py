import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from routers.gold import get_dim_admission_inputs

res = get_dim_admission_inputs(discharge_status="all")
data = res.get("data", [])
print(f"Total returned by get_dim_admission_inputs: {len(data)}")

admitted = [r for r in data if str(r.get('discharge_status', '')).strip().lower() != 'discharged']
discharged = [r for r in data if str(r.get('discharge_status', '')).strip().lower() == 'discharged']

print(f"Admitted/Ready in API: {len(admitted)}")
print(f"Discharged in API: {len(discharged)}")

import db_config
conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM beds WHERE status = 'Occupied';")
occ_cnt = cur.fetchone()[0]
cur.close()
conn.close()

print(f"Occupied beds in DB: {occ_cnt}")
assert len(admitted) == occ_cnt, f"Mismatch: {len(admitted)} vs {occ_cnt}"
print("PERFECT MATCH: API returns exactly the occupied bed count!")
