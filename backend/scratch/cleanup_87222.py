import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Delete 87222 from dim_admission_inputs
cur.execute("DELETE FROM dim_admission_inputs WHERE admission_id = 87222;")
deleted = cur.rowcount
print(f"Deleted extraneous row 87222 from dim_admission_inputs: {deleted}")

# 2. Check counts in dim_admission_inputs
cur.execute("SELECT discharge_status, COUNT(*) as c FROM dim_admission_inputs GROUP BY discharge_status;")
print("dim_admission_inputs status breakdown:", cur.fetchall())

# 3. Check beds status
cur.execute("SELECT status, COUNT(*) as c FROM beds GROUP BY status;")
print("beds status breakdown:", cur.fetchall())

# 4. Check dim_generated_discharge_summaries
cur.execute("SELECT approval_status, COUNT(*) as c FROM dim_generated_discharge_summaries GROUP BY approval_status;")
print("dim_generated_discharge_summaries breakdown:", cur.fetchall())

conn.commit()
cur.close()
conn.close()
