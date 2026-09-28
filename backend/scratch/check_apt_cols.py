import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'appointments'
    ORDER BY ordinal_position;
""")
for r in cur.fetchall():
    print(r)
conn.close()
