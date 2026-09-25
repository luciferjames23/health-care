import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('e:/Bosco-projects/POC/Health-care/code/health-care/backend/.env')
conn = psycopg2.connect(
    host=os.getenv('POSTGRES_HOST'),
    port=os.getenv('POSTGRES_PORT'),
    user=os.getenv('POSTGRES_USER'),
    password=os.getenv('POSTGRES_PASSWORD'),
    dbname=os.getenv('POSTGRES_DB')
)
cur = conn.cursor()
pid = 74631

print("=== 1. PAYMENTS ===")
cur.execute("SELECT * FROM payments WHERE patient_id = %s OR bill_id IN (SELECT bill_id FROM bills WHERE patient_id = %s)", (pid, pid))
rows = cur.fetchall()
print(f"Payments count: {len(rows)}")
for r in rows:
    print(r)

print("\n=== 2. BILLS ===")
cur.execute("SELECT bill_id, bill_number, patient_id, admission_id, visit_id, gross_amount, net_amount, insurance_amount, patient_amount, bill_status FROM bills WHERE patient_id = %s", (pid,))
bills = cur.fetchall()
print(f"Bills count: {len(bills)}")
for b in bills:
    print(b)

print("\n=== 3. ADMISSIONS ===")
cur.execute("SELECT admission_id, admission_number, patient_id, visit_id, admission_date, discharge_date, discharge_status FROM admissions WHERE patient_id = %s", (pid,))
for a in cur.fetchall():
    print(a)

print("\n=== 4. VISITS ===")
cur.execute("SELECT visit_id, visit_number, patient_id, visit_type, visit_date FROM visits WHERE patient_id = %s", (pid,))
for v in cur.fetchall():
    print(v)

print("\n=== 5. DIM_ADMISSION_INPUTS ===")
cur.execute("SELECT admission_id, patient_id, first_name, last_name FROM dim_admission_inputs WHERE patient_id = %s", (pid,))
for d in cur.fetchall():
    print(d)

print("\n=== 6. INSURANCE_CLAIMS ===")
cur.execute("SELECT * FROM insurance_claims WHERE patient_id = %s", (pid,))
for c in cur.fetchall():
    print(c)

print("\n=== 7. PATIENT_INSURANCE ===")
cur.execute("SELECT * FROM patient_insurance WHERE patient_id = %s", (pid,))
for i in cur.fetchall():
    print(i)
