import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'notifications' 
    ORDER BY ordinal_position;
""")
print("=== NOTIFICATIONS COLUMNS ===")
for r in cur.fetchall():
    print(r)

cur.execute("SELECT COUNT(*) FROM notifications;")
print("\nTotal notifications count:", cur.fetchone()[0])

cur.execute("SELECT * FROM notifications ORDER BY id DESC LIMIT 10;")
colnames = [d[0] for d in cur.description]
for r in cur.fetchall():
    print(dict(zip(colnames, r)))

conn.close()
