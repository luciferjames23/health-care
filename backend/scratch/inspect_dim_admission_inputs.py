import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'dim_admission_inputs' 
    ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(f"{r[0]}: {r[1]}")
conn.close()
