import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Check total in dim_admission_inputs
cur.execute("SELECT COUNT(*) as total FROM dim_admission_inputs;")
print("Total rows in dim_admission_inputs:", cur.fetchone()['total'])

# Check breakdown by discharge_status
cur.execute("""
    SELECT discharge_status, COUNT(*) as count 
    FROM dim_admission_inputs 
    GROUP BY discharge_status;
""")
print("Breakdown by discharge_status:", cur.fetchall())

# Check if there are NULL or other discharge_status values
cur.execute("""
    SELECT admission_id, patient_id, first_name, last_name, discharge_status, bed_number
    FROM dim_admission_inputs
    WHERE discharge_status NOT IN ('Admitted', 'Discharged') OR discharge_status IS NULL;
""")
other_status = cur.fetchall()
print(f"Rows with discharge_status NOT IN ('Admitted', 'Discharged') ({len(other_status)}):")
for r in other_status:
    print(" ", r)

# Check if any admission_id or patient_id is duplicate
cur.execute("""
    SELECT admission_id, COUNT(*) 
    FROM dim_admission_inputs 
    GROUP BY admission_id 
    HAVING COUNT(*) > 1;
""")
print("Duplicate admission_ids:", cur.fetchall())

cur.execute("""
    SELECT patient_id, COUNT(*) 
    FROM dim_admission_inputs 
    GROUP BY patient_id 
    HAVING COUNT(*) > 1;
""")
print("Duplicate patient_ids:", cur.fetchall())

cur.close()
conn.close()
