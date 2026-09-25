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

# Check payments before
cur.execute("SELECT id, bill_id, patient_id, amount, payment_reference, payment_date FROM payments WHERE patient_id = 87231 OR bill_id = 87230")
rows_before = cur.fetchall()
print("Payments before removal:", rows_before)

# Remove the duplicate payment (id = 628)
cur.execute("DELETE FROM payments WHERE id = 628 AND patient_id = 87231 AND bill_id = 87230")
conn.commit()
print("Deleted payment 628 successfully.")

# Check payments after
cur.execute("SELECT id, bill_id, patient_id, amount, payment_reference, payment_date FROM payments WHERE patient_id = 87231 OR bill_id = 87230")
rows_after = cur.fetchall()
print("Payments after removal:", rows_after)
