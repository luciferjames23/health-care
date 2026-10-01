import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT approval_status, COUNT(*) as c 
    FROM dim_generated_discharge_summaries 
    GROUP BY approval_status;
""")
print("Summaries by approval_status:", cur.fetchall())

cur.execute("""
    SELECT summary_id, patient_id, admission_id, approval_status, discharge_date
    FROM dim_generated_discharge_summaries
    WHERE LOWER(COALESCE(approval_status, '')) IN ('approved', 'signed', 'signed off', 'completed');
""")
approved = cur.fetchall()
print(f"Approved summaries ({len(approved)}):")
for a in approved:
    print(dict(a))

cur.close()
conn.close()
