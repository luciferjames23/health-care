import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

def get_max_and_count(table, id_col):
    try:
        cur.execute(f"SELECT COALESCE(MAX({id_col}), 0), COUNT(*) FROM {table};")
        m, c = cur.fetchone()
        print(f"Table '{table}': count={c}, max({id_col})={m}")
    except Exception as e:
        print(f"Table '{table}' error: {e}")
        conn.rollback()

print("=== CHECKING TABLE MAX IDs AND COUNTS ===")
get_max_and_count("patients", "id")
get_max_and_count("admissions", "admission_id")
get_max_and_count("patient_visits", "visit_id")
get_max_and_count("appointments", "id")
get_max_and_count("diagnoses", "diagnosis_id")
get_max_and_count("vital_signs", "vital_id")
get_max_and_count("lab_orders", "lab_order_id")
get_max_and_count("lab_results", "lab_result_id")
get_max_and_count("prescriptions", "prescription_id")
get_max_and_count("prescription_items", "prescription_item_id")
get_max_and_count("pharmacy_sales", "sale_id")
get_max_and_count("pharmacy_sale_items", "sale_item_id")
get_max_and_count("bills", "bill_id")
get_max_and_count("bill_items", "bill_item_id")
get_max_and_count("payments", "payment_id")
get_max_and_count("patient_insurance", "insurance_id")
get_max_and_count("insurance_claims", "claim_id")
get_max_and_count("discharge_summaries", "summary_id")
get_max_and_count("dim_admission_inputs", "admission_id")
get_max_and_count("dim_generated_discharge_summaries", "summary_id")

# Check doctors, departments, wards, beds, lab_tests, medications
print("\n=== MASTER DATA COUNTS ===")
get_max_and_count("doctors", "id")
get_max_and_count("departments", "id")
get_max_and_count("wards", "ward_id")
get_max_and_count("rooms", "room_id")
get_max_and_count("beds", "bed_id")
get_max_and_count("lab_tests", "lab_test_id")
get_max_and_count("medications", "medication_id")
get_max_and_count("billing_services", "service_id")

conn.close()
