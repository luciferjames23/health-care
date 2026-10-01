import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("--- 1. Syncing dim_admission_inputs discharge_status with admissions table ---")
cur.execute("""
    UPDATE dim_admission_inputs d
    SET discharge_status = a.discharge_status
    FROM admissions a
    WHERE d.admission_id = a.admission_id;
""")
print(f"Updated {cur.rowcount} rows in dim_admission_inputs from admissions table.")

print("--- 2. Updating dim_generated_discharge_summaries approval status for active inpatients ---")
cur.execute("""
    UPDATE dim_generated_discharge_summaries ds
    SET approval_status = 'Pending Approval'
    FROM admissions a
    WHERE ds.admission_id = a.admission_id
      AND LOWER(a.discharge_status) = 'admitted';
""")
print(f"Updated {cur.rowcount} rows in dim_generated_discharge_summaries to match active admissions.")

conn.commit()

print("\n--- 3. Verifying discharged count in dim_admission_inputs ---")
cur.execute("SELECT COUNT(*) as total_discharged FROM dim_admission_inputs WHERE LOWER(discharge_status) = 'discharged';")
print("dim_admission_inputs discharged:", cur.fetchone())

cur.execute("SELECT COUNT(*) as total_admitted FROM dim_admission_inputs WHERE LOWER(discharge_status) = 'admitted';")
print("dim_admission_inputs admitted:", cur.fetchone())

cur.execute("SELECT admission_id, patient_id, first_name, last_name, discharge_status FROM dim_admission_inputs WHERE LOWER(discharge_status) = 'discharged';")
dc_rows = cur.fetchall()
print(f"\nExact {len(dc_rows)} discharged in dim_admission_inputs:")
for r in dc_rows:
    print(" ", dict(r))
