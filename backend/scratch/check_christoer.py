import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== PATIENT MER-PAT-0087233 (Christoer Parthalan) ===")
cur.execute("SELECT id, patient_code, first_name, last_name FROM patients WHERE patient_code = 'MER-PAT-0087233'")
p = cur.fetchone()
print("Patient:", dict(p))
pid = p['id']

# Prescriptions
cur.execute("""
    SELECT p.prescription_id, p.prescription_date, p.status, 
           pi.medication_id, pi.dosage, pi.frequency, pi.route, pi.duration, pi.quantity,
           m.medication_code, m.medication_name, m.generic_name, m.dosage_form, m.strength, m.unit_price, m.is_high_alert
    FROM prescriptions p
    LEFT JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
    LEFT JOIN medications m ON pi.medication_id = m.medication_id
    WHERE p.patient_id = %s
    ORDER BY p.prescription_id ASC
""", (pid,))
rxs = cur.fetchall()
print(f"\nPrescriptions ({len(rxs)}):")
for rx in rxs:
    print("  RX:", dict(rx))

# Pharmacy Sales
cur.execute("""
    SELECT ps.sale_id, ps.prescription_id, ps.sale_date, ps.total_amount, ps.net_amount, ps.payment_status,
           psi.medication_id, psi.quantity, psi.unit_price, m.medication_code, m.medication_name
    FROM pharmacy_sales ps
    LEFT JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
    LEFT JOIN medications m ON psi.medication_id = m.medication_id
    WHERE ps.patient_id = %s
    ORDER BY ps.sale_id ASC
""", (pid,))
sales = cur.fetchall()
print(f"\nPharmacy Sales ({len(sales)}):")
for s in sales:
    print("  SALE:", dict(s))

# Drug Master entry for Vancomycin & Propofol
cur.execute("""
    SELECT medication_id, medication_code, medication_name, generic_name, dosage_form, strength, unit_price, is_high_alert, schedule, route
    FROM medications
    WHERE medication_id IN (12, 20)
""")
drugs = cur.fetchall()
print(f"\nDrug Master formulary items:")
for d in drugs:
    print("  DRUG:", dict(d))

conn.close()
