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
    WHERE summary_id >= 87500 OR admission_id >= 87500;
""")
print("Summaries near 87500:")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
