import sys
sys.path.append('backend')
from connectors.databricks_connector import DatabricksConnector
import psycopg2.extras

db = DatabricksConnector()
conn = db.get_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

tables = cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
tables = cur.fetchall()

print("Searching for 'Arun Menon' across all public tables...")
for t in tables:
    tname = t['table_name']
    cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{tname}'")
    cols = cur.fetchall()
    text_cols = [c['column_name'] for c in cols if c['data_type'] in ['character varying', 'text', 'character']]
    if not text_cols: continue
    
    where = " OR ".join([f'"{c}" ILIKE \'%Arun Menon%\'' for c in text_cols])
    try:
        cur.execute(f'SELECT * FROM "{tname}" WHERE {where} LIMIT 5')
        matches = cur.fetchall()
        if matches:
            print(f"Table '{tname}' ({len(matches)} matches):")
            for m in matches:
                print("  ", m)
    except Exception as e:
        conn.rollback()

conn.close()
