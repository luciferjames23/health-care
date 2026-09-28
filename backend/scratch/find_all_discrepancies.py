import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

# Check all Ready or Discharged patients in dim_admission_inputs
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.discharge_status, d.bill_status as dim_bill_status,
           b.bill_id, b.bill_status as real_bill_status, b.net_amount, b.patient_amount, b.insurance_amount,
           ic.claim_id, ic.claim_status
    FROM dim_admission_inputs d
    LEFT JOIN bills b ON (b.admission_id = d.admission_id OR (b.patient_id = d.patient_id AND b.admission_id IS NOT NULL))
    LEFT JOIN insurance_claims ic ON ic.bill_id = b.bill_id
    WHERE d.discharge_status IN ('Ready', 'Discharged')
    ORDER BY d.discharge_status, d.patient_id;
""")
colnames = [desc[0] for desc in cur.description]
rows = cur.fetchall()
print(f"Total rows for Ready/Discharged: {len(rows)}")

discrepant_bills = []
for r in rows:
    row_dict = dict(zip(colnames, r))
    if row_dict['real_bill_status'] != 'Settled' or (row_dict['claim_status'] and row_dict['claim_status'] not in ('Approved', 'Settled')):
        discrepant_bills.append(row_dict)

print(f"Found {len(discrepant_bills)} discrepant bills:")
for db in discrepant_bills[:10]:
    print(db)

conn.close()
