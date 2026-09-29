import sys, os
sys.path.append(os.path.abspath('.'))
import db_config
conn = db_config.get_db_connection()
cur = conn.cursor()
cur.execute("""
    ALTER TABLE discharge_summaries 
        ALTER COLUMN diagnoses TYPE text,
        ALTER COLUMN case_history TYPE text,
        ALTER COLUMN investigations TYPE text,
        ALTER COLUMN treatment TYPE text,
        ALTER COLUMN primary_consultant TYPE varchar(255),
        ALTER COLUMN discharge_advice TYPE text,
        ALTER COLUMN surgery_details TYPE text,
        ALTER COLUMN patient_condition TYPE text;
""")
conn.commit()
print("Alter table discharge_summaries completed successfully!")
cur.execute("SELECT column_name, data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_name = 'discharge_summaries';")
for col in cur.fetchall():
    print("discharge_summaries col:", col)
cur.close()
conn.close()
