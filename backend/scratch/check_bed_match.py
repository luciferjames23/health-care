import sys, os
sys.path.append(os.path.abspath('.'))
from routers.gold import db_connector

conn = db_connector.get_connection()
cur = conn.cursor()

# Check active admissions in dim_admission_inputs
cur.execute("""
SELECT a.admission_id, a.patient_id, a.first_name, a.last_name, a.discharge_status, a.bed_number, b.status as bed_status
FROM dim_admission_inputs a
LEFT JOIN beds b ON a.bed_number = b.bed_number
WHERE LOWER(COALESCE(a.discharge_status, '')) != 'discharged';
""")
rows = cur.fetchall()
print(f"Total non-discharged admissions: {len(rows)}")

unmatched = [r for r in rows if not r[6] or r[6].lower() != 'occupied']
print(f"\nNon-discharged admissions NOT mapped to an occupied bed ({len(unmatched)}):")
for u in unmatched:
    print(" ", u)

# Check all discharged admissions
cur.execute("""
SELECT a.admission_id, a.patient_id, a.first_name, a.last_name, a.discharge_status, a.bed_number, b.status as bed_status
FROM dim_admission_inputs a
LEFT JOIN beds b ON a.bed_number = b.bed_number
WHERE LOWER(COALESCE(a.discharge_status, '')) = 'discharged';
""")
discharged_rows = cur.fetchall()
print(f"\nTotal discharged admissions ({len(discharged_rows)}):")
for d in discharged_rows:
    print(" ", d)

cur.close()
conn.close()
