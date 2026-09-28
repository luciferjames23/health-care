import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT column_name, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'dim_admission_inputs' AND character_maximum_length IS NOT NULL
    ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]}")
conn.close()
