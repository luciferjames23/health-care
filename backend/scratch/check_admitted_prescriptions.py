import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT 
        adm.admission_id,
        adm.patient_number,
        adm.first_name,
        adm.last_name,
        adm.ward_name,
        adm.bed_number,
        adm.attending_doctor,
        pat.id as patient_id
    FROM dim_admission_inputs adm
    JOIN patients pat ON adm.patient_number = pat.patient_code
    WHERE adm.discharge_status != 'Discharged'
    ORDER BY adm.admission_id ASC
""")
admitted = cur.fetchall()
print(f"Total active admitted patients: {len(admitted)}")

# Check how many admitted patients have prescriptions
rx_counts = 0
for a in admitted:
    cur.execute("""
        SELECT p.prescription_id, p.status, pi.dosage, pi.frequency, pi.route, m.medication_name, m.is_high_alert
        FROM prescriptions p
        JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
        JOIN medications m ON pi.medication_id = m.medication_id
        WHERE p.patient_id = %s
    """, (a['patient_id'],))
    rxs = cur.fetchall()
    if rxs:
        rx_counts += 1

print(f"Admitted patients with prescriptions in DB: {rx_counts} / {len(admitted)}")

# Let's inspect a sample of 5 admitted patients and their prescriptions
for a in admitted[:5]:
    cur.execute("""
        SELECT p.prescription_id, p.status, p.prescription_date, pi.dosage, pi.frequency, pi.route, pi.duration, pi.quantity,
               m.medication_name, m.dosage_form, m.is_high_alert
        FROM prescriptions p
        JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
        JOIN medications m ON pi.medication_id = m.medication_id
        WHERE p.patient_id = %s
        ORDER BY p.prescription_id DESC
    """, (a['patient_id'],))
    rxs = cur.fetchall()
    print(f"\nPatient {a['first_name']} {a['last_name']} ({a['patient_number']}, Bed: {a['bed_number']}):")
    for rx in rxs:
        print("  ", dict(rx))

conn.close()
