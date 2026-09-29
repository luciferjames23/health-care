import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

for t in ["prescriptions", "prescription_items", "pharmacy_sales", "pharmacy_sale_items", "pharmacy_inventory"]:
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = %s 
        ORDER BY ordinal_position;
    """, (t,))
    print(f"\n{t} columns:")
    for r in cur.fetchall():
        print(f"  {r[0]} ({r[1]})")

cur.execute("SELECT inventory_id, medication_id, batch_number, unit_price, quantity_in_stock FROM pharmacy_inventory LIMIT 5;")
print("\nSample pharmacy_inventory:", cur.fetchall())

conn.close()
