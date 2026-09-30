import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import get_db_connection
import psycopg2.extras
from routers.gold import get_dim_admission_inputs

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Update bed_id 216 to Available since admission 87263 is Discharged
cur.execute("UPDATE beds SET status = 'Available' WHERE bed_id = 216;")

# Update all beds of discharged admissions to Available
cur.execute("""
    UPDATE beds b
    SET status = 'Available'
    WHERE b.status = 'Occupied'
      AND b.bed_id IN (
          SELECT a.bed_id FROM admissions a 
          WHERE LOWER(a.discharge_status) = 'discharged' AND a.bed_id IS NOT NULL
      )
      AND b.bed_number NOT IN (
          SELECT d.bed_number FROM dim_admission_inputs d 
          WHERE LOWER(d.discharge_status) = 'admitted' AND d.bed_number IS NOT NULL
      );
""")
conn.commit()

print("--- Checking get_dim_admission_inputs(discharge_status='all') ---")
res = get_dim_admission_inputs(discharge_status='all')
data = res.get('data', [])
print(f"Total admissions count returned: {len(data)}")

dc_cnt = len([r for r in data if str(r.get('discharge_status') or '').lower() == 'discharged'])
adm_cnt = len([r for r in data if str(r.get('discharge_status') or '').lower() != 'discharged'])
print(f"Discharged: {dc_cnt}, Admitted (IP): {adm_cnt}, Total: {len(data)}")
