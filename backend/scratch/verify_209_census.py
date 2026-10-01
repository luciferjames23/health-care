import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Let's inspect the 11 discharged admissions that correspond to the 11 released beds:
# 87501 (BED-0074), 87502 (BED-0075), 87503 (BED-0076), 87504 (BED-0077),
# 87505 (BED-0078), 87506 (BED-0079), 87507 (BED-0080), 87508 (BED-0081),
# 87224 (BED-0177), 87229 (BED-0182), 87263 (BED-0216)
discharged_11 = (87501, 87502, 87503, 87504, 87505, 87506, 87507, 87508, 87224, 87229, 87263)

cur.execute("""
    SELECT admission_id, patient_id, first_name, last_name, bed_number, discharge_status
    FROM dim_admission_inputs
    WHERE admission_id IN %s;
""", (discharged_11,))
print(f"Discharged 11 in dim_admission_inputs ({len(cur.fetchall())}):")

# Check all other records in dim_admission_inputs:
cur.execute("""
    SELECT COUNT(*) as c
    FROM dim_admission_inputs
    WHERE admission_id NOT IN %s;
""", (discharged_11,))
non_dc_count = cur.fetchone()['c']
print(f"Non-discharged records in dim_admission_inputs: {non_dc_count}")

# Check 87222 specifically:
cur.execute("SELECT * FROM dim_admission_inputs WHERE admission_id = 87222;")
r87222 = cur.fetchone()
print("Record 87222:", dict(r87222) if r87222 else None)

# Check all occupied beds in beds table:
cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Occupied';")
print("Occupied beds in beds table:", cur.fetchone()['c'])

cur.close()
conn.close()
