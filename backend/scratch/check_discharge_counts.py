import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT ds.summary_id, ds.admission_id, ds.patient_id, a.discharge_status, ds.approval_status, ds.discharge_date
    FROM dim_generated_discharge_summaries ds
    LEFT JOIN admissions a ON ds.admission_id = a.admission_id;
""")
rows = cur.fetchall()
print(f"Total rows in dim_generated_discharge_summaries: {len(rows)}")
for r in rows:
    print(r)
