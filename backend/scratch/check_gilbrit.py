import sys, os
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path: sys.path.append(backend_dir)
import db_config
from agent.patient_identification_service import get_all_patients_by_phone

conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("SELECT id, patient_code, first_name, last_name, phone, whatsapp_number FROM patients WHERE phone LIKE '%8072851813%' OR whatsapp_number LIKE '%8072851813%';")
rows = cur.fetchall()
print(f"Patients for 918072851813 in DB: {rows}")

pats = get_all_patients_by_phone("918072851813")
print(f"get_all_patients_by_phone('918072851813'): {[p['id'] for p in pats]}")
cur.close()
conn.close()
