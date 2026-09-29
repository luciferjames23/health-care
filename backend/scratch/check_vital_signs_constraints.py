import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("""
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'vital_signs';
""")
cur.execute("SELECT pg_get_serial_sequence('vital_signs', 'vital_id'), MAX(vital_id) FROM vital_signs;")
print('vital_signs sequence and max:', cur.fetchone())
conn.close()
