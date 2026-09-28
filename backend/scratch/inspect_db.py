import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import json

conn = db_config.get_db_connection()
cur = conn.cursor()

# Get all tables in all schemas
cur.execute("""
    SELECT table_schema, table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name;
""")
tables = cur.fetchall()
print(f"Total tables/views found: {len(tables)}")
for schema, name, ttype in tables:
    print(f"[{schema}] {name} ({ttype})")

conn.close()
