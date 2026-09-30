import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. ALL 53 IN dim_generated_discharge_summaries ===")
cur.execute("""
    SELECT summary_id, patient_id, admission_id, approval_status, discharge_date
    FROM dim_generated_discharge_summaries
    ORDER BY summary_id;
""")
summaries = cur.fetchall()
print(f"Total summaries: {len(summaries)}")

cur.execute("""
    SELECT summary_id, patient_id, admission_id, approval_status, discharge_date
    FROM dim_generated_discharge_summaries
    WHERE LOWER(COALESCE(approval_status, '')) IN ('approved', 'signed', 'signed off', 'completed');
""")
approved = cur.fetchall()
print(f"Approved summaries ({len(approved)}):")
for a in approved:
    print(" ", dict(a))

cur.execute("""
    SELECT summary_id, patient_id, admission_id, approval_status
    FROM dim_generated_discharge_summaries
    WHERE LOWER(COALESCE(approval_status, '')) NOT IN ('approved', 'signed', 'signed off', 'completed');
""")
pending = cur.fetchall()
print(f"Pending summaries ({len(pending)}):")

print("\n=== 2. DISCHARGED IN dim_admission_inputs ===")
cur.execute("""
    SELECT admission_id, patient_id, admission_number, patient_number, first_name, last_name, discharge_status, bed_number
    FROM dim_admission_inputs
    WHERE LOWER(discharge_status) = 'discharged';
""")
dis_adm = cur.fetchall()
print(f"Discharged in dim_admission_inputs ({len(dis_adm)}):")
for d in dis_adm:
    print(" ", dict(d))

print("\n=== 3. ACTIVE IN dim_admission_inputs ===")
cur.execute("""
    SELECT COUNT(*) as c FROM dim_admission_inputs WHERE LOWER(discharge_status) != 'discharged';
""")
print(f"Active in dim_admission_inputs: {cur.fetchone()['c']}")

cur.close()
conn.close()
