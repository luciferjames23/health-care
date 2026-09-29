import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("""
    SELECT id, doctor_code, display_name, specialization, department_id 
    FROM doctors 
    WHERE display_name ILIKE '%Arun%' 
       OR display_name ILIKE '%Priya%' 
       OR display_name ILIKE '%Suresh%'
       OR display_name ILIKE '%Rahul%'
       OR display_name ILIKE '%Ravi%'
    ORDER BY id;
""")
for r in cur.fetchall():
    print(r)

conn.close()
