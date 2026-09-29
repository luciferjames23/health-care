import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. ALL TABLES IN POSTGRESQL ===")
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
""")
tables = [r['table_name'] for r in cur.fetchall()]
print(tables)

print("\n=== 2. CHECK SPECIFIC ADMIN TABLES ===")
for t in ['departments', 'users', 'roles', 'permissions', 'billing_services', 'doctors', 'wards', 'rooms', 'beds', 'insurance_claims', 'payments', 'pharmacy_inventory', 'hospital_stores']:
    if t in tables:
        cur.execute(f"SELECT COUNT(*) as cnt FROM {t}")
        cnt = cur.fetchone()['cnt']
        cur.execute(f"SELECT * FROM {t} LIMIT 2")
        sample = [dict(r) for r in cur.fetchall()]
        print(f"Table '{t}' ({cnt} rows):")
        for s in sample:
            print("  ", s)

conn.close()
