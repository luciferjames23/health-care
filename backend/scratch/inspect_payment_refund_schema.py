import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.dashboard_routes import get_conn

def inspect_schema():
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # List all tables in public schema
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [row['table_name'] for row in cur.fetchall()]
    print("--- ALL TABLES IN PUBLIC SCHEMA ---")
    for t in tables:
        print("  -", t)

    print("\n--- PAYMENT / REFUND / BILLING / APPOINTMENT / AUDIT RELATED TABLES & COLUMNS ---")
    for t in tables:
        if any(keyword in t.lower() for keyword in ['pay', 'refund', 'bill', 'invoice', 'trans', 'audit', 'appoi', 'patient']):
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position;
            """, (t,))
            cols = cur.fetchall()
            print(f"\nTABLE: {t}")
            for c in cols:
                print(f"  {c['column_name']:30} {c['data_type']:20} NULLABLE: {c['is_nullable']}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    inspect_schema()
