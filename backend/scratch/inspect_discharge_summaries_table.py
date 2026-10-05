import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.postgres_connector import PostgresConnector

db = PostgresConnector()
conn = db.get_connection()
cur = db.get_dict_cursor(conn)

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'discharge_summaries';")
cols = [r['column_name'] for r in cur.fetchall()]
print("discharge_summaries columns:", cols)

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dim_generated_discharge_summaries';")
dim_cols = [r['column_name'] for r in cur.fetchall()]
print("dim_generated_discharge_summaries columns:", dim_cols)

cur.execute("SELECT approval_status, COUNT(*) FROM discharge_summaries GROUP BY approval_status;")
print("discharge_summaries approval_status:", cur.fetchall())

conn.close()
