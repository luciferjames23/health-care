import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

pid = 87227

# Check patients
cur.execute("SELECT * FROM patients WHERE id = %s;", (pid,))
p = cur.fetchone()
print("Patient profile:", dict(p) if p else None)

# Check admissions
cur.execute("SELECT * FROM admissions WHERE patient_id = %s;", (pid,))
adms = cur.fetchall()
print(f"Admissions ({len(adms)}):", [dict(a) for a in adms[:2]])

# Check dim_admission_inputs
cur.execute("SELECT * FROM dim_admission_inputs WHERE patient_id = %s;", (pid,))
dim_adms = cur.fetchall()
print(f"dim_admission_inputs ({len(dim_adms)}):", [dict(a) for a in dim_adms[:2]])

# Check appointments
cur.execute("SELECT * FROM appointments WHERE patient_id = %s;", (pid,))
appts = cur.fetchall()
print(f"Appointments ({len(appts)}):", [dict(a) for a in appts[:2]])

# Check vital_signs
cur.execute("SELECT * FROM vital_signs WHERE patient_id = %s;", (pid,))
vitals = cur.fetchall()
print(f"Vital signs ({len(vitals)}):", [dict(v) for v in vitals[:2]])

# Check prescriptions
cur.execute("SELECT * FROM prescriptions WHERE patient_id = %s;", (pid,))
rxs = cur.fetchall()
print(f"Prescriptions ({len(rxs)}):", [dict(r) for r in rxs[:2]])

# Check lab_orders
cur.execute("SELECT * FROM lab_orders WHERE patient_id = %s;", (pid,))
labs = cur.fetchall()
print(f"Lab orders ({len(labs)}):", [dict(l) for l in labs[:2]])

# Check bills
cur.execute("SELECT * FROM bills WHERE patient_id = %s;", (pid,))
bills = cur.fetchall()
print(f"Bills ({len(bills)}):", [dict(b) for b in bills[:2]])

# Check insurance_claims
cur.execute("SELECT * FROM insurance_claims WHERE patient_id = %s;", (pid,))
claims = cur.fetchall()
print(f"Claims ({len(claims)}):", [dict(c) for c in claims[:2]])

# Check discharge summaries
cur.execute("SELECT * FROM dim_generated_discharge_summaries WHERE patient_id = %s;", (pid,))
sums = cur.fetchall()
print(f"Discharge summaries ({len(sums)}):", [dict(s) for s in sums[:2]])

# Check notifications
cur.execute("SELECT * FROM notifications WHERE patient_id = %s;", (pid,))
notes = cur.fetchall()
print(f"Notifications ({len(notes)}):", [dict(n) for n in notes[:2]])

cur.close()
conn.close()
