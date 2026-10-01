import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT * FROM dim_admission_inputs WHERE admission_id = 87222;")
print("87222 in dim_admission_inputs:", cur.fetchall())

cur.execute("SELECT * FROM admissions WHERE admission_id = 87222;")
print("87222 in admissions table:", cur.fetchall())

cur.execute("SELECT * FROM beds WHERE bed_number = 'BED-0175';")
print("BED-0175 in beds table:", cur.fetchall())

cur.close()
conn.close()
