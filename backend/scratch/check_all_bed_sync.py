import sys, os
sys.path.append(os.path.abspath('.'))
from routers.gold import db_connector

conn = db_connector.get_connection()
cur = conn.cursor()

# Check all beds for active admissions
cur.execute("""
SELECT a.admission_id, a.patient_id, a.first_name, a.last_name, a.discharge_status, a.bed_number, b.bed_id, b.status
FROM dim_admission_inputs a
LEFT JOIN beds b ON a.bed_number = b.bed_number
WHERE LOWER(COALESCE(a.discharge_status, '')) != 'discharged';
""")
rows = cur.fetchall()
print(f"Total active admissions in dim_admission_inputs: {len(rows)}")

mismatches = [r for r in rows if not r[7] or r[7].lower() != 'occupied']
print(f"Mismatched active admissions ({len(mismatches)}):")
for m in mismatches:
    print(" ", m)

# Check all beds for discharged admissions
cur.execute("""
SELECT a.admission_id, a.patient_id, a.first_name, a.last_name, a.discharge_status, a.bed_number, b.bed_id, b.status
FROM dim_admission_inputs a
LEFT JOIN beds b ON a.bed_number = b.bed_number
WHERE LOWER(COALESCE(a.discharge_status, '')) = 'discharged';
""")
discharged_rows = cur.fetchall()
print(f"\nTotal discharged admissions in dim_admission_inputs: {len(discharged_rows)}")
mismatched_discharged = [r for r in discharged_rows if r[7] and r[7].lower() == 'occupied']
print(f"Discharged admissions whose bed is still occupied ({len(mismatched_discharged)}):")
for md in mismatched_discharged:
    print(" ", md)

cur.close()
conn.close()
