import os, sys
import psycopg2
import psycopg2.extras

conn = psycopg2.connect(
    host="127.0.0.1",
    port=5432,
    dbname="live_backup",
    user="postgres",
    password="Lucifer",
    connect_timeout=3
)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Check existing patient user accounts
cur.execute("""
    SELECT u.id, u.username, r.name as role, u.patient_id, p.patient_code, p.first_name, p.last_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN patients p ON p.id = u.patient_id
    WHERE LOWER(r.name) = 'patient';
""")
existing = cur.fetchall()
print("Existing Patient Users:")
for u in existing:
    print(dict(u))

# Find top patients with rich admissions, diagnoses, prescriptions
cur.execute("""
    SELECT a.patient_id, p.patient_code, p.first_name, p.last_name, p.phone, p.email,
           COUNT(DISTINCT a.admission_id) as admissions_count,
           COUNT(DISTINCT d.diagnosis_id) as diagnoses_count,
           COUNT(DISTINCT pr.prescription_id) as prescriptions_count,
           COUNT(DISTINCT b.bill_id) as bills_count
    FROM admissions a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN diagnoses d ON d.patient_id = a.patient_id
    LEFT JOIN prescriptions pr ON pr.patient_id = a.patient_id
    LEFT JOIN bills b ON b.patient_id = a.patient_id
    WHERE a.patient_id NOT IN (87225, 87227)
    GROUP BY a.patient_id, p.patient_code, p.first_name, p.last_name, p.phone, p.email
    HAVING COUNT(DISTINCT d.diagnosis_id) > 0 AND COUNT(DISTINCT pr.prescription_id) > 0
    ORDER BY admissions_count DESC, diagnoses_count DESC
    LIMIT 10;
""")
rows = cur.fetchall()
print("\nPatients with rich clinical data:")
for r in rows:
    print(dict(r))

conn.close()
