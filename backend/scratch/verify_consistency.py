import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras
import requests

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. VERIFY PRESCRIPTIONS FOR CHRISTOER PARTHALAN ===")
cur.execute("""
    SELECT p.prescription_id, 'RX-2026-' || LPAD(p.prescription_id::text, 4, '0') as rx_no,
           pat.first_name || ' ' || pat.last_name as pat_name, pat.patient_code,
           m.medication_name, m.generic_name, m.dosage_form, m.strength, m.is_high_alert,
           pi.dosage, pi.frequency, pi.route, pi.duration, pi.quantity,
           p.status, p.prescription_date
    FROM prescriptions p
    JOIN patients pat ON p.patient_id = pat.id
    JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
    JOIN medications m ON pi.medication_id = m.medication_id
    WHERE pat.patient_code = 'MER-PAT-0087233'
    ORDER BY p.prescription_id ASC;
""")
for r in cur.fetchall():
    print(dict(r))

print("\n=== 2. VERIFY PHARMACY SALES FOR CHRISTOER PARTHALAN ===")
cur.execute("""
    SELECT ps.sale_id, 'PH-' || LPAD(ps.sale_id::text, 5, '0') as sale_no,
           ps.prescription_id, 'RX-2026-' || ps.prescription_id as linked_rx,
           pat.first_name || ' ' || pat.last_name as pat_name, pat.patient_code,
           m.medication_name, psi.quantity, psi.unit_price, ps.net_amount, ps.payment_status
    FROM pharmacy_sales ps
    JOIN patients pat ON ps.patient_id = pat.id
    JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
    JOIN medications m ON psi.medication_id = m.medication_id
    WHERE pat.patient_code = 'MER-PAT-0087233'
    ORDER BY ps.sale_id ASC;
""")
for r in cur.fetchall():
    print(dict(r))

print("\n=== 3. VERIFY EMAR RECORDS FOR CHRISTOER PARTHALAN ===")
cur.execute("""
    SELECT * FROM emar_records WHERE patient_name = 'Christoer Parthalan' ORDER BY id ASC;
""")
for r in cur.fetchall():
    print(dict(r))

print("\n=== 4. VERIFY DRUG MASTER MATCHING ===")
cur.execute("""
    SELECT medication_id, medication_code, medication_name, generic_name, dosage_form, strength, is_high_alert, unit_price
    FROM medications
    WHERE medication_id IN (12, 20);
""")
for r in cur.fetchall():
    print(dict(r))

conn.close()
