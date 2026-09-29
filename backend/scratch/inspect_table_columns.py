import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

tables_to_check = [
    "dim_admission_inputs",
    "dim_generated_discharge_summaries",
    "discharge_summaries",
    "admissions",
    "patient_visits",
    "bills",
    "bill_items",
    "patient_insurance",
    "insurance_claims",
    "vital_signs",
    "diagnoses",
    "lab_orders",
    "lab_results",
    "prescriptions",
    "prescription_items",
    "pharmacy_sales"
]

for t in tables_to_check:
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position;
    """, (t,))
    cols = cur.fetchall()
    print(f"\n=== Table: {t} ({len(cols)} columns) ===")
    for c in cols:
        print(f"  {c[0]} ({c[1]}, nullable={c[2]})")

conn.close()
