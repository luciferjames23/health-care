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

# Test the query from get_finance_dashboard for patient 87231
cur.execute("""
    SELECT 
        py.id as payment_id,
        py.bill_id,
        COALESCE(py.patient_id, b.patient_id) as patient_id,
        py.amount,
        py.payment_method,
        py.payment_status,
        py.payment_reference,
        py.payment_date,
        b.bill_number,
        COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(p.first_name, pb.first_name, ''), ' ', COALESCE(p.last_name, pb.last_name, ''))), ''),
            NULLIF(TRIM(CONCAT(dai.first_name, ' ', dai.last_name)), ''),
            'Enrolled Patient'
        ) as patient_name
    FROM payments py
    LEFT JOIN bills b ON py.bill_id = b.bill_id
    LEFT JOIN patients p ON py.patient_id = p.id
    LEFT JOIN patients pb ON b.patient_id = pb.id
    LEFT JOIN dim_admission_inputs dai ON COALESCE(py.patient_id, b.patient_id) = dai.patient_id
    WHERE COALESCE(py.patient_id, b.patient_id) = 87231
""")
rows = cur.fetchall()
print(f"Rows returned: {len(rows)}")
for r in rows:
    print(r)
