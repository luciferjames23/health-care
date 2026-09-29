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

# Check bill 87241 specifically
cur.execute("""
    SELECT b.bill_id, b.bill_number, b.net_amount, b.insurance_amount, b.patient_amount, b.bill_status,
           c.claim_id, c.claim_number, c.insurance_provider, c.claimed_amount, c.approved_amount, c.claim_status,
           COALESCE(SUM(py.amount), 0) as paid_sum
    FROM bills b
    LEFT JOIN insurance_claims c ON b.bill_id = c.bill_id
    LEFT JOIN payments py ON b.bill_id = py.bill_id AND py.payment_status = 'SUCCESS'
    WHERE b.bill_id = 87241
    GROUP BY b.bill_id, b.bill_number, b.net_amount, b.insurance_amount, b.patient_amount, b.bill_status,
             c.claim_id, c.claim_number, c.insurance_provider, c.claimed_amount, c.approved_amount, c.claim_status
""")
print("Bill 87241 breakdown:")
for r in cur.fetchall():
    print(r)
