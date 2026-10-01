import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Users table columns
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
""")
print("Users table columns:")
for c in cur.fetchall():
    print(f"  {c['column_name']} ({c['data_type']})")

# 2. Check if any users have role_id = 8 (Patient)
cur.execute("""
    SELECT u.id, u.username, u.role_id, r.name as role_name, u.email, u.phone
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'Patient' OR u.role_id = 8;
""")
patient_users = cur.fetchall()
print(f"\nExisting users with Patient role ({len(patient_users)}):")
for u in patient_users:
    print(" ", dict(u))

# 3. Check sample patients
cur.execute("""
    SELECT id, patient_code, first_name, last_name, phone, email, date_of_birth, gender
    FROM patients
    WHERE first_name NOT LIKE 'Patient%'
    ORDER BY id ASC
    LIMIT 10;
""")
print("\nSample real patients:")
for p in cur.fetchall():
    print(" ", dict(p))

cur.close()
conn.close()
