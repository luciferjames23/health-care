import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT admission_id, patient_id, discharge_status
    FROM dim_admission_inputs
    WHERE LOWER(discharge_status) = 'discharged'
    ORDER BY admission_id;
""")
discharged_adms = cur.fetchall()
print(f"Total Discharged admissions in dim_admission_inputs: {len(discharged_adms)}")
for da in discharged_adms:
    print(da)

# Let's check which of these admission_ids or patient_ids are in dim_generated_discharge_summaries!
cur.execute("SELECT summary_id, admission_id, patient_id, approval_status FROM dim_generated_discharge_summaries;")
sums = cur.fetchall()
sum_adm_ids = {s['admission_id']: s for s in sums}
sum_pat_ids = {s['patient_id']: s for s in sums}

print("\nMatching discharged admissions with summaries:")
for da in discharged_adms:
    aid = da['admission_id']
    pid = da['patient_id']
    in_adm = sum_adm_ids.get(aid)
    in_pat = sum_pat_ids.get(pid)
    print(f"Adm ID {aid}, Pat ID {pid} -> Match by adm_id: {bool(in_adm)} (summary_id {in_adm['summary_id'] if in_adm else None}, status: {in_adm['approval_status'] if in_adm else None}) | Match by pat_id: {bool(in_pat)}")

cur.close()
conn.close()
