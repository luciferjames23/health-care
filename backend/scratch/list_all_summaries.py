import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT summary_id, admission_id, patient_id, approval_status
    FROM dim_generated_discharge_summaries
    ORDER BY summary_id;
""")
sums = cur.fetchall()
print(f"Total summaries: {len(sums)}")
for i, s in enumerate(sums):
    print(f"{i+1}: summary_id={s['summary_id']}, adm_id={s['admission_id']}, pat_id={s['patient_id']}, status={s['approval_status']}")

cur.close()
conn.close()
