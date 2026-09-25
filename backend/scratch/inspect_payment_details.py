import os
import sys
from psycopg2.extras import RealDictCursor

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.dashboard_routes import get_conn

def inspect_details():
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    tables_to_check = ['payments', 'refunds', 'bills', 'appointments', 'audit_logs', 'agent_action_logs']

    for t in tables_to_check:
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position;
        """, (t,))
        cols = cur.fetchall()
        print(f"\n=================== TABLE: {t} ===================")
        for c in cols:
            print(f"  {c['column_name']:30} {c['data_type']:25} NULLABLE: {c['is_nullable']}")

        cur.execute(f"SELECT COUNT(*) FROM {t};")
        cnt = cur.fetchone()['count']
        print(f"TOTAL ROWS IN {t}: {cnt}")

        if cnt > 0:
            cur.execute(f"SELECT * FROM {t} ORDER BY 1 DESC LIMIT 3;")
            rows = cur.fetchall()
            print(f"SAMPLE RECENT ROWS IN {t}:")
            for r in rows:
                print(" ", dict(r))

    cur.close()
    conn.close()

if __name__ == "__main__":
    inspect_details()
