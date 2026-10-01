import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.bed_number, d.discharge_status,
           b.bed_id, b.status as bed_status
    FROM dim_admission_inputs d
    LEFT JOIN beds b ON d.bed_number = b.bed_number
    WHERE d.admission_id IN (87222, 87501, 87503);
""")
print("Records 87222, 87501, 87503:")
for r in cur.fetchall():
    print(r)

# Let's check how many total admissions are in dim_admission_inputs:
cur.execute("SELECT COUNT(*) as c FROM dim_admission_inputs;")
print("\nTotal in dim_admission_inputs:", cur.fetchone()['c'])

cur.close()
conn.close()
