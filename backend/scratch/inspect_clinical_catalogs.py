import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("SELECT procedure_id, procedure_code, procedure_name, department_id, standard_charge FROM procedures LIMIT 10;")
print("Procedures sample:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT medication_id, medication_code, medication_name, category, unit_price FROM medications LIMIT 10;")
print("\nMedications sample:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT lab_test_id, test_code, test_name, test_category, standard_charge FROM lab_tests;")
print("\nLab tests:")
for r in cur.fetchall():
    print(" ", r)

conn.close()
