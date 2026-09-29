import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT 
        ps.sale_id, ps.patient_id, ps.admission_id, ps.prescription_id, ps.bill_id, ps.net_amount, ps.payment_status,
        adm.admission_id as actual_adm_id, adm.first_name, adm.last_name,
        m.medication_name
    FROM pharmacy_sales ps
    JOIN dim_admission_inputs adm ON ps.patient_id = (SELECT id FROM patients WHERE patient_code = adm.patient_number)
    LEFT JOIN pharmacy_sale_items psi ON ps.sale_id = psi.sale_id
    LEFT JOIN medications m ON psi.medication_id = m.medication_id
    WHERE adm.discharge_status != 'Discharged' AND ps.admission_id IS NULL
""")
unlinked = cur.fetchall()
print(f"Total unlinked pharmacy sales for active inpatients: {len(unlinked)}")
for u in unlinked[:10]:
    print(" ", dict(u))

conn.close()
