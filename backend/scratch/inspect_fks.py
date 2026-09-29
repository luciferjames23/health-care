import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("SELECT COALESCE(MAX(id), 0) FROM payments;")
print("Max payment id:", cur.fetchone()[0])

# Inspect FK constraints
cur.execute("""
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
""")
fks = cur.fetchall()
print(f"\nTotal Foreign Keys in public schema: {len(fks)}")
for fk in fks:
    print(f"  {fk[0]}.{fk[1]} -> {fk[2]}.{fk[3]}")

conn.close()
