import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import db_config
import psycopg2.extras
from api.auth_helper import get_hashed_password

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Check existing patient users
cur.execute("""
    SELECT u.id, u.username, r.name as role, u.patient_id, p.patient_code, p.first_name, p.last_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN patients p ON p.id = u.patient_id
    WHERE LOWER(r.name) = 'patient';
""")
existing = cur.fetchall()
print(f"Current patient users count: {len(existing)}")
for u in existing:
    print(dict(u))

# 2. Get role_id for Patient
cur.execute("SELECT id FROM roles WHERE LOWER(name) = 'patient';")
role_row = cur.fetchone()
if not role_row:
    print("Error: Patient role not found in roles table!")
    exit(1)
patient_role_id = role_row["id"]
print(f"Patient role_id: {patient_role_id}")

# 3. Find candidates with rich data
existing_pat_ids = [u["patient_id"] for u in existing if u["patient_id"]]
cur.execute("""
    SELECT p.id, p.patient_code, p.first_name, p.last_name, p.email, p.phone,
           (SELECT COUNT(*) FROM admissions a WHERE a.patient_id = p.id) as admissions,
           (SELECT COUNT(*) FROM diagnoses d WHERE d.patient_id = p.id) as diagnoses,
           (SELECT COUNT(*) FROM prescriptions pr WHERE pr.patient_id = p.id) as prescriptions,
           (SELECT COUNT(*) FROM lab_orders lo WHERE lo.patient_id = p.id) as lab_orders,
           (SELECT COUNT(*) FROM bills b WHERE b.patient_id = p.id) as bills
    FROM patients p
    WHERE p.id != ALL(%s)
    ORDER BY (
        (SELECT COUNT(*) FROM admissions a WHERE a.patient_id = p.id) +
        (SELECT COUNT(*) FROM prescriptions pr WHERE pr.patient_id = p.id) +
        (SELECT COUNT(*) FROM lab_orders lo WHERE lo.patient_id = p.id) +
        (SELECT COUNT(*) FROM bills b WHERE b.patient_id = p.id)
    ) DESC
    LIMIT 5;
""", (existing_pat_ids,))
candidates = cur.fetchall()
print("\nTop Candidates:")
for c in candidates:
    print(dict(c))

conn.close()
