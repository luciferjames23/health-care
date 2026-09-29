import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")

import db_config

print("=== DISCOVERY PHASE: DATABASE CONNECTION & TABLES ===")
conn = db_config.get_db_connection()
cur = conn.cursor()
try:
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    print("Discovered Public Database Tables:")
    for t in tables:
        print(f" - {t}")
finally:
    cur.close()
    conn.close()
