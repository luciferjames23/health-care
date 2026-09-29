import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config
conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'patients' AND (column_name ILIKE '%code%' OR column_name ILIKE '%number%' OR column_name ILIKE '%id%');
""")
print('patients columns:', cur.fetchall())

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'dim_admission_inputs' AND (column_name ILIKE '%patient%' OR column_name ILIKE '%code%' OR column_name ILIKE '%vital%' OR column_name ILIKE '%temp%' OR column_name ILIKE '%bp%' OR column_name ILIKE '%rate%' OR column_name ILIKE '%oxygen%');
""")
print('dim_admission_inputs vitals columns:', cur.fetchall())

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'vital_signs';
""")
print('vital_signs columns:', cur.fetchall())

cur.execute("SELECT id, patient_code FROM patients LIMIT 5;")
print('Sample patients:', cur.fetchall())

cur.execute("SELECT patient_id, patient_number FROM dim_admission_inputs LIMIT 5;")
print('Sample dim_admission_inputs:', cur.fetchall())

conn.close()
