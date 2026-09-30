import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'dim_admission_inputs';")
print("Cols:", [r['column_name'] for r in cur.fetchall()])

cur.close()
conn.close()
