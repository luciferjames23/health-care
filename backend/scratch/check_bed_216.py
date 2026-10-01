import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT * FROM admissions WHERE bed_id = 216 ORDER BY admission_id DESC LIMIT 5;")
for r in cur.fetchall():
    print("Bed 216 admission:", r['admission_id'], r['patient_id'], r['admission_date'], r['discharge_status'])

cur.execute("SELECT * FROM beds WHERE bed_id = 216;")
print("Bed 216:", cur.fetchone())
