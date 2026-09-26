import sys, os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
import db_config
from psycopg2.extras import RealDictCursor

def inspect_columns():
    conn = db_config.get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    tables = [
        'patients', 'patient_visits', 'admissions', 'diagnoses', 
        'vital_signs', 'prescriptions', 'prescription_items', 
        'pharmacy_sales', 'pharmacy_sale_items', 'lab_orders', 
        'lab_results', 'bills', 'bill_items', 'patient_insurance', 
        'insurance_claims', 'discharge_summaries'
    ]
    for t in tables:
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = %s 
            ORDER BY ordinal_position;
        """, (t,))
        cols = cur.fetchall()
        col_strs = [f"{c['column_name']} ({c['data_type']})" for c in cols]
        print(f"=== {t} ({len(cols)} cols) ===")
        print(", ".join(col_strs))
        print()

    cur.close()
    conn.close()

if __name__ == '__main__':
    inspect_columns()
