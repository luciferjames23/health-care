import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('e:/Bosco-projects/POC/Health-care/code/health-care/backend/.env')

conn = psycopg2.connect(
    dbname=os.getenv('POSTGRES_DB', 'live_backup'),
    user=os.getenv('POSTGRES_USER', 'postgres'),
    password=os.getenv('POSTGRES_PASSWORD', 'Lucifer'),
    host=os.getenv('POSTGRES_HOST', 'localhost'),
    port=os.getenv('POSTGRES_PORT', '5432')
)
cur = conn.cursor()

# Get column names of admissions table
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'admissions' ORDER BY ordinal_position;")
cols = [r[0] for r in cur.fetchall()]
print('ADMISSIONS COLUMNS:', cols)

cur.execute("SELECT * FROM admissions WHERE patient_id = 1004308;")
rows = cur.fetchall()
for r in rows:
    print('ADMISSION ROW:', dict(zip(cols, r)))

cur.execute("SELECT id, display_name, first_name, last_name, specialization, department_id FROM doctors WHERE display_name ILIKE '%Ravi%' OR first_name ILIKE '%Ravi%';")
print('DR. RAVI:', cur.fetchall())

# Check how Doctor Dashboard queries its patients!
conn.close()
