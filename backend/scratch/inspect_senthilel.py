import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

# Find patient & admission
cur.execute("""
    SELECT id, first_name, last_name, gender, date_of_birth 
    FROM patients 
    WHERE first_name ILIKE '%Senthil%' OR last_name ILIKE '%Parthalan%';
""")
print("Patients:", cur.fetchall())

cur.execute("""
    SELECT admission_id, patient_id, discharge_status, admission_date, discharge_date
    FROM admissions
    WHERE patient_id IN (SELECT id FROM patients WHERE first_name ILIKE '%Senthil%' OR last_name ILIKE '%Parthalan%')
       OR admission_id = 87239;
""")
print("Admissions:", cur.fetchall())

cur.execute("""
    SELECT *
    FROM dim_admission_inputs
    WHERE first_name ILIKE '%Senthil%' OR last_name ILIKE '%Parthalan%' OR patient_id = 87239 OR admission_id = 87239;
""")
colnames = [desc[0] for desc in cur.description]
rows = cur.fetchall()
for r in rows:
    print("dim_admission_inputs row:")
    for k, v in zip(colnames, r):
        print(f"  {k}: {v}")

cur.execute("""
    SELECT *
    FROM bills
    WHERE patient_id IN (SELECT id FROM patients WHERE first_name ILIKE '%Senthil%' OR last_name ILIKE '%Parthalan%')
       OR admission_id = 87239
       OR bill_id IN (87239, 170143);
""")
colnames = [desc[0] for desc in cur.description]
rows = cur.fetchall()
for r in rows:
    print("bills row:")
    for k, v in zip(colnames, r):
        print(f"  {k}: {v}")

cur.execute("""
    SELECT *
    FROM payments
    WHERE patient_id IN (SELECT id FROM patients WHERE first_name ILIKE '%Senthil%' OR last_name ILIKE '%Parthalan%')
       OR bill_id IN (SELECT bill_id FROM bills WHERE admission_id = 87239 OR bill_id IN (87239, 170143));
""")
colnames = [desc[0] for desc in cur.description]
rows = cur.fetchall()
for r in rows:
    print("payments row:")
    for k, v in zip(colnames, r):
        print(f"  {k}: {v}")

cur.execute("""
    SELECT *
    FROM insurance_claims
    WHERE patient_id IN (SELECT id FROM patients WHERE first_name ILIKE '%Senthil%' OR last_name ILIKE '%Parthalan%')
       OR admission_id = 87239;
""")
colnames = [desc[0] for desc in cur.description]
rows = cur.fetchall()
for r in rows:
    print("insurance_claims row:")
    for k, v in zip(colnames, r):
        print(f"  {k}: {v}")

conn.close()
