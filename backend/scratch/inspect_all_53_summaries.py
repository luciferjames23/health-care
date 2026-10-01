import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Check all 53 summaries with summary_id, patient_id, admission_id, dates, and current bed status
cur.execute("""
    SELECT s.summary_id, s.admission_id, s.patient_id, s.discharge_date,
           p.first_name, p.last_name, p.patient_code,
           b.bed_number, b.status as bed_status
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN admissions a ON s.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    ORDER BY s.summary_id;
""")
rows = cur.fetchall()
print(f"Total summaries: {len(rows)}")

# Which 11 summaries were approved:
# In the 87223..87239 range, there were 11 summaries:
# 87223, 87224, 87225, 87226, 87227, 87228, 87229, 87230, 87231, 87232, 87239.
# Notice: 87224 (Vijayer Parthalan) and 87229 (Jameser Parthalan) are available beds.
# What about the other 9? 87223, 87225, 87226, 87227, 87228, 87230, 87231, 87232, 87239.
# OR the 87501..87508 discharged patients: 87501, 87502, 87503, 87504, 87505, 87506, 87507, 87508 (all have available beds).

for r in rows:
    print(dict(r))

cur.close()
conn.close()
