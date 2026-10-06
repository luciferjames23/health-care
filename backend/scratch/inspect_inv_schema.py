import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pharmacy_inventory'")
for c in cur.fetchall():
    print(c)

cur.execute("SELECT * FROM pharmacy_inventory LIMIT 3")
for r in cur.fetchall():
    print('Sample inv:', r)

conn.close()
