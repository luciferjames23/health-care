import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

for t in ["procedures", "patient_procedures"]:
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = %s 
        ORDER BY ordinal_position;
    """, (t,))
    print(f"\n{t} columns:")
    for r in cur.fetchall():
        print(f"  {r[0]} ({r[1]})")

conn.close()
