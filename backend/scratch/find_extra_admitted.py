import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Check columns of admissions table
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'admissions'
    ORDER BY ordinal_position;
""")
cols = [r['column_name'] for r in cur.fetchall()]
print("Admissions columns:", cols)

# 2. Check dim_admission_inputs Admitted vs beds
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.bed_number, d.discharge_status, b.status as bed_status, b.bed_id
    FROM dim_admission_inputs d
    LEFT JOIN beds b ON d.bed_number = b.bed_number
    WHERE d.discharge_status = 'Admitted'
    ORDER BY d.admission_id;
""")
admitted_inputs = cur.fetchall()
print(f"\nTotal 'Admitted' in dim_admission_inputs: {len(admitted_inputs)}")

# Check if any bed is NOT occupied or missing:
unoccupied_beds = [a for a in admitted_inputs if a['bed_status'] != 'Occupied']
print(f"'Admitted' inputs where bed is NOT Occupied: {len(unoccupied_beds)}")
for u in unoccupied_beds:
    print(" ", u)

# Check admissions table count:
cur.execute("SELECT COUNT(*) as c FROM admissions;")
print("\nTotal in admissions table:", cur.fetchone()['c'])

if 'discharge_date' in cols:
    cur.execute("SELECT COUNT(*) as c FROM admissions WHERE discharge_date IS NULL;")
    print("Admissions with discharge_date IS NULL:", cur.fetchone()['c'])

cur.close()
conn.close()
