import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

# Verify Sharma family - was the worst example
print("=== Sharma doctors ===")
cur.execute("SELECT id, first_name, last_name, display_name FROM doctors WHERE last_name='Sharma' ORDER BY id")
for r in cur.fetchall():
    print(f"  ID={r[0]}: {r[3]}")

# Verify no more letter-suffix names remain
cur.execute("SELECT COUNT(*) FROM doctors WHERE first_name ~ '^[A-Z][a-z]+ [A-Z]\\.$'")
remaining = cur.fetchone()[0]
print(f"\nRemaining letter-suffix doctors: {remaining}")

# Verify total unique display_names
cur.execute("SELECT COUNT(DISTINCT display_name), COUNT(*) FROM doctors")
row = cur.fetchone()
print(f"Unique display names: {row[0]} out of {row[1]} total doctors")

cur.close()
conn.close()
