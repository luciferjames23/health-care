import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

def clean_db():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    
    # Check all string columns across all tables for chr(65533)
    cur.execute("""
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND data_type IN ('text', 'character varying');
    """)
    cols = cur.fetchall()
    
    for t, c in cols:
        try:
            cur.execute(f"SELECT count(*) FROM {t} WHERE {c} LIKE '%\ufffd%'")
            cnt = cur.fetchone()[0]
            if cnt > 0:
                print(f"Found {cnt} bad chars in {t}.{c}")
                cur.execute(f"UPDATE {t} SET {c} = REPLACE({c}, '\ufffd', '°') WHERE {c} LIKE '%\ufffd%'")
                conn.commit()
                print(f"Fixed {t}.{c}")
        except Exception as e:
            conn.rollback()

    conn.close()
    print("Database character cleanup complete.")

if __name__ == '__main__':
    clean_db()
