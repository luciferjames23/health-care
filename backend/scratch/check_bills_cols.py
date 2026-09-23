import sys
sys.path.append('.')
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='bills'")
print("bills columns:", [r[0] for r in cur.fetchall()])
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='bill_items'")
print("bill_items columns:", [r[0] for r in cur.fetchall()])
conn.close()
