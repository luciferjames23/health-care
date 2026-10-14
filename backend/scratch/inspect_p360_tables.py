import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

def inspect_table(cur, table_name):
    print(f"\n=== TABLE: {table_name} ===")
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position;
    """, (table_name,))
    cols = cur.fetchall()
    for col in cols:
        print(f"  {col[0]} ({col[1]})")
    cur.execute(f"SELECT COUNT(*) FROM {table_name};")
    cnt = cur.fetchone()[0]
    print(f"  --> Total rows: {cnt}")
    if cnt > 0:
        cur.execute(f"SELECT * FROM {table_name} LIMIT 2;")
        sample = cur.fetchall()
        print(f"  --> Sample row 1:")
        for col_name, val in zip([c[0] for c in cols], sample[0]):
            print(f"      {col_name}: {repr(val)[:120]}")

def main():
    conn = get_db_connection()
    cur = conn.cursor()
    for t in ['radiology_scan', 'radiology_orders', 'radiology_order_studies', 'patient_reports', 'bills', 'bill_items', 'payments', 'discharge_summaries', 'dim_generated_discharge_summaries', 'diagnoses', 'prescriptions']:
        inspect_table(cur, t)
    conn.close()

if __name__ == '__main__':
    main()
