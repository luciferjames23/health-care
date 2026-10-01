import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Check all 209 occupied beds in beds table:
cur.execute("""
    SELECT b.bed_id, b.bed_number, b.ward_id, b.room_id, b.status
    FROM beds b
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id;
""")
occ_beds = cur.fetchall()
print(f"Total Occupied beds in beds table: {len(occ_beds)}")

# Check admissions joined with occupied beds:
cur.execute("""
    SELECT a.admission_id, a.patient_id, a.bed_id, b.bed_number, a.discharge_status, a.discharge_date
    FROM admissions a
    JOIN beds b ON a.bed_id = b.bed_id
    WHERE b.status = 'Occupied'
    ORDER BY a.admission_id;
""")
adms_on_occ_beds = cur.fetchall()
print(f"Admissions joined on Occupied beds: {len(adms_on_occ_beds)}")

# In dim_admission_inputs:
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.bed_number, d.discharge_status
    FROM dim_admission_inputs d
    WHERE d.discharge_status = 'Admitted'
    ORDER BY d.admission_id;
""")
dim_admitted = cur.fetchall()
print(f"Admitted in dim_admission_inputs: {len(dim_admitted)}")

# Which record in dim_admitted does NOT correspond to an occupied bed?
occ_bed_nums = {b['bed_number'] for b in occ_beds}
extra_in_dim = [d for d in dim_admitted if d['bed_number'] not in occ_bed_nums]
print(f"\nAdmitted in dim_admission_inputs on beds that are NOT Occupied ({len(extra_in_dim)}):")
for e in extra_in_dim:
    print(" ", e)

# Also check if any bed has duplicate admissions in dim_admission_inputs:
from collections import Counter
bed_counts = Counter(d['bed_number'] for d in dim_admitted if d['bed_number'])
dups = {b: c for b, c in bed_counts.items() if c > 1}
print(f"\nDuplicate bed_numbers in dim_admission_inputs: {dups}")

cur.close()
conn.close()
