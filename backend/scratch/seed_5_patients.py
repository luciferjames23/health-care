import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import psycopg2
import psycopg2.extras
from api.auth_helper import get_hashed_password

conn = psycopg2.connect(
    host="127.0.0.1",
    port=5432,
    dbname="live_backup",
    user="postgres",
    password="Lucifer",
    connect_timeout=3
)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Get role_id for Patient
cur.execute("SELECT id FROM roles WHERE LOWER(name) = 'patient';")
role_row = cur.fetchone()
patient_role_id = role_row["id"]
print(f"Patient role_id: {patient_role_id}")

# 2. Check existing patient users
cur.execute("""
    SELECT u.id, u.username, r.name as role, u.patient_id, p.patient_code, p.first_name, p.last_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN patients p ON p.id = u.patient_id
    WHERE LOWER(r.name) = 'patient';
""")
existing_users = cur.fetchall()
print(f"Existing patient users count: {len(existing_users)}")
for u in existing_users:
    print(dict(u))

# 3. Target 5 sample patients:
# Patient 1: 87227 (username: patient)
# Patient 2: 87225 (username: kavitha.raman)
# Patient 3: 142901 (username: rajesh.v)
# Patient 4: 4 (username: anand.n)
# Patient 5: 9 (username: divya.n)

target_patients = [
    {"patient_id": 142901, "username": "rajesh.v", "email": "rajesh.v@meridian.com", "phone": "+91 98401 55101"},
    {"patient_id": 4, "username": "anand.n", "email": "anand.n@meridian.com", "phone": "+919810000004"},
    {"patient_id": 9, "username": "divya.n", "email": "divya.n@meridian.com", "phone": "+919810000009"}
]

hashed_pw = get_hashed_password("Hospital@2026")

for tp in target_patients:
    cur.execute("SELECT id FROM users WHERE patient_id = %s OR LOWER(username) = LOWER(%s);", (tp["patient_id"], tp["username"]))
    u_exist = cur.fetchone()
    if not u_exist:
        cur.execute("""
            INSERT INTO users (username, password_hash, role_id, patient_id, email, phone, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id;
        """, (tp["username"], hashed_pw, patient_role_id, tp["patient_id"], tp["email"], tp["phone"]))
        new_id = cur.fetchone()["id"]
        print(f"Created patient user: {tp['username']} (ID {new_id}, patient_id {tp['patient_id']})")
    else:
        # Ensure password and role are active
        cur.execute("""
            UPDATE users SET password_hash = %s, role_id = %s, is_active = true, patient_id = %s
            WHERE id = %s;
        """, (hashed_pw, patient_role_id, tp["patient_id"], u_exist["id"]))
        print(f"Updated existing user: {tp['username']} (ID {u_exist['id']})")

conn.commit()

# Verify exactly 5 patient users
cur.execute("""
    SELECT u.id, u.username, r.name as role, u.patient_id, p.patient_code,
           TRIM(CONCAT(p.first_name, ' ', p.last_name)) as full_name,
           p.gender, p.blood_group, u.phone, u.email
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN patients p ON p.id = u.patient_id
    WHERE LOWER(r.name) = 'patient'
    ORDER BY u.id ASC;
""")
final_patients = cur.fetchall()
print(f"\nFinal Total Patient Users in System ({len(final_patients)}):")
for p in final_patients:
    print(dict(p))

conn.close()
