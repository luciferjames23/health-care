import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from api.dashboard_routes import get_conn

conn = get_conn()
cur = conn.cursor()

cur.execute("""
    SELECT p.prescription_id, p.patient_id, pat.first_name, pat.last_name, 
           d.display_name, p.prescription_date, p.status,
           pi.dosage, pi.frequency, pi.route, pi.duration, pi.quantity, m.medication_name
    FROM prescriptions p
    LEFT JOIN patients pat ON p.patient_id = pat.id
    LEFT JOIN doctors d ON p.doctor_id = d.id
    LEFT JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
    LEFT JOIN medications m ON pi.medication_id = m.medication_id
    ORDER BY p.prescription_date DESC
    LIMIT 10;
""")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
