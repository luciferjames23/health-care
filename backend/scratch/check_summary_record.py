import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'dim_generated_discharge_summaries';")
cols = [c[0] for c in cur.fetchall()]
print('Columns of dim_generated_discharge_summaries:', cols)

cur.execute("SELECT * FROM dim_generated_discharge_summaries WHERE admission_id = 87239 OR patient_id = 87240 LIMIT 1;")
row = cur.fetchone()
if row:
    desc = [d[0] for d in cur.description]
    data = dict(zip(desc, row))
    print('\nRecord for Senthilel Parthalan in dim_generated_discharge_summaries:')
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'dim_admission_inputs';")
adm_cols = [c[0] for c in cur.fetchall()]
print('\nColumns of dim_admission_inputs:', adm_cols)

cur.execute("SELECT admission_id, reason_for_admission, primary_diagnosis FROM dim_admission_inputs WHERE admission_id = 87239 OR patient_id = 87240 LIMIT 1;")
print('\nreason_for_admission in dim_admission_inputs:', cur.fetchone())
conn.close()
