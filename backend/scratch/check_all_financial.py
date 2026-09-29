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

# Query payments for Novaer
cur.execute("""
    SELECT py.id, py.bill_id, py.patient_id, py.amount, py.payment_method, py.payment_status, py.payment_reference, py.payment_date,
           b.bill_number, p.first_name, p.last_name
    FROM payments py
    LEFT JOIN bills b ON py.bill_id = b.bill_id
    LEFT JOIN patients p ON py.patient_id = p.id
    WHERE p.first_name ILIKE '%Novaer%' OR p.last_name ILIKE '%Parthalan%'
""")
for r in cur.fetchall():
    print("Payment:", r)

# Query bills for Novaer
cur.execute("""
    SELECT b.bill_id, b.bill_number, b.patient_id, b.admission_id, b.net_amount, b.bill_status, p.first_name, p.last_name
    FROM bills b
    LEFT JOIN patients p ON b.patient_id = p.id
    WHERE p.first_name ILIKE '%Novaer%' OR p.last_name ILIKE '%Parthalan%'
""")
for r in cur.fetchall():
    print("Bill:", r)

# Query claims for Novaer
cur.execute("""
    SELECT c.claim_id, c.claim_number, c.patient_id, c.claimed_amount, c.approved_amount, c.claim_status, p.first_name, p.last_name
    FROM insurance_claims c
    LEFT JOIN patients p ON c.patient_id = p.id
    WHERE p.first_name ILIKE '%Novaer%' OR p.last_name ILIKE '%Parthalan%'
""")
for r in cur.fetchall():
    print("Claim:", r)

# Query insurance for Novaer
cur.execute("""
    SELECT i.insurance_id, i.patient_id, i.provider_name, i.policy_number, i.status, p.first_name, p.last_name
    FROM patient_insurance i
    LEFT JOIN patients p ON i.patient_id = p.id
    WHERE p.first_name ILIKE '%Novaer%' OR p.last_name ILIKE '%Parthalan%'
""")
for r in cur.fetchall():
    print("Insurance:", r)
