import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\AI_Conversational_Patient_Desk\Healthcare-Prototype\backend"
sys.path.append(backend_dir)
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

print("--- DOCTORS ---")
cur.execute("SELECT id, display_name, user_id, department_id FROM doctors;")
for r in cur.fetchall():
    print(r)

print("\n--- DOCTOR USERS ---")
cur.execute("SELECT u.id, u.username, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'DOCTOR';")
for r in cur.fetchall():
    print(r)

print("\n--- PATIENT GIL CHRIST ---")
cur.execute("SELECT id, patient_code, first_name, last_name, phone FROM patients WHERE patient_code = 'P9989' OR LOWER(first_name) LIKE 'gil%';")
for r in cur.fetchall():
    print(r)

print("\n--- APPOINTMENTS FOR DR EDWIN STEPHANO J (id 1 or name) ---")
cur.execute("""
    SELECT a.id, a.booking_id, a.patient_id, p.patient_code, p.first_name, p.last_name, a.doctor_id, d.display_name, a.appointment_date, a.appointment_time, a.status 
    FROM appointments a 
    JOIN doctors d ON a.doctor_id = d.id 
    JOIN patients p ON a.patient_id = p.id 
    WHERE d.display_name LIKE '%Edwin%';
""")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
