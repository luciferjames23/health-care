import sys, os
sys.path.append(os.path.abspath('.'))
from routers.gold import db_connector

conn = db_connector.get_connection()
cur = conn.cursor()

# 1. Check admissions table
cur.execute("SELECT count(*) FROM admissions WHERE LOWER(COALESCE(discharge_status, '')) != 'discharged';")
print("Admissions (non-discharged):", cur.fetchone()[0])

# 2. Check dim_admission_inputs table
cur.execute("SELECT count(*) FROM dim_admission_inputs WHERE LOWER(COALESCE(discharge_status, '')) != 'discharged';")
print("dim_admission_inputs (non-discharged):", cur.fetchone()[0])

# 3. Check beds table
cur.execute("SELECT count(*) FROM beds WHERE LOWER(status) = 'occupied';")
print("Beds (status = 'occupied'):", cur.fetchone()[0])

# 4. Check which admitted patient has no occupied bed or bed mismatch
cur.execute("""
SELECT a.admission_id, a.patient_id, a.first_name, a.last_name, a.discharge_status, a.bed_id, b.bed_number, b.status as bed_status
FROM dim_admission_inputs a
LEFT JOIN beds b ON a.bed_id = b.bed_id
WHERE LOWER(COALESCE(a.discharge_status, '')) != 'discharged'
AND (b.status IS NULL OR LOWER(b.status) != 'occupied');
""")
mismatches = cur.fetchall()
print("\nAdmitted patients without occupied bed status in DB:")
for m in mismatches:
    print(m)

# 5. Check occupied beds with no active admitted patient
cur.execute("""
SELECT b.bed_id, b.bed_number, b.status, a.admission_id, a.patient_id, a.first_name, a.last_name, a.discharge_status
FROM beds b
LEFT JOIN dim_admission_inputs a ON b.bed_id = a.bed_id AND LOWER(COALESCE(a.discharge_status, '')) != 'discharged'
WHERE LOWER(b.status) = 'occupied' AND a.admission_id IS NULL;
""")
orphan_beds = cur.fetchall()
print("\nOccupied beds with no active admitted patient:")
for o in orphan_beds:
    print(o)

cur.close()
conn.close()
