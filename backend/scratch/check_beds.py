import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("SELECT status, COUNT(bed_id) FROM beds GROUP BY status")
print("=== Beds table status count in PostgreSQL ===")
for r in cur.fetchall():
    print(r)

cur.execute("""
    SELECT COUNT(bed_id) 
    FROM beds 
    WHERE status = 'Occupied'
""")
occ_beds = cur.fetchone()[0]
print("Total occupied beds in DB:", occ_beds)

cur.execute("""
    SELECT COUNT(bed_id) 
    FROM beds 
    WHERE status = 'Available'
""")
avail_beds = cur.fetchone()[0]
print("Total available beds in DB:", avail_beds)

cur.close()
conn.close()
