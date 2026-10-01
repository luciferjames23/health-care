import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Update summaries for patients currently occupying a bed to 'Pending Approval'
cur.execute("""
    UPDATE dim_generated_discharge_summaries s
    SET approval_status = 'Pending Approval'
    FROM admissions a
    JOIN beds b ON a.bed_id = b.bed_id
    WHERE s.admission_id = a.admission_id
      AND b.status = 'Occupied'
      AND s.approval_status = 'Approved';
""")
print(f"Updated {cur.rowcount} summaries on occupied beds to 'Pending Approval'.")

conn.commit()

# 2. Check summaries count
cur.execute("""
    SELECT approval_status, COUNT(*) as c
    FROM dim_generated_discharge_summaries
    GROUP BY approval_status;
""")
print("Summaries by approval_status:", cur.fetchall())

# 3. Check occupied beds
cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Occupied';")
print("Occupied Beds:", cur.fetchone()['c'])

# 4. Check active inpatients in dim_admission_inputs
cur.execute("SELECT COUNT(*) as c FROM dim_admission_inputs WHERE discharge_status IN ('Admitted', 'Ready');")
print("Active Inpatients in dim_admission_inputs:", cur.fetchone()['c'])

cur.close()
conn.close()
