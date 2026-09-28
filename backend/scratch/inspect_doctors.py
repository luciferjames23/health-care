import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config

conn = db_config.get_db_connection()
cur = conn.cursor()

cur.execute("SELECT id, doctor_code, display_name, specialization, department_id FROM doctors ORDER BY id LIMIT 10;")
print("Doctors sample:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT id, department_code, department_name FROM departments ORDER BY id LIMIT 10;")
print("\nDepartments sample:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT ward_id, ward_name, department_id FROM wards ORDER BY ward_id LIMIT 10;")
print("\nWards sample:")
for r in cur.fetchall():
    print(" ", r)

cur.execute("SELECT bed_id, bed_number, ward_id, room_id, status FROM beds WHERE status = 'Available' OR status = 'Occupied' LIMIT 10;")
print("\nBeds sample:")
for r in cur.fetchall():
    print(" ", r)

conn.close()
