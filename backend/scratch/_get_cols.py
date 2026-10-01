import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
conn = db_config.get_db_connection()
cur = conn.cursor()

for tbl in ['admissions', 'bills', 'vital_signs']:
    cur.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name=%s ORDER BY ordinal_position",
        (tbl,)
    )
    cols = [r[0] for r in cur.fetchall()]
    print(f"{tbl}: {cols}")

conn.close()
