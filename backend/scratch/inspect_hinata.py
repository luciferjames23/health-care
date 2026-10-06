import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

print('=== ALL PATIENTS (SEARCH) ===')
cur.execute("""
    SELECT id, patient_code, first_name, last_name, phone, email, date_of_birth, gender 
    FROM patients 
    WHERE first_name ILIKE %s OR last_name ILIKE %s
""", ('%Hinata%', '%Mephisto%'))
pats = cur.fetchall()
for p in pats:
    print('\n----------------------------------------')
    print('Patient:', p)
    pid = p[0]

    print('\n=== ADMISSIONS (dim_admission_inputs) ===')
    cur.execute("SELECT admission_id, patient_id, first_name, last_name, admission_date, ward_name, bed_number FROM dim_admission_inputs WHERE patient_id = %s", (pid,))
    for adm in cur.fetchall():
        print('Admission:', adm)

    print('\n=== PATIENT VISITS (patient_visits) ===')
    cur.execute("SELECT id, patient_id, visit_number, admission_date, status FROM patient_visits WHERE patient_id = %s", (pid,))
    for v in cur.fetchall():
        print('Visit:', v)

    print('\n=== PRESCRIPTIONS (prescriptions) ===')
    cur.execute("SELECT id, patient_id, doctor_id, prescription_date, status, notes FROM prescriptions WHERE patient_id = %s", (pid,))
    for rx in cur.fetchall():
        print('Prescription:', rx)
        cur.execute("SELECT id, prescription_id, medication_id, drug_name, dosage, frequency, duration, instructions FROM prescription_items WHERE prescription_id = %s", (rx[0],))
        for item in cur.fetchall():
            print('  Item:', item)

    print('\n=== PHARMACY SALES (pharmacy_sales) ===')
    cur.execute("SELECT sale_id, sale_number, patient_id, admission_id, total_amount, status, created_at FROM pharmacy_sales WHERE patient_id = %s OR admission_id IN (SELECT admission_id FROM dim_admission_inputs WHERE patient_id = %s) OR patient_id IN (SELECT admission_id FROM dim_admission_inputs WHERE patient_id = %s)", (pid, pid, pid))
    for ps in cur.fetchall():
        print('Pharmacy Sale:', ps)
        cur.execute("SELECT sale_item_id, sale_id, inventory_id, quantity, unit_price, total_price FROM pharmacy_sale_items WHERE sale_id = %s", (ps[0],))
        for psi in cur.fetchall():
            print('  Sale Item:', psi)

    print('\n=== BILLS & BILL ITEMS (bills) ===')
    cur.execute("SELECT bill_id, bill_number, patient_id, total_amount, paid_amount, balance_amount, payment_status, bill_date FROM bills WHERE patient_id = %s", (pid,))
    for b in cur.fetchall():
        print('Bill:', b)
        cur.execute("SELECT item_id, bill_id, item_type, item_name, unit_price, quantity, total_amount FROM bill_items WHERE bill_id = %s", (b[0],))
        for bi in cur.fetchall():
            print('  Bill Item:', bi)

    print('\n=== APPOINTMENTS (appointments) ===')
    cur.execute("SELECT appointment_id, appointment_number, patient_id, doctor_id, appointment_date, status, reason FROM appointments WHERE patient_id = %s", (pid,))
    for ap in cur.fetchall():
        print('Appointment:', ap)

conn.close()
