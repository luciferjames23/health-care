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
SELECT id, patient_code, first_name, last_name 
FROM patients 
WHERE (first_name ILIKE '%Nova%' AND last_name ILIKE '%Parth%')
   OR (first_name ILIKE '%Novaer%')
   OR (last_name ILIKE '%Parthanan%')
""")
for r in cur.fetchall():
    print(r)
