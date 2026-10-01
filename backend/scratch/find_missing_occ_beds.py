import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT b.bed_id, b.bed_number, b.ward_id, b.room_id
    FROM beds b
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id;
""")
occ_beds = cur.fetchall()

cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.bed_number, d.discharge_status
    FROM dim_admission_inputs d
    WHERE d.discharge_status = 'Admitted';
""")
dim_admitted = cur.fetchall()
dim_bed_nums = {d['bed_number'] for d in dim_admitted if d['bed_number']}

missing_from_dim = [b for b in occ_beds if b['bed_number'] not in dim_bed_nums]
print(f"Occupied beds NOT in dim_admission_inputs as 'Admitted' ({len(missing_from_dim)}):")
for m in missing_from_dim:
    print(" ", m)

# Let's check if these 2 beds are in dim_admission_inputs with status 'Discharged'!
if missing_from_dim:
    bnums = tuple(m['bed_number'] for m in missing_from_dim)
    cur.execute("""
        SELECT admission_id, patient_id, first_name, last_name, bed_number, discharge_status
        FROM dim_admission_inputs
        WHERE bed_number IN %s;
    """, (bnums,))
    print("\nStatus in dim_admission_inputs for these beds:")
    for r in cur.fetchall():
        print(" ", r)

cur.close()
conn.close()
