import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("""
    SELECT table_name, column_name, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND data_type = 'character varying' 
      AND character_maximum_length <= 50
      AND table_name IN ('patients', 'patient_insurance', 'patient_visits', 'admissions', 'diagnoses', 'vital_signs', 'prescriptions', 'prescription_items', 'lab_orders', 'bills', 'bill_items', 'insurance_claims', 'notifications')
    ORDER BY table_name, column_name;
""")

for r in cur.fetchall():
    print(f"{r[0]}.{r[1]} -> varchar({r[2]})")

cur.close()
conn.close()
