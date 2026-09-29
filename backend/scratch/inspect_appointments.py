import sys
sys.path.append('e:/Bosco-projects/POC/Health-care/code/health-care/backend')
from api.dashboard_routes import get_conn

conn = get_conn()
cur = conn.cursor()

cur.execute("SELECT * FROM appointments WHERE booking_id = 'APT54457' OR patient_id = 1003392;")
colnames = [desc[0] for desc in cur.description]
rows = cur.fetchall()
print("Columns:", colnames)
for r in rows:
    print("Row:", dict(zip(colnames, r)))

# Check how appointments were generated or what tables have id ~ 1003392
tables_to_check = [
    'patients', 'dim_admission_inputs', 'admissions', 'patient_visits',
    'dim_patient_profile', 'op_patients', 'er_patients', 'inpatient_records'
]
for tbl in tables_to_check:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {tbl} WHERE id = 1003392;")
        cnt = cur.fetchone()[0]
        if cnt > 0:
            print(f"Found in {tbl}! Count: {cnt}")
    except Exception as e:
        conn.rollback()

cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
""")
all_tables = [t[0] for t in cur.fetchall()]
print("\nAll public tables:")
print(all_tables)

cur.close()
conn.close()
