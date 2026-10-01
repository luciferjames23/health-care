import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Inspect roles table
cur.execute("SELECT * FROM roles;")
print("Existing roles in DB:")
for r in cur.fetchall():
    print(" ", dict(r))

# 2. Inspect patients table columns
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'patients'
    ORDER BY ordinal_position;
""")
print("\nPatients table columns:")
for c in cur.fetchall():
    print(f"  {c['column_name']} ({c['data_type']})")

# 3. Inspect a few sample patients
cur.execute("""
    SELECT id, patient_code, first_name, last_name, phone_number, email, date_of_birth, gender
    FROM patients
    WHERE email IS NOT NULL OR phone_number IS NOT NULL
    LIMIT 5;
""")
print("\nSample patients:")
for p in cur.fetchall():
    print(" ", dict(p))

# 4. Check if users table has patient_id or patient role
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
""")
print("\nUsers table columns:")
for c in cur.fetchall():
    print(f"  {c['column_name']} ({c['data_type']})")

cur.close()
conn.close()
