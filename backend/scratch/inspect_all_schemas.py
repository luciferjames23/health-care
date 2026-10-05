import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from db_config import get_db_connection
import psycopg2.extras

def inspect_modules():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    tables_to_check = [
        'admissions',
        'dim_admission_inputs',
        'discharge_summaries',
        'dim_generated_discharge_summaries',
        'beds',
        'wards',
        'rooms',
        'nursing_tasks',
        'ward_sbar_handovers',
        'emar_records',
        'emergency_triage',
        'escalations',
        'mlc_records',
        'ot_schedules',
        'ot_surgeries',
        'pharmacy_inventory',
        'pharmacy_sales',
        'pharmacy_sale_items',
        'procurement_orders',
        'hospital_stores',
        'hospital_vendors',
        'blood_bank_inventory',
        'blood_bank_units',
        'cssd_sterilization_records',
        'bills',
        'bill_items',
        'payments',
        'refunds',
        'insurance_claims',
        'insurance_claim_items',
        'appointments',
        'pre_admissions',
        'staff_rosters',
        'employee_leave_requests',
        'employee_leave_balances'
    ]
    
    print("================ TABLE SCHEMAS & KEY METRICS ================")
    for table in tables_to_check:
        try:
            cur.execute(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{table}'
                ORDER BY ordinal_position;
            """)
            cols = [f"{c['column_name']} ({c['data_type']})" for c in cur.fetchall()]
            
            cur.execute(f'SELECT count(*) as total FROM "{table}";')
            tot = cur.fetchone()['total']
            
            print(f"\n--- TABLE: {table} ({tot} rows) ---")
            print("Columns:", ", ".join(cols[:12]) + ("..." if len(cols) > 12 else ""))
            
            cur.execute(f'SELECT * FROM "{table}" LIMIT 1;')
            sample = cur.fetchone()
            if sample:
                # Print sample non-null keys
                print("Sample keys:", {k: v for k, v in list(sample.items())[:6]})
        except Exception as e:
            conn.rollback()
            print(f"Error inspecting {table}: {e}")
            
    conn.close()

if __name__ == '__main__':
    inspect_modules()
