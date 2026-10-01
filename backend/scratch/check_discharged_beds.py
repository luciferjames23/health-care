import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Check all 11 discharged in dim_admission_inputs and their bed status:
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.bed_number, d.discharge_status,
           b.status as bed_status, b.bed_id
    FROM dim_admission_inputs d
    LEFT JOIN beds b ON d.bed_number = b.bed_number
    WHERE d.discharge_status = 'Discharged'
    ORDER BY d.admission_id;
""")
discharged = cur.fetchall()
print(f"Total Discharged in dim_admission_inputs: {len(discharged)}")
for dc in discharged:
    print(" ", dict(dc))

cur.close()
conn.close()
