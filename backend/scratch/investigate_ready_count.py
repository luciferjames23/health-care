import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("--- dim_generated_discharge_summaries ---")
cur.execute("""
    SELECT summary_id, admission_id, patient_id, approval_status
    FROM dim_generated_discharge_summaries
    ORDER BY summary_id;
""")
sums = cur.fetchall()
print(f"Total summaries in table: {len(sums)}")
approved_sums = [s for s in sums if (s['approval_status'] or '').lower() in ('approved', 'signed', 'completed')]
pending_sums = [s for s in sums if (s['approval_status'] or '').lower() not in ('approved', 'signed', 'completed')]
print(f"Approved summaries ({len(approved_sums)}): {[s['summary_id'] for s in approved_sums]}")
print(f"Pending summaries ({len(pending_sums)}): count={len(pending_sums)}")

print("\n--- dim_admission_inputs ---")
cur.execute("""
    SELECT discharge_status, COUNT(*) 
    FROM dim_admission_inputs 
    GROUP BY discharge_status;
""")
print("Status counts in dim_admission_inputs:", cur.fetchall())

cur.execute("""
    SELECT admission_id, patient_id, discharge_status
    FROM dim_admission_inputs
    WHERE LOWER(discharge_status) = 'ready';
""")
ready_adms = cur.fetchall()
print(f"\nAdmissions with discharge_status='Ready' in dim_admission_inputs: {len(ready_adms)}")

# Check which ready admissions in dim_admission_inputs are NOT in dim_generated_discharge_summaries
sum_pat_ids = {str(s['patient_id']) for s in sums}
sum_adm_ids = {str(s['admission_id']) for s in sums}

extra_ready = []
for a in ready_adms:
    pid = str(a['patient_id'])
    aid = str(a['admission_id'])
    if pid not in sum_pat_ids and aid not in sum_adm_ids:
        extra_ready.append(a)

print(f"\nReady admissions in dim_admission_inputs that are NOT in summaries ({len(extra_ready)}):")
for er in extra_ready:
    print(er)

# Also let's check how the frontend builds allCases!
# In frontend:
# 1. rawSummaries: 53 records -> 11 Approved (category = 'Completed'), 42 Pending (category = 'Ready')
# 2. rawAdmissions: loops over rawAdmissions. If patient_id / admission_id not in processedPatientIds:
#    it checks if adm.discharge_status == 'Ready' -> adds to category = 'Ready'!
# If there are 2 admissions in dim_admission_inputs that have discharge_status = 'Ready' and are NOT in rawSummaries,
# then resultCases gets 42 (from summaries) + 2 (from rawAdmissions) = 44 Ready!
# And 11 (from summaries) = 11 Completed!
# Total = 44 + 11 = 55!

cur.close()
conn.close()
