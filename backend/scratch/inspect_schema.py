import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from db.postgres_connector import PostgresConnector

pg = PostgresConnector()
conn = pg.get_connection()
cur = conn.cursor()

tables = [
    'patients', 'patient_insurance', 'patient_visits', 'admissions', 
    'dim_admission_inputs', 'diagnoses', 'bills', 'bill_items', 
    'insurance_claims', 'insurance_claim_items', 'claim_appeals', 'agent_action_logs'
]

for t in tables:
    cur.execute(f"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '{t}' ORDER BY ordinal_position;")
    cols = cur.fetchall()
    print(f"=== Table: {t} ===")
    for c in cols:
        print(f"  {c[0]} ({c[1]}, nullable={c[2]})")

cur.close()
conn.close()
