import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT admission_id, patient_id, discharge_status, attending_doctor, primary_diagnosis
    FROM dim_admission_inputs
    WHERE admission_id >= 87500
    ORDER BY admission_id;
""")
print("Admissions >= 87500:")
for r in cur.fetchall():
    print(r)

cur.execute("""
    SELECT summary_id, admission_id, patient_id, approval_status, attending_physician, primary_diagnosis
    FROM dim_generated_discharge_summaries
    WHERE summary_id >= 87500
    ORDER BY summary_id;
""")
print("\nSummaries >= 87500:")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
