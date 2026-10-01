import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Query current active admission for each occupied bed:
# We look for the latest admission for each bed that has status = 'Occupied'
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
current_occupied = cur.fetchall()
print(f"Total current occupied beds with active admissions: {len(current_occupied)}")

from routers.gold import get_dim_admission_inputs
res = get_dim_admission_inputs(discharge_status="all")
api_data = res.get("data", [])
print(f"API data count: {len(api_data)}")

api_admitted = [r for r in api_data if str(r.get('discharge_status', '')).strip().lower() != 'discharged']
api_discharged = [r for r in api_data if str(r.get('discharge_status', '')).strip().lower() == 'discharged']
print(f"API admitted count: {len(api_admitted)}")
print(f"API discharged count: {len(api_discharged)}")

api_pids = {r.get('patient_id') for r in api_admitted}
api_aids = {r.get('admission_id') for r in api_admitted}

missing = [r for r in current_occupied if r['patient_id'] not in api_pids and r['admission_id'] not in api_aids]
print(f"Occupied beds missing from API active admitted: {len(missing)}")
for m in missing:
    print("  Missing:", m)

cur.close()
conn.close()
