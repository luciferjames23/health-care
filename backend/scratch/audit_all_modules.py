import os
import sys
from pathlib import Path

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from db_config import get_db_connection
import psycopg2.extras

def audit_database():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    print("================ DATABASE TABLES & ROW COUNTS ================")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [r['table_name'] for r in cur.fetchall()]
    table_counts = {}
    for t in tables:
        try:
            cur.execute(f'SELECT count(*) as c FROM "{t}";')
            cnt = cur.fetchone()['c']
            table_counts[t] = cnt
            print(f"  {t:<35}: {cnt:>6} rows")
        except Exception as e:
            conn.rollback()
            print(f"  {t:<35}: ERROR ({e})")
            
    print("\n================ DETAILED CLINICAL & OPERATIONAL METRICS ================")
    
    # 1. Admissions / Discharges / Census
    if 'admissions' in table_counts:
        cur.execute("SELECT status, count(*) FROM admissions GROUP BY status;")
        print("Admissions by status:", cur.fetchall())
        
        cur.execute("SELECT count(DISTINCT patient_id) FROM admissions WHERE status ILIKE '%admit%' OR status = 'Admitted';")
        print("Distinct Admitted Patients:", cur.fetchone()['count'])
        
    if 'discharge_summaries' in table_counts:
        cur.execute("SELECT count(*) FROM discharge_summaries;")
        print("Discharge Summaries count:", cur.fetchone()['count'])
        cur.execute("SELECT status, count(*) FROM discharge_summaries GROUP BY status;")
        print("Discharge Summaries by status:", cur.fetchall())

    if 'beds' in table_counts:
        cur.execute("SELECT is_occupied, count(*) FROM beds GROUP BY is_occupied;")
        print("Beds occupancy:", cur.fetchall())
        cur.execute("SELECT status, count(*) FROM beds GROUP BY status;")
        print("Beds by status:", cur.fetchall())

    # 2. Emergency / ED
    for ed_tbl in ['emergency_visits', 'ed_patients', 'emergency_admissions']:
        if ed_tbl in table_counts:
            cur.execute(f"SELECT * FROM {ed_tbl} LIMIT 3;")
            print(f"{ed_tbl} sample:", cur.fetchall())

    # 3. Nursing Tasks
    if 'nursing_tasks' in table_counts:
        cur.execute("SELECT status, count(*) FROM nursing_tasks GROUP BY status;")
        print("Nursing tasks by status:", cur.fetchall())
        cur.execute("SELECT flag_status, count(*) FROM nursing_tasks GROUP BY flag_status;")
        print("Nursing tasks by flag_status:", cur.fetchall())

    # 4. Pharmacy & Prescriptions
    for pharm_tbl in ['pharmacy_inventory', 'medications', 'prescriptions', 'dispense_logs']:
        if pharm_tbl in table_counts:
            cur.execute(f"SELECT count(*) FROM {pharm_tbl};")
            print(f"{pharm_tbl} count:", cur.fetchone()['count'])

    # 5. Operating Rooms & Surgeries
    for or_tbl in ['surgeries', 'operating_rooms', 'surgical_cases', 'or_schedules']:
        if or_tbl in table_counts:
            cur.execute(f"SELECT count(*) FROM {or_tbl};")
            print(f"{or_tbl} count:", cur.fetchone()['count'])

    # 6. Billing & Claims & Invoices
    for bill_tbl in ['invoices', 'claims', 'billing_records', 'billing_items']:
        if bill_tbl in table_counts:
            cur.execute(f"SELECT count(*) FROM {bill_tbl};")
            print(f"{bill_tbl} count:", cur.fetchone()['count'])
            
    conn.close()

if __name__ == '__main__':
    audit_database()
