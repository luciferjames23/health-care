import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Update all unlinked pharmacy sales for admitted inpatients
cur.execute("""
    UPDATE pharmacy_sales ps
    SET 
        admission_id = adm.admission_id,
        bill_id = b.bill_id
    FROM dim_admission_inputs adm
    JOIN patients p ON adm.patient_number = p.patient_code
    LEFT JOIN bills b ON adm.admission_id = b.admission_id
    WHERE ps.patient_id = p.id
      AND adm.discharge_status != 'Discharged'
      AND ps.admission_id IS NULL;
""")
updated_count = cur.rowcount
conn.commit()
print(f"Updated {updated_count} pharmacy sales with admission_id and bill_id.")

# 2. Test query for Christoer Parthalan's bill
cur.execute("""
    SELECT 
        psi.sale_item_id,
        psi.sale_id,
        COALESCE(m.medication_name, 'Prescribed Medication') as item_name,
        m.generic_name,
        m.category,
        psi.quantity,
        psi.unit_price,
        psi.discount_amount,
        psi.tax_amount,
        psi.net_amount,
        ps.sale_date,
        ps.payment_status
    FROM pharmacy_sales ps
    JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
    LEFT JOIN medications m ON psi.medication_id = m.medication_id
    WHERE ps.admission_id = 87232 OR ps.patient_id = 87233
    ORDER BY psi.sale_item_id ASC
""")
items = cur.fetchall()
print(f"\nPharmacy Items for Christoer Parthalan ({len(items)} items):")
total_pharmacy = 0
for it in items:
    amt = float(it['net_amount'] or (it['quantity'] * it['unit_price']))
    total_pharmacy += amt
    print(f"  - {it['item_name']} ({it['generic_name']}): {it['quantity']} units @ ₹{it['unit_price']} = ₹{amt:,.2f} [Status: {it['payment_status']}]")

print(f"\nTotal Pharmacy Subtotal: ₹{total_pharmacy:,.2f}")

conn.close()
