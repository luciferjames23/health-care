import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import json

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT * FROM dim_admission_inputs WHERE discharge_status = 'Admitted' LIMIT 1;")
row = cur.fetchone()
cols = [desc[0] for desc in cur.description]
d = dict(zip(cols, row))
print("Sample Admitted dim_admission_inputs:")
for k, v in d.items():
    print(f"  {k}: {v}")

conn.close()
