import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT count(*) FROM discharge_summaries;")
print("discharge_summaries count:", cur.fetchone()[0])

cur.execute("SELECT count(*) FROM dim_generated_discharge_summaries;")
print("dim_generated_discharge_summaries count:", cur.fetchone()[0])

cur.execute("SELECT summary_id, patient_id, admission_id, diagnoses FROM dim_generated_discharge_summaries LIMIT 5;")
print("dim_generated sample:", cur.fetchall())

conn.close()
