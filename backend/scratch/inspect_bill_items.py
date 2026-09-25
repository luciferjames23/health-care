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
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'bill_items'")
print("bill_items columns:", [c[0] for c in cur.fetchall()])

cur.execute("SELECT * FROM bill_items WHERE bill_id = 87241")
rows = cur.fetchall()
print(f"bill_items for 87241: count = {len(rows)}")
for r in rows:
    print(r)
