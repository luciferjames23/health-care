import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

print('=== 10 MOST RECENT PATIENTS ===')
cur.execute("SELECT id, patient_code, first_name, last_name, phone, created_at FROM patients ORDER BY id DESC LIMIT 10")
for p in cur.fetchall():
    print(p)

print('\n=== 10 MOST RECENT ADMISSIONS ===')
cur.execute("SELECT admission_id, patient_id, first_name, last_name, admission_date, ward_name, bed_number FROM dim_admission_inputs ORDER BY admission_id DESC LIMIT 10")
for adm in cur.fetchall():
    print(adm)

print('\n=== 10 MOST RECENT PRESCRIPTIONS ===')
cur.execute("""
    SELECT p.id, p.patient_id, pat.first_name, pat.last_name, p.doctor_id, p.prescription_date 
    FROM prescriptions p
    LEFT JOIN patients pat ON p.patient_id = pat.id
    ORDER BY p.id DESC LIMIT 10
""")
for rx in cur.fetchall():
    print(rx)

print('\n=== 10 MOST RECENT BILLS ===')
cur.execute("""
    SELECT b.bill_id, b.bill_number, b.patient_id, pat.first_name, pat.last_name, b.total_amount, b.bill_date 
    FROM bills b
    LEFT JOIN patients pat ON b.patient_id = pat.id
    ORDER BY b.bill_id DESC LIMIT 10
""")
for b in cur.fetchall():
    print(b)

print('\n=== 10 MOST RECENT APPOINTMENTS ===')
cur.execute("""
    SELECT a.appointment_id, a.appointment_number, a.patient_id, pat.first_name, pat.last_name, a.appointment_date, a.status 
    FROM appointments a
    LEFT JOIN patients pat ON a.patient_id = pat.id
    ORDER BY a.appointment_id DESC LIMIT 10
""")
for ap in cur.fetchall():
    print(ap)

conn.close()
