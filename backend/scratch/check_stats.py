import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT COUNT(DISTINCT p.id) as total_patients_with_rx
    FROM patients p
    JOIN prescriptions rx ON p.id = rx.patient_id
""")
print("Total patients with prescriptions:", cur.fetchone()['total_patients_with_rx'])

cur.execute("""
    SELECT COUNT(*) as emar_cnt FROM emar_records
""")
print("Total eMAR records in DB:", cur.fetchone()['emar_cnt'])

# Check admitted patients
cur.execute("""
    SELECT admission_id, patient_number, first_name, last_name, ward_name, bed_number, attending_doctor
    FROM dim_admission_inputs
    WHERE discharge_status != 'Discharged'
    LIMIT 10
""")
for r in cur.fetchall():
    print(dict(r))

conn.close()
