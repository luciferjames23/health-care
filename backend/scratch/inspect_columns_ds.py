import sys, os
sys.path.append(os.path.abspath('.'))
import db_config
conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'discharge_summaries';")
print("discharge_summaries:", cur.fetchall())
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dim_generated_discharge_summaries';")
print("dim_generated_discharge_summaries:", cur.fetchall())
cur.close()
conn.close()
