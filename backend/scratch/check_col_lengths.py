import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

for t in ["patient_visits", "admissions", "diagnoses", "prescriptions", "prescription_items", "bills", "bill_items", "patient_insurance", "insurance_claims"]:
    cur.execute("""
        SELECT column_name, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name = %s AND character_maximum_length IS NOT NULL
        ORDER BY ordinal_position;
    """, (t,))
    print(f"\n{t} varchar lengths:")
    for r in cur.fetchall():
        print(f"  {r[0]}: {r[1]}")

conn.close()
