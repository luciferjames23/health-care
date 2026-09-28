import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

cur.execute("SELECT discharge_status, COUNT(*) FROM dim_admission_inputs GROUP BY discharge_status ORDER BY COUNT(*) DESC;")
print("dim_admission_inputs status counts:", cur.fetchall())

cur.execute("SELECT approval_status, COUNT(*) FROM dim_generated_discharge_summaries GROUP BY approval_status;")
print("summaries approval counts:", cur.fetchall())

cur.execute("SELECT patient_id, first_name, last_name, discharge_status, bill_status, bill_clearance_status, outstanding_balance FROM dim_admission_inputs WHERE first_name ILIKE '%Senthil%' OR last_name ILIKE '%Parthalan%';")
print("Senthilel in dim_admission_inputs:", cur.fetchall())

conn.close()
