import sys, os
sys.path.append(os.path.abspath('.'))
from routers.gold import db_connector

conn = db_connector.get_connection()
cur = conn.cursor()

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'dim_admission_inputs';")
print("dim_admission_inputs columns:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'beds';")
print("beds columns:", [r[0] for r in cur.fetchall()])

cur.close()
conn.close()
