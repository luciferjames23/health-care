import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Let's check who the 11 discharged patients were in dim_generated_discharge_summaries before:
# Earlier we saw the 11 summaries:
# 87223 (patient 87224), 87224 (patient 87225), 87225 (patient 87226), 87226 (patient 87227),
# 87227 (patient 87228), 87228 (patient 87229), 87229 (patient 87230), 87230 (patient 87231),
# 87231 (patient 87232), 87232 (patient 87233), 87239 (patient 87240).
# Total: 11!

# And who are 87501..87508?
cur.execute("""
    SELECT a.admission_id, a.patient_id, p.first_name, p.last_name, a.discharge_status, b.bed_number, b.status as bed_status
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE a.admission_id >= 87500;
""")
new_adms = cur.fetchall()
print("Admissions >= 87500:")
for n in new_adms:
    print(dict(n))

cur.close()
conn.close()
