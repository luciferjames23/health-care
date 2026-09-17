import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\AI_Conversational_Patient_Desk\Healthcare-Prototype\backend"
sys.path.append(backend_dir)
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

print("--- RECENT APPOINTMENTS ---")
cur.execute("""
    SELECT a.id, a.booking_id, a.patient_id, p.patient_code, p.first_name, p.last_name, a.doctor_id, d.display_name, a.appointment_date, a.appointment_time, a.status 
    FROM appointments a 
    LEFT JOIN doctors d ON a.doctor_id = d.id 
    LEFT JOIN patients p ON a.patient_id = p.id
    ORDER BY a.id DESC LIMIT 20;
""")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
