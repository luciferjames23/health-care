import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.postgres_connector import PostgresConnector

db = PostgresConnector()
conn = db.get_connection()
cur = db.get_dict_cursor(conn)
cur.execute("""
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_name IN ('patients', 'patient_insurance', 'admissions', 'dim_admission_inputs', 'diagnoses', 'bills', 'bill_items', 'insurance_claims', 'insurance_claim_items', 'claim_appeals')
    ORDER BY tc.table_name;
""")
for r in cur.fetchall():
    print(f"{r['table_name']}.{r['column_name']} -> {r['foreign_table_name']}.{r['foreign_column_name']}")
cur.close()
conn.close()
