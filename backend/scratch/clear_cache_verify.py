import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection
from connectors.databricks_connector import DatabricksConnector

conn = get_db_connection()
cur = conn.cursor()

# Check payments table for patient 87240
cur.execute("SELECT id, bill_id, patient_id, amount, payment_method, payment_status FROM payments WHERE patient_id = 87240 OR bill_id = 87239;")
print("Payments for 87240:")
for r in cur.fetchall():
    print(r)

# Check bills
cur.execute("SELECT bill_id, bill_number, patient_id, admission_id, gross_amount, bill_status, insurance_amount, patient_amount FROM bills WHERE patient_id = 87240 OR admission_id = 87239;")
print("\nBills for 87240 / 87239:")
for r in cur.fetchall():
    print(r)

# Check insurance claims
cur.execute("SELECT claim_id, claim_number, patient_id, bill_id, claimed_amount, approved_amount, settled_amount, outstanding_amount, claim_status FROM insurance_claims WHERE patient_id = 87240 OR bill_id = 87239;")
print("\nClaims for 87240 / 87239:")
for r in cur.fetchall():
    print(r)

DatabricksConnector.clear_cache()
print("\nCache cleared successfully.")

conn.close()
