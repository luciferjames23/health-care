import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== TOTAL COUNTS IN DB ===")
for tbl in ['patients', 'prescriptions', 'prescription_items', 'medications', 'pharmacy_sales', 'pharmacy_sale_items', 'emar_records', 'dim_admission_inputs']:
    cur.execute(f"SELECT COUNT(*) as cnt FROM {tbl}")
    print(f"{tbl}: {cur.fetchone()['cnt']}")

print("\n=== CHECK DRUG MASTER ITEMS IN PRESCRIPTIONS ===")
cur.execute("""
    SELECT pi.medication_id, COUNT(*) as usage_count, m.medication_name, m.dosage_form, m.strength, m.unit_price
    FROM prescription_items pi
    LEFT JOIN medications m ON pi.medication_id = m.medication_id
    GROUP BY pi.medication_id, m.medication_name, m.dosage_form, m.strength, m.unit_price
    ORDER BY usage_count DESC
    LIMIT 10
""")
for r in cur.fetchall():
    print(dict(r))

print("\n=== CHECK PRESCRIBED VS DISPENSED STATUS IN PRESCRIPTIONS ===")
cur.execute("SELECT status, COUNT(*) as cnt FROM prescriptions GROUP BY status")
for r in cur.fetchall():
    print(dict(r))

print("\n=== CHECK PHARMACY SALES PAYMENT STATUS ===")
cur.execute("SELECT payment_status, COUNT(*) as cnt FROM pharmacy_sales GROUP BY payment_status")
for r in cur.fetchall():
    print(dict(r))

print("\n=== PATIENT CHRISTOER PARTHALAN FULL AUDIT ===")
cur.execute("SELECT id, patient_code, first_name, last_name FROM patients WHERE LOWER(first_name || ' ' || COALESCE(last_name, '')) LIKE '%christoer%' OR patient_code LIKE '%87233%'")
pats = cur.fetchall()
for p in pats:
    pid = p['id']
    print(f"\n--- Patient: {p['first_name']} {p['last_name']} ({p['patient_code']}) ID: {pid} ---")
    
    # Prescriptions
    cur.execute("""
        SELECT p.prescription_id, p.prescription_date, p.status, 
               pi.dosage, pi.frequency, pi.route, pi.duration, pi.quantity,
               m.medication_name, m.generic_name, m.dosage_form, m.strength
        FROM prescriptions p
        LEFT JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
        LEFT JOIN medications m ON pi.medication_id = m.medication_id
        WHERE p.patient_id = %s
    """, (pid,))
    rxs = cur.fetchall()
    print(f"Prescriptions ({len(rxs)}):")
    for rx in rxs:
        print("  RX:", dict(rx))
        
    # Pharmacy Sales
    cur.execute("""
        SELECT ps.sale_id, ps.prescription_id, ps.sale_date, ps.net_amount, ps.payment_status,
               psi.quantity, psi.unit_price, m.medication_name
        FROM pharmacy_sales ps
        LEFT JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
        LEFT JOIN medications m ON psi.medication_id = m.medication_id
        WHERE ps.patient_id = %s
    """, (pid,))
    sales = cur.fetchall()
    print(f"Pharmacy Sales ({len(sales)}):")
    for s in sales:
        print("  SALE:", dict(s))
        
    # eMAR
    pat_full_name = f"{p['first_name']} {p['last_name']}".strip()
    cur.execute("SELECT * FROM emar_records WHERE LOWER(patient_name) = LOWER(%s)", (pat_full_name,))
    emars = cur.fetchall()
    print(f"eMAR Records ({len(emars)}):")
    for em in emars:
        print("  EMAR:", dict(em))

conn.close()
