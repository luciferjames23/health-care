import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("""
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'discharge_summaries'::regclass;
""")
print("discharge_summaries constraints:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("""
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'dim_generated_discharge_summaries'::regclass;
""")
print("\ndim_generated_discharge_summaries constraints:")
for r in cur.fetchall():
    print(" ", r)

conn.close()
