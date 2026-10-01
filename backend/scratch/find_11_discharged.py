import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.approval_status, s.discharge_date,
           p.first_name, p.last_name, p.patient_code,
           b.bed_number, b.status as bed_status,
           d.discharge_status as dim_ds
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    LEFT JOIN dim_admission_inputs d ON (s.admission_id = d.admission_id OR s.patient_id = d.patient_id)
    ORDER BY s.summary_id;
""")
rows = cur.fetchall()
print(f"Total rows in dim_generated_discharge_summaries: {len(rows)}")

# Which 11 summaries correspond to discharged patients?
# Let's see: 87504, 87505, 87506, 87507, 87508, 87510 (patient 142902, admission 87502),
# 87224 (patient 87225), 87229 (patient 87230), plus what else?
discharged_matches = [r for r in rows if r['dim_ds'] == 'Discharged' or r['bed_status'] == 'Available']
print(f"\nSummaries matching Discharged/Available beds ({len(discharged_matches)}):")
for r in discharged_matches:
    print(" ", dict(r))

# Let's check which 11 summaries were originally approved (87223..87232, 87239)
# Or the 11 discharged patients:
# (1) 87224 (Vijayer Parthalan)
# (2) 87229 (Jameser Parthalan)
# (3) 87504 (Malini Chandran)
# (4) 87505 (Vikramaditya Verma)
# (5) 87506 (Geetha Rangarajan)
# (6) 87507 (Balaji Krishnaswamy)
# (7) 87508 (Shalini Venugopal)
# (8) 87510 (Ananya Sundaram - adm 87502)
# (9) 87501 (Rajesh Venkataraman) - if we add summary
# (10) 87503 (Suresh Ramanathan) - if we add summary
# (11) 87240 (Senthilel Parthalan / summary 87239) or 87223?

cur.close()
conn.close()
