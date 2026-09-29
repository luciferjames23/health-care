import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT id, patient_code, first_name, last_name, phone, whatsapp_number FROM patients WHERE first_name ILIKE '%John%' OR last_name ILIKE '%Peter%' OR patient_code LIKE '%1000061%';")
rows = cur.fetchall()
print("Found patients:", rows)
cur.close()
conn.close()
