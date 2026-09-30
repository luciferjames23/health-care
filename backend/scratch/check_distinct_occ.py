import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT DISTINCT ON (b.bed_id)
        a.admission_id, a.patient_id, b.bed_id, b.bed_number
    FROM beds b
    JOIN admissions a ON b.bed_id = a.bed_id
    WHERE b.status = 'Occupied' AND (a.discharge_status IS NULL OR LOWER(a.discharge_status) != 'discharged')
    ORDER BY b.bed_id, a.admission_id DESC;
""")
rows = cur.fetchall()
print("Distinct active admissions on occupied beds count:", len(rows))

cur.close()
conn.close()
