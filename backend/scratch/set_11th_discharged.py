import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import get_db_connection
import psycopg2.extras
from datetime import date

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("--- Updating admission 87263 (patient 87264) to Discharged ---")
cur.execute("""
    UPDATE admissions 
    SET discharge_status = 'Discharged', 
        discharge_date = COALESCE(discharge_date, CURRENT_DATE)
    WHERE admission_id = 87263;
""")

cur.execute("""
    UPDATE dim_admission_inputs 
    SET discharge_status = 'Discharged'
    WHERE admission_id = 87263;
""")

cur.execute("""
    UPDATE dim_generated_discharge_summaries 
    SET approval_status = 'Approved'
    WHERE admission_id = 87263;
""")

conn.commit()

print("--- Discharged patients in admissions table ---")
cur.execute("""
    SELECT a.admission_id, a.patient_id, p.first_name, p.last_name, a.discharge_status, a.discharge_date
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    WHERE LOWER(a.discharge_status) = 'discharged';
""")
rows = cur.fetchall()
print(f"Total Discharged Count: {len(rows)}")
for i, r in enumerate(rows, 1):
    print(f"  {i}. Patient ID: {r['patient_id']}, Name: {r['first_name']} {r['last_name']}, Status: {r['discharge_status']}")

print("\n--- Inpatient (IP) Active Count in admissions table ---")
cur.execute("""
    SELECT COUNT(*) as active_ip
    FROM admissions
    WHERE discharge_status IS NULL OR LOWER(discharge_status) != 'discharged';
""")
print(cur.fetchone())
