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

cur.execute("""
    SELECT bill_id, patient_id, COUNT(*), array_agg(id), array_agg(amount), array_agg(payment_date)
    FROM payments
    WHERE payment_status = 'SUCCESS'
    GROUP BY bill_id, patient_id
    HAVING COUNT(*) > 1
""")
rows = cur.fetchall()
print(f"Bills with duplicate payments: {len(rows)}")
for r in rows:
    print(r)
