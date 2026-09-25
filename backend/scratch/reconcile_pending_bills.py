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

# Find bills where bill_status is 'Partially Paid' but insurance_amount = 0 and paid = 0
cur.execute("""
    SELECT b.bill_id, b.bill_number, b.admission_id, b.patient_id, b.net_amount, b.bill_status
    FROM bills b
    WHERE b.bill_status = 'Partially Paid'
      AND COALESCE(b.insurance_amount, 0) = 0
      AND NOT EXISTS (
          SELECT 1 FROM payments py 
          WHERE py.bill_id = b.bill_id AND py.payment_status = 'SUCCESS'
      )
""")
bills_to_fix = cur.fetchall()
print(f"Bills with 0 paid and 0 insurance currently marked 'Partially Paid': {len(bills_to_fix)}")

# Update bills table to 'Pending'
cur.execute("""
    UPDATE bills b
    SET bill_status = 'Pending'
    WHERE b.bill_status = 'Partially Paid'
      AND COALESCE(b.insurance_amount, 0) = 0
      AND NOT EXISTS (
          SELECT 1 FROM payments py 
          WHERE py.bill_id = b.bill_id AND py.payment_status = 'SUCCESS'
      )
""")
print(f"Updated {cur.rowcount} rows in bills to 'Pending'.")

# Update dim_admission_inputs table to match
cur.execute("""
    UPDATE dim_admission_inputs dai
    SET bill_status = 'Pending',
        bill_clearance_status = 'Pending'
    WHERE dai.bill_status = 'Partially Paid'
      AND dai.admission_id IN (
          SELECT b.admission_id FROM bills b 
          WHERE b.bill_status = 'Pending' AND b.admission_id IS NOT NULL
      )
      AND NOT EXISTS (
          SELECT 1 FROM payments py 
          WHERE py.bill_id IN (SELECT b2.bill_id FROM bills b2 WHERE b2.admission_id = dai.admission_id)
            AND py.payment_status = 'SUCCESS'
      )
""")
print(f"Updated {cur.rowcount} rows in dim_admission_inputs to 'Pending'.")

conn.commit()

# Verify Kavithael Parthalan specifically
cur.execute("""
    SELECT b.bill_id, b.bill_number, b.net_amount, b.insurance_amount, b.patient_amount, b.bill_status,
           dai.bill_status, dai.bill_clearance_status, dai.outstanding_balance
    FROM bills b
    LEFT JOIN dim_admission_inputs dai ON b.admission_id = dai.admission_id
    WHERE b.bill_id = 87241
""")
print("Kavithael Parthalan after update:", cur.fetchall())
