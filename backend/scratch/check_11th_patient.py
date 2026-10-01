import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("--- Admission 87263 ---")
cur.execute("SELECT * FROM admissions WHERE admission_id = 87263 OR patient_id = 87264;")
print(cur.fetchall())

print("\n--- Discharge summary for 87263 ---")
cur.execute("SELECT * FROM discharge_summaries WHERE admission_id = 87263 OR patient_id = 87264;")
print(cur.fetchall())

print("\n--- dim_admission_inputs for 87263 ---")
cur.execute("SELECT * FROM dim_admission_inputs WHERE admission_id = 87263 OR patient_id = 87264;")
print(cur.fetchall())
