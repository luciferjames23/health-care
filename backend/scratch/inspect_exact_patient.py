import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

# Find exact patient 87240
print("=== PATIENT 87240 ===")
cur.execute("SELECT * FROM patients WHERE id = 87240;")
for r in cur.fetchall():
    print(r)

print("=== ADMISSION 87239 ===")
cur.execute("SELECT * FROM admissions WHERE admission_id = 87239 OR patient_id = 87240;")
colnames = [d[0] for d in cur.description]
for r in cur.fetchall():
    print(dict(zip(colnames, r)))

print("=== DIM_ADMISSION_INPUTS for 87240 / 87239 ===")
cur.execute("SELECT admission_id, patient_id, first_name, last_name, discharge_status, bill_status, bill_clearance_status, outstanding_balance FROM dim_admission_inputs WHERE admission_id = 87239 OR patient_id = 87240;")
colnames = [d[0] for d in cur.description]
for r in cur.fetchall():
    print(dict(zip(colnames, r)))

print("=== BILLS for 87240 / 87239 ===")
cur.execute("SELECT * FROM bills WHERE admission_id = 87239 OR patient_id = 87240;")
colnames = [d[0] for d in cur.description]
for r in cur.fetchall():
    print(dict(zip(colnames, r)))

print("=== INSURANCE CLAIMS for 87240 / 87239 ===")
cur.execute("SELECT * FROM insurance_claims WHERE patient_id = 87240 OR claim_number LIKE '%87239%' OR claim_id = 87239;")
colnames = [d[0] for d in cur.description]
for r in cur.fetchall():
    print(dict(zip(colnames, r)))

conn.close()
