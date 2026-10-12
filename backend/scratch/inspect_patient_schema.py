import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

print("--- PATIENTS TABLE COLUMNS ---")
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'patients'
    ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(r)

print("\n--- PATIENTS TABLE CONSTRAINTS ---")
cur.execute("""
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'patients'::regclass;
""")
for r in cur.fetchall():
    print(r)

print("\n--- PATIENTS TABLE INDEXES ---")
cur.execute("""
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'patients';
""")
for r in cur.fetchall():
    print(r)

print("\n--- PATIENTS TABLE SEQUENCES / MAX ID ---")
cur.execute("SELECT pg_get_serial_sequence('patients', 'id'), MAX(id), COUNT(*) FROM patients;")
print(cur.fetchone())

cur.close()
conn.close()
