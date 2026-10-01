import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status,
           p.first_name, p.last_name, a.discharge_status, a.bed_number
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN dim_admission_inputs a ON s.admission_id = a.admission_id
    ORDER BY s.summary_id;
""")
sums = cur.fetchall()

print("Summaries with (approval_status in ('Approved', 'Signed', 'Completed') OR admission discharge_status == 'Discharged'):")
comp_sums = []
for s in sums:
    st = (s.get('approval_status') or '').lower()
    adm_st = (s.get('discharge_status') or '').lower()
    is_app = st in ('approved', 'signed', 'signed off', 'completed')
    is_dis = adm_st == 'discharged'
    if is_app or is_dis:
        comp_sums.append(s)
        print(f"Summary {s['summary_id']} (adm {s['admission_id']}, pat {s['patient_id']}): {s['first_name']} {s['last_name']} (bed: {s['bed_number']}) -> app_status: {s['approval_status']}, adm_discharge_status: {s['discharge_status']}")

print(f"Total Completed from summaries: {len(comp_sums)}")

# Admissions with discharge_status='Discharged' that are NOT in summaries:
cur.execute("""
    SELECT a.admission_id, a.patient_id, a.first_name, a.last_name, a.discharge_status, a.bed_number
    FROM dim_admission_inputs a
    WHERE LOWER(a.discharge_status) = 'discharged'
      AND a.admission_id NOT IN (SELECT admission_id FROM dim_generated_discharge_summaries WHERE admission_id IS NOT NULL)
      AND a.patient_id NOT IN (SELECT patient_id FROM dim_generated_discharge_summaries WHERE patient_id IS NOT NULL);
""")
orphan_adms = cur.fetchall()
print(f"\nOrphan Discharged admissions (not in summaries): {len(orphan_adms)}")
for oa in orphan_adms:
    print(f"Admission {oa['admission_id']} (pat {oa['patient_id']}): {oa['first_name']} {oa['last_name']} (bed: {oa['bed_number']}) -> {oa['discharge_status']}")

cur.close()
conn.close()
