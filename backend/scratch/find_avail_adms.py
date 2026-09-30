import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Let's see all admissions in admissions table that are on available beds
cur.execute("""
    SELECT a.admission_id, a.patient_id, a.admission_number, p.patient_code, p.first_name, p.last_name, b.bed_number
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE b.status = 'Available'
    ORDER BY a.admission_id DESC
    LIMIT 20;
""")
avail = cur.fetchall()
print("Admissions on available beds:")
for a in avail:
    print(" ", dict(a))

cur.close()
conn.close()
