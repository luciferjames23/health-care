import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT COUNT(*) FROM escalations;")
print("Total escalations:", cur.fetchone()['count'])

cur.execute("SELECT * FROM escalations ORDER BY id DESC LIMIT 5;")
for r in cur.fetchall():
    print(r)

conn.close()
