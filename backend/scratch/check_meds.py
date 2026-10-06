import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

def check_meds():
    terms = ['Piperacillin', 'Vancomycin', 'Norepinephrine', 'Pantoprazole']
    for t in terms:
        cur.execute("SELECT medication_id, medication_name, unit_price FROM medications WHERE medication_name ILIKE %s OR generic_name ILIKE %s", (f"%{t}%", f"%{t}%"))
        print(f"Match for {t}:", cur.fetchall())

check_meds()
conn.close()
