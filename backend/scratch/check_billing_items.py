import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. BILLS FOR CHRISTOER PARTHALAN (patient_id: 87233, admission_id: 87232) ===")
cur.execute("""
    SELECT * FROM bills WHERE patient_id = 87233 OR admission_id = 87232
""")
bills = cur.fetchall()
for b in bills:
    print("BILL:", dict(b))

if bills:
    bid = bills[0]['bill_id']
    print(f"\n=== 2. BILL ITEMS FOR BILL ID {bid} ===")
    cur.execute("""
        SELECT * FROM bill_items WHERE bill_id = %s
    """, (bid,))
    for item in cur.fetchall():
        print("  ITEM:", dict(item))

print("\n=== 3. PHARMACY SALES FOR PATIENT 87233 / ADMISSION 87232 ===")
cur.execute("""
    SELECT ps.*, psi.*, m.medication_name, m.generic_name, m.category
    FROM pharmacy_sales ps
    LEFT JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
    LEFT JOIN medications m ON psi.medication_id = m.medication_id
    WHERE ps.patient_id = 87233 OR ps.admission_id = 87232
""")
for s in cur.fetchall():
    print("  SALE:", dict(s))

conn.close()
