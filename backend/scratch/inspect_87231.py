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
pid = 87231
bid = 87230

print("=== PATIENT ===")
cur.execute("SELECT id, patient_code, first_name, last_name, phone FROM patients WHERE id = %s", (pid,))
print(cur.fetchall())

print("\n=== ADMISSION ===")
cur.execute("SELECT admission_id, admission_number, patient_id, admission_date, discharge_date, discharge_status FROM admissions WHERE patient_id = %s", (pid,))
for r in cur.fetchall():
    print(r)

print("\n=== BILL ===")
cur.execute("SELECT bill_id, bill_number, patient_id, admission_id, gross_amount, discount_amount, tax_amount, net_amount, insurance_amount, patient_amount, bill_status FROM bills WHERE bill_id = %s OR patient_id = %s", (bid, pid))
for r in cur.fetchall():
    print(r)

print("\n=== PAYMENTS ===")
cur.execute("SELECT id, bill_id, patient_id, amount, payment_method, payment_status, payment_reference, payment_date FROM payments WHERE patient_id = %s OR bill_id = %s", (pid, bid))
for r in cur.fetchall():
    print(r)

print("\n=== INSURANCE ===")
cur.execute("SELECT * FROM patient_insurance WHERE patient_id = %s", (pid,))
for r in cur.fetchall():
    print(r)

print("\n=== CLAIMS ===")
cur.execute("SELECT * FROM insurance_claims WHERE patient_id = %s OR bill_id = %s", (pid, bid))
for r in cur.fetchall():
    print(r)
