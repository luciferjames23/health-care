import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Check all occupied beds and their current admissions
cur.execute("""
    SELECT 
        b.bed_id, b.bed_number, b.status as bed_status,
        a.admission_id, a.admission_number, a.patient_id, a.discharge_status as adm_ds,
        p.patient_code, p.first_name, p.last_name,
        d.admission_id as dim_adm_id, d.discharge_status as dim_ds
    FROM beds b
    LEFT JOIN (
        SELECT DISTINCT ON (bed_id) *
        FROM admissions
        ORDER BY bed_id, admission_id DESC
    ) a ON b.bed_id = a.bed_id
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN dim_admission_inputs d ON (a.admission_id = d.admission_id OR a.patient_id = d.patient_id)
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id;
""")
occupied = cur.fetchall()
print(f"Total Occupied Beds: {len(occupied)}")

dim_admitted_count = sum(1 for r in occupied if r['dim_ds'] in ('Admitted', 'Ready'))
dim_discharged_count = sum(1 for r in occupied if r['dim_ds'] == 'Discharged')
dim_none_count = sum(1 for r in occupied if r['dim_ds'] is None)

print(f"Occupied beds breakdown in dim_admission_inputs:")
print(f"  dim_ds = 'Admitted' or 'Ready': {dim_admitted_count}")
print(f"  dim_ds = 'Discharged': {dim_discharged_count}")
print(f"  dim_ds = None (missing): {dim_none_count}")

print("\nDetail of occupied beds with dim_ds == 'Discharged' or None:")
for r in occupied:
    if r['dim_ds'] not in ('Admitted', 'Ready'):
        print(r)

cur.close()
conn.close()
