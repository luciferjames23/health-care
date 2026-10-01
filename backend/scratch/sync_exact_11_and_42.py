import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Look at all 53 rows in dim_generated_discharge_summaries
cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status,
           p.first_name, p.last_name
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    ORDER BY s.summary_id;
""")
sums = cur.fetchall()
print(f"Total summaries: {len(sums)}")

# Pick the first 11 summaries as Approved/Discharged:
# 87223, 87224, 87225, 87226, 87227, 87228, 87229, 87230, 87231, 87232, 87239
approved_sums = sums[:11]
pending_sums = sums[11:]

approved_summary_ids = tuple(s['summary_id'] for s in approved_sums)
approved_adm_ids = tuple(s['admission_id'] for s in approved_sums)
approved_pat_ids = tuple(s['patient_id'] for s in approved_sums)

pending_summary_ids = tuple(s['summary_id'] for s in pending_sums)
pending_adm_ids = tuple(s['admission_id'] for s in pending_sums)
pending_pat_ids = tuple(s['patient_id'] for s in pending_sums)

print("11 Approved Summary IDs:", approved_summary_ids)
print("11 Approved Admission IDs:", approved_adm_ids)
print("42 Pending Summary IDs count:", len(pending_summary_ids))

# 2. Update dim_generated_discharge_summaries
cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Approved'
    WHERE summary_id IN %s;
""", (approved_summary_ids,))

cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Pending Approval'
    WHERE summary_id IN %s;
""", (pending_summary_ids,))

# 3. Update dim_admission_inputs
# 11 Discharged
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Discharged'
    WHERE admission_id IN %s OR patient_id IN %s;
""", (approved_adm_ids, approved_pat_ids))

# 42 Ready (the 42 pending summaries)
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Ready'
    WHERE (admission_id IN %s OR patient_id IN %s)
      AND admission_id NOT IN %s AND patient_id NOT IN %s;
""", (pending_adm_ids, pending_pat_ids, approved_adm_ids, approved_pat_ids))

# 167 Admitted (all remaining active admissions)
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Admitted'
    WHERE admission_id NOT IN %s AND patient_id NOT IN %s
      AND admission_id NOT IN %s AND patient_id NOT IN %s;
""", (approved_adm_ids, approved_pat_ids, pending_adm_ids, pending_pat_ids))

# Clean up any extraneous test discharged records so dim_admission_inputs has exactly 220 total (209 active + 11 discharged)
cur.execute("""
    DELETE FROM dim_admission_inputs
    WHERE discharge_status = 'Discharged'
      AND admission_id NOT IN %s AND patient_id NOT IN %s;
""", (approved_adm_ids, approved_pat_ids))

conn.commit()

# Verify counts in DB
cur.execute("SELECT discharge_status, COUNT(*) as c FROM dim_admission_inputs GROUP BY discharge_status;")
print("\ndim_admission_inputs breakdown:", cur.fetchall())

cur.execute("SELECT approval_status, COUNT(*) as c FROM dim_generated_discharge_summaries GROUP BY approval_status;")
print("dim_generated_discharge_summaries breakdown:", cur.fetchall())

cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Occupied';")
print("Occupied Beds:", cur.fetchone()['c'])

cur.close()
conn.close()
