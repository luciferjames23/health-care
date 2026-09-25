import os
import sys
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.dashboard_routes import get_conn

def check_constraints():
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'payments';
    """)
    print("--- PAYMENTS COLUMNS ---")
    for r in cur.fetchall():
        print(dict(r))

    cur.execute("""
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'refunds';
    """)
    print("\n--- REFUNDS COLUMNS ---")
    for r in cur.fetchall():
        print(dict(r))

    cur.close()
    conn.close()

if __name__ == "__main__":
    check_constraints()
