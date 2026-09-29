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

# Get the paid bill_ids first
cur.execute("SELECT DISTINCT bill_id FROM payments WHERE bill_id IS NOT NULL AND payment_status = 'SUCCESS'")
paid_bill_ids = set(r[0] for r in cur.fetchall())
print(f"Bills with successful payments: {len(paid_bill_ids)}")

# Get the 74 Partially Paid bills
cur.execute("SELECT bill_id, admission_id, net_amount, insurance_amount, patient_amount FROM bills WHERE bill_status = 'Partially Paid'")
partially_paid = cur.fetchall()
print(f"Partially Paid bills found: {len(partially_paid)}")

bills_to_pending = []
admissions_to_pending = []

for b_id, a_id, net, ins, pat in partially_paid:
    # If 0 insurance and 0 paid in payments table
    if (ins or 0) == 0 and b_id not in paid_bill_ids:
        bills_to_pending.append(b_id)
        if a_id:
            admissions_to_pending.append(a_id)

print(f"Bills to update to 'Pending': {len(bills_to_pending)}")
print(f"Admissions to update to 'Pending': {len(admissions_to_pending)}")

if bills_to_pending:
    cur.execute("UPDATE bills SET bill_status = 'Pending' WHERE bill_id = ANY(%s)", (bills_to_pending,))
    print(f"Updated {cur.rowcount} rows in bills to 'Pending'.")

if admissions_to_pending:
    cur.execute("""
        UPDATE dim_admission_inputs 
        SET bill_status = 'Pending', bill_clearance_status = 'Pending' 
        WHERE admission_id = ANY(%s)
    """, (admissions_to_pending,))
    print(f"Updated {cur.rowcount} rows in dim_admission_inputs to 'Pending'.")

conn.commit()

# Verify Kavithael Parthalan (bill 87241)
cur.execute("SELECT bill_id, bill_number, net_amount, insurance_amount, patient_amount, bill_status FROM bills WHERE bill_id = 87241")
print("Bill 87241:", cur.fetchall())

cur.execute("SELECT admission_id, bill_status, bill_clearance_status, outstanding_balance FROM dim_admission_inputs WHERE admission_id = 87241")
print("dim_admission_inputs 87241:", cur.fetchall())
