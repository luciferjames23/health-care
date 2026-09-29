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

search = "Kavithael Parthalan"
st = f"%{search.strip()}%"

ledger_sql = """
    WITH patient_ledger AS (
        SELECT 
            py.id as payment_id,
            py.bill_id,
            COALESCE(py.patient_id, b.patient_id) as patient_id,
            py.amount,
            COALESCE(py.payment_method, 'UPI') as payment_method,
            COALESCE(py.payment_status, 'SUCCESS') as payment_status,
            COALESCE(py.payment_reference, CONCAT('PAY-', LPAD(py.id::text, 6, '0'))) as payment_reference,
            py.payment_date,
            b.bill_number,
            COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(p.first_name, pb.first_name, ''), ' ', COALESCE(p.last_name, pb.last_name, ''))), ''),
                'Enrolled Patient'
            ) as patient_name,
            COALESCE(p.patient_code, pb.patient_code) as patient_code
        FROM payments py
        LEFT JOIN bills b ON py.bill_id = b.bill_id
        LEFT JOIN patients p ON py.patient_id = p.id
        LEFT JOIN patients pb ON b.patient_id = pb.id
        
        UNION ALL
        
        SELECT
            b.bill_id as payment_id,
            b.bill_id,
            b.patient_id,
            COALESCE(b.patient_amount, b.net_amount) as amount,
            'UPI' as payment_method,
            CASE 
                WHEN LOWER(COALESCE(b.bill_status, '')) IN ('settled', 'paid', 'cleared') THEN 'SUCCESS'
                WHEN LOWER(COALESCE(b.bill_status, '')) LIKE '%%part%%' THEN 'PARTIALLY PAID'
                WHEN LOWER(COALESCE(b.bill_status, '')) IN ('failed', 'disputed', 'voided') THEN 'FAILED'
                ELSE 'PENDING'
            END as payment_status,
            CONCAT('PAY-', RIGHT(b.bill_number, 5)) as payment_reference,
            COALESCE(b.bill_date, NOW()) as payment_date,
            b.bill_number,
            COALESCE(
                NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''),
                'Enrolled Patient'
            ) as patient_name,
            p.patient_code
        FROM bills b
        LEFT JOIN patients p ON b.patient_id = p.id
        WHERE NOT EXISTS (
            SELECT 1 FROM payments py WHERE py.bill_id = b.bill_id
        )
    )
    SELECT payment_id, bill_id, patient_id, amount, payment_method, payment_status, payment_reference, payment_date, bill_number, patient_name
    FROM patient_ledger
    WHERE (
        patient_name ILIKE %s OR 
        bill_number ILIKE %s OR 
        payment_reference ILIKE %s OR 
        patient_code ILIKE %s
    )
    ORDER BY payment_date DESC, payment_id DESC
    LIMIT 15;
"""

cur.execute(ledger_sql, (st, st, st, st))
rows = cur.fetchall()
print(f"Matched rows for {search}: {len(rows)}")
for r in rows:
    print(r)
