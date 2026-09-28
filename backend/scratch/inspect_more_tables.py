import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

for t in ["payments", "billing_services", "lab_tests", "medications"]:
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = %s 
        ORDER BY ordinal_position;
    """, (t,))
    print(f"\n{t} columns:")
    for r in cur.fetchall():
        print(f"  {r[0]} ({r[1]})")

cur.execute("SELECT * FROM lab_tests LIMIT 5;")
print("\nSample lab_tests:", cur.fetchall())

cur.execute("SELECT * FROM billing_services LIMIT 5;")
print("\nSample billing_services:", cur.fetchall())

cur.execute("SELECT * FROM payments ORDER BY id DESC LIMIT 3;" if "id" else "SELECT 1;")

conn.close()
