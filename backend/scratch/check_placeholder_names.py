import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM patients WHERE first_name ILIKE 'Patient' OR last_name LIKE '#%';")
cnt = cur.fetchone()[0]
print(f"Total placeholder patient names (Patient #...): {cnt}")

cur.execute("SELECT id, first_name, last_name, phone FROM patients WHERE first_name ILIKE 'Patient' OR last_name LIKE '#%' LIMIT 20;")
print("Sample rows:")
for r in cur.fetchall():
    print(r)

conn.close()
