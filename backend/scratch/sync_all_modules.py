import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

# 1. Fetch all 10 Discharged and 39 Ready admissions
cur.execute("""
    SELECT admission_id, patient_id, discharge_status 
    FROM dim_admission_inputs 
    WHERE discharge_status IN ('Ready', 'Discharged');
""")
ready_and_discharged = cur.fetchall()
print(f"Found {len(ready_and_discharged)} Ready/Discharged records.")

admission_ids = [r[0] for r in ready_and_discharged if r[0] is not None]
patient_ids = [r[1] for r in ready_and_discharged if r[1] is not None]

# 2. Update bills for these admissions/patients to 'Settled'
cur.execute("""
    UPDATE bills
    SET bill_status = 'Settled',
        insurance_amount = CASE WHEN insurance_amount = 0 THEN gross_amount * 0.85 ELSE insurance_amount END,
        patient_amount = CASE WHEN insurance_amount = 0 THEN gross_amount * 0.15 ELSE gross_amount - insurance_amount END
    WHERE admission_id = ANY(%s) OR (patient_id = ANY(%s) AND admission_id IS NOT NULL);
""", (admission_ids, patient_ids))
print(f"Updated {cur.rowcount} bills to Settled.")

# 3. Update insurance claims
# For Discharged: Settled
cur.execute("""
    UPDATE insurance_claims
    SET claim_status = 'Settled Cashless',
        approved_amount = claimed_amount,
        settled_amount = claimed_amount,
        outstanding_amount = 0.00
    WHERE bill_id IN (SELECT bill_id FROM bills WHERE admission_id IN (SELECT admission_id FROM dim_admission_inputs WHERE discharge_status = 'Discharged'))
       OR patient_id IN (SELECT patient_id FROM dim_admission_inputs WHERE discharge_status = 'Discharged');
""")
print(f"Updated {cur.rowcount} claims to Settled Cashless for Discharged patients.")

# For Ready: Approved
cur.execute("""
    UPDATE insurance_claims
    SET claim_status = 'Approved',
        approved_amount = claimed_amount,
        settled_amount = claimed_amount,
        outstanding_amount = 0.00
    WHERE bill_id IN (SELECT bill_id FROM bills WHERE admission_id IN (SELECT admission_id FROM dim_admission_inputs WHERE discharge_status = 'Ready'))
       OR patient_id IN (SELECT patient_id FROM dim_admission_inputs WHERE discharge_status = 'Ready');
""")
print(f"Updated {cur.rowcount} claims to Approved for Ready patients.")

# 4. Update payments
cur.execute("""
    UPDATE payments
    SET payment_status = 'SUCCESS'
    WHERE bill_id IN (SELECT bill_id FROM bills WHERE admission_id = ANY(%s))
       OR patient_id = ANY(%s);
""", (admission_ids, patient_ids))
print(f"Updated {cur.rowcount} payments to SUCCESS.")

# 5. Ensure dim_admission_inputs has bill_status = 'Paid', bill_clearance_status = 'Cleared', outstanding_balance = 0.00
cur.execute("""
    UPDATE dim_admission_inputs
    SET bill_status = 'Paid',
        bill_clearance_status = 'Cleared',
        outstanding_balance = 0.00
    WHERE discharge_status IN ('Ready', 'Discharged');
""")
print(f"Updated {cur.rowcount} dim_admission_inputs to Cleared.")

conn.commit()

# Verify Senthilel Parthalan
print("\n=== VERIFY SENTHILEL PARTHALAN ===")
cur.execute("""
    SELECT b.bill_id, b.bill_number, b.admission_id, b.patient_id, b.gross_amount, b.bill_status, 
           ic.claim_id, ic.claim_number, ic.claim_status, ic.claimed_amount, ic.approved_amount
    FROM bills b
    LEFT JOIN insurance_claims ic ON ic.bill_id = b.bill_id
    WHERE b.patient_id = 87240 OR b.admission_id = 87239;
""")
for r in cur.fetchall():
    print(r)

cur.execute("""
    SELECT payment_id, bill_id, patient_id, amount, payment_method, payment_status
    FROM payments
    WHERE patient_id = 87240 OR bill_id = 87239;
""")
print("\nPayments:")
for r in cur.fetchall():
    print(r)

conn.close()
