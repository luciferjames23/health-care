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

print("--- PATIENT ---")
cur.execute("SELECT * FROM patients WHERE id = %s", (pid,))
print(cur.fetchall())

print("--- ADMISSIONS ---")
cur.execute("SELECT * FROM admissions WHERE patient_id = %s", (pid,))
for r in cur.fetchall():
    print(r)

print("--- BILLS ---")
cur.execute("SELECT * FROM bills WHERE patient_id = %s", (pid,))
for r in cur.fetchall():
    print(r)

print("--- PATIENT INSURANCE ---")
cur.execute("SELECT * FROM patient_insurance WHERE patient_id = %s", (pid,))
for r in cur.fetchall():
    print(r)

print("--- INSURANCE CLAIMS ---")
cur.execute("SELECT * FROM insurance_claims WHERE patient_id = %s", (pid,))
for r in cur.fetchall():
    print(r)

print("--- PREAUTH ---")
cur.execute("SELECT * FROM preauthorisations WHERE patient_id = %s", (pid,))
for r in cur.fetchall():
    print(r)
