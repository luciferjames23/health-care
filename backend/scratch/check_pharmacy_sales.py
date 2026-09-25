import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from api.dashboard_routes import get_conn

conn = get_conn()
cur = conn.cursor()

cur.execute("""
    SELECT ps.sale_id, ps.patient_id, pat.first_name, pat.last_name, 
           ps.sale_date, ps.net_amount, ps.payment_status,
           psi.quantity, psi.unit_price, psi.net_amount as item_net, m.medication_name
    FROM pharmacy_sales ps
    LEFT JOIN patients pat ON ps.patient_id = pat.id
    LEFT JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
    LEFT JOIN medications m ON psi.medication_id = m.medication_id
    ORDER BY ps.sale_date DESC
    LIMIT 10;
""")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
