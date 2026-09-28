import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("SELECT medication_id, medication_code, medication_name, category, unit_price FROM medications ORDER BY medication_id LIMIT 25;")
for r in cur.fetchall():
    print(r)

cur.execute("SELECT inventory_id, medication_id, batch_number, selling_price, available_quantity FROM pharmacy_inventory ORDER BY inventory_id LIMIT 10;")
print("\nInventory sample:")
for r in cur.fetchall():
    print(r)

conn.close()
