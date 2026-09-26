import sys, os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/..'))
import db_config

def main():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema') 
        ORDER BY table_schema, table_name;
    """)
    rows = cur.fetchall()
    print(f"Total tables: {len(rows)}")
    for r in rows:
        print(f"{r[0]}.{r[1]}")
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
