import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_name IN ('patient_procedures','patient_insurance','notifications')
    AND ordinal_position = 1
    ORDER BY table_name
""")
for r in cur.fetchall():
    print(r[0], '->', r[1])
conn.close()
