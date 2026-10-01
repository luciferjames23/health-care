import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras
from api.auth_helper import get_hashed_password

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Check patients in database:
cur.execute("""
    SELECT id, patient_code, first_name, last_name, phone, email, date_of_birth, gender
    FROM patients
    WHERE id IN (87227, 87225, 87224, 87229, 87264, 142904, 142905, 142902, 1)
    ORDER BY id;
""")
pats = cur.fetchall()
print("Selected patients:")
for p in pats:
    print(" ", dict(p))

cur.close()
conn.close()
