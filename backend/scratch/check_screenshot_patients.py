import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

names_to_check = [
    'Davidel', 'Malini', 'Vikramaditya', 'Saanvier', 'Adityaer', 'Parier',
    'Aaravan', 'Karthikan', 'Anandan', 'Mephisto', 'Kavithaan', 'Gitaan'
]

print("--- Checking patients in dim_generated_discharge_summaries ---")
cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status,
           p.first_name, p.last_name, p.patient_code
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    ORDER BY s.summary_id;
""")
sums = cur.fetchall()

for s in sums:
    fn = s.get('first_name') or ''
    ln = s.get('last_name') or ''
    for n in names_to_check:
        if n.lower() in fn.lower() or n.lower() in ln.lower():
            print(f"Summary {s['summary_id']}: {fn} {ln} (pat_id={s['patient_id']}, adm_id={s['admission_id']}) -> {s['approval_status']}")

print("\n--- Checking in dim_admission_inputs ---")
cur.execute("""
    SELECT admission_id, patient_id, first_name, last_name, discharge_status, bed_number
    FROM dim_admission_inputs
    ORDER BY admission_id;
""")
adms = cur.fetchall()
for a in adms:
    fn = a.get('first_name') or ''
    ln = a.get('last_name') or ''
    for n in names_to_check:
        if n.lower() in fn.lower() or n.lower() in ln.lower():
            print(f"Admission {a['admission_id']}: {fn} {ln} (pat_id={a['patient_id']}, bed={a['bed_number']}) -> {a['discharge_status']}")

cur.close()
conn.close()
