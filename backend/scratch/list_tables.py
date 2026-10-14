import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection


def main():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;")
    tables = [r[0] for r in cur.fetchall()]
    print(f"Total tables: {len(tables)}")
    for t in tables:
        print(f"  {t}")
    conn.close()

if __name__ == '__main__':
    main()
