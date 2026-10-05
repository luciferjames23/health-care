import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.postgres_connector import PostgresConnector
import json

db = PostgresConnector()
conn = db.get_connection()
cur = db.get_dict_cursor(conn)

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;")
tables = [r['table_name'] for r in cur.fetchall()]

print(f"Total tables: {len(tables)}")
for t in tables:
    cur.execute(f"SELECT COUNT(*) as cnt FROM {t};")
    cnt = cur.fetchone()['cnt']
    print(f"{t}: {cnt} rows")

print("\n--- DETAILED INSPECTION FOR ADMISSIONS & DISCHARGE ---")

# Let's inspect dim_admission_inputs
if 'dim_admission_inputs' in tables:
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dim_admission_inputs';")
    cols = [r['column_name'] for r in cur.fetchall()]
    print("\ndim_admission_inputs columns:", cols)
    
    # Check discharge_status distinct values
    if 'discharge_status' in cols:
        cur.execute("SELECT discharge_status, COUNT(*) FROM dim_admission_inputs GROUP BY discharge_status;")
        print("dim_admission_inputs discharge_status:", cur.fetchall())

    # Check bill_clearance_status
    if 'bill_clearance_status' in cols:
        cur.execute("SELECT bill_clearance_status, COUNT(*) FROM dim_admission_inputs GROUP BY bill_clearance_status;")
        print("dim_admission_inputs bill_clearance_status:", cur.fetchall())

    # Check bill_status
    if 'bill_status' in cols:
        cur.execute("SELECT bill_status, COUNT(*) FROM dim_admission_inputs GROUP BY bill_status;")
        print("dim_admission_inputs bill_status:", cur.fetchall())

    # Check claim_status / insurance_status
    for c in ['claim_status', 'insurance_status']:
        if c in cols:
            cur.execute(f"SELECT {c}, COUNT(*) FROM dim_admission_inputs GROUP BY {c};")
            print(f"dim_admission_inputs {c}:", cur.fetchall())

# Let's inspect dim_generated_discharge_summaries
if 'dim_generated_discharge_summaries' in tables:
    cur.execute("SELECT * FROM dim_generated_discharge_summaries;")
    summaries = cur.fetchall()
    print(f"\ndim_generated_discharge_summaries ({len(summaries)} rows):")
    for s in summaries:
        print(f"Summary ID: {s.get('summary_id')}, Adm ID: {s.get('admission_id')}, Pat ID: {s.get('patient_id')}, Status: {s.get('approval_status')}, Date: {s.get('discharge_date')}")

# Check any other discharge tables
for t in tables:
    if 'discharge' in t and t != 'dim_generated_discharge_summaries':
        print(f"\nTable {t}:")
        cur.execute(f"SELECT * FROM {t} LIMIT 5;")
        print(cur.fetchall())

conn.close()
