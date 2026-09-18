import sys, os
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path: sys.path.append(backend_dir)
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversations';")
for row in cur.fetchall():
    print(f"{row[0]}: {row[1]}")
cur.close()
conn.close()
