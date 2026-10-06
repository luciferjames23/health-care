import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'appointments'")
for r in cur.fetchall():
    print(r)
conn.close()
