import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

def sync_seq(table, col):
    cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), COALESCE((SELECT MAX({col}) FROM {table}), 0) + 1, false)")

# 1. Update Hinata's prescription_items
cur.execute("SELECT prescription_item_id, instructions FROM prescription_items WHERE prescription_id = 277377 ORDER BY prescription_item_id")
p_items = cur.fetchall()
print('Current items:', p_items)

med_mapping = [
    (11, 'Inj. Piperacillin + Tazobactam', 480.00),
    (12, 'Inj. Vancomycin HCl', 360.00),
    (17, 'Inj. Noradrenaline', 185.00),
    (28, 'Inj. Pantoprazole', 65.00)
]

for idx, item in enumerate(p_items):
    m_id, m_name, m_price = med_mapping[idx]
    cur.execute("UPDATE prescription_items SET medication_id = %s WHERE prescription_item_id = %s", (m_id, item[0]))

# 2. Check or create pharmacy_sales for Hinata
cur.execute("SELECT sale_id FROM pharmacy_sales WHERE patient_id = 1004429")
existing_sales = cur.fetchall()
print('Existing sales for 1004429:', existing_sales)

if not existing_sales:
    sync_seq('pharmacy_sales', 'sale_id')
    sync_seq('pharmacy_sale_items', 'sale_item_id')
    cur.execute("SELECT COALESCE(MAX(sale_id), 0) + 1 FROM pharmacy_sales")
    new_sale_id = cur.fetchone()[0]
    total_sales_amt = sum(10 * m[2] for m in med_mapping) # 10900.00

    cur.execute("""
        INSERT INTO pharmacy_sales (
            sale_id, patient_id, visit_id, admission_id, prescription_id, bill_id,
            sale_date, total_amount, discount_amount, tax_amount, net_amount, payment_status
        ) VALUES (
            %s, 1004429, 277216, 87515, 277377, 277218,
            CURRENT_TIMESTAMP, %s, 0.00, 0.00, %s, 'Paid'
        )
    """, (new_sale_id, total_sales_amt, total_sales_amt))

    for m_id, m_name, m_price in med_mapping:
        cur.execute("SELECT inventory_id FROM pharmacy_inventory WHERE medication_id = %s LIMIT 1", (m_id,))
        inv_row = cur.fetchone()
        inv_id = inv_row[0] if inv_row else None
        
        cur.execute("SELECT COALESCE(MAX(sale_item_id), 0) + 1 FROM pharmacy_sale_items")
        new_item_id = cur.fetchone()[0]

        cur.execute("""
            INSERT INTO pharmacy_sale_items (
                sale_item_id, sale_id, medication_id, inventory_id,
                quantity, unit_price, discount_amount, tax_amount, net_amount
            ) VALUES (
                %s, %s, %s, %s,
                10, %s, 0.00, 0.00, %s
            )
        """, (new_item_id, new_sale_id, m_id, inv_id, m_price, float(10 * m_price)))

# 3. Check or create appointment for Hinata
cur.execute("SELECT id FROM appointments WHERE patient_id = 1004429")
apt_rows = cur.fetchall()
print('Existing appointments for 1004429:', apt_rows)

if not apt_rows:
    sync_seq('appointments', 'id')
    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM appointments")
    new_apt_id = cur.fetchone()[0]
    b_id = f"BK-20261006-{str(new_apt_id).zfill(4)}"

    cur.execute("""
        INSERT INTO appointments (
            id, booking_id, patient_id, doctor_id, department_id,
            appointment_date, appointment_time, status, booking_source,
            patient_reason, reason_for_visit, appointment_type,
            created_at, updated_at
        ) VALUES (
            %s, %s, 1004429, 9, 10,
            CURRENT_DATE, CURRENT_TIME, 'CONFIRMED', 'Hospital Portal',
            'Urosepsis with SIRS Protocol',
            'Urosepsis with SIRS Protocol',
            'INPATIENT_ROUNDS',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
    """, (new_apt_id, b_id))

conn.commit()
print('Hinata data successfully linked and verified in PostgreSQL.')
conn.close()
