import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Check beds
cur.execute("SELECT status, COUNT(*) as c FROM beds GROUP BY status;")
print("Beds status count:", cur.fetchall())

# 2. Check dim_admission_inputs
cur.execute("SELECT discharge_status, COUNT(*) as c FROM dim_admission_inputs GROUP BY discharge_status;")
print("\ndim_admission_inputs count:", cur.fetchall())

# 3. Check admissions table
cur.execute("""
    SELECT 
        status, 
        COUNT(*) as c 
    FROM admissions 
    GROUP BY status;
""")
print("\nadmissions table count by status:", cur.fetchall())

# 4. Check admissions that are active / Admitted in dim_admission_inputs vs beds
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.bed_number, d.discharge_status, b.status as bed_status
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

# Check admissions on occupied beds:
cur.execute("""
    SELECT a.admission_id, a.patient_id, b.bed_number, b.status as bed_status
    FROM admissions a
    JOIN beds b ON a.bed_id = b.bed_id
    WHERE b.status = 'Occupied';
""")
occ_adms = cur.fetchall()
print(f"\nAdmissions on Occupied beds: {len(occ_adms)}")

cur.close()
conn.close()
