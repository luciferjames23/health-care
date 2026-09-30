import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'beds';")
print("Beds cols:", [r['column_name'] for r in cur.fetchall()])

cur.execute("SELECT COUNT(*) AS c FROM beds;")
print("Total beds:", cur.fetchone()['c'])

cur.execute("SELECT status, COUNT(*) AS c FROM beds GROUP BY status;")
print("Beds by status:", cur.fetchall())

cur.execute("SELECT COUNT(*) AS c FROM admissions WHERE discharge_status IS NULL OR LOWER(discharge_status) != 'discharged';")
print("Active admissions in admissions table:", cur.fetchone()['c'])

cur.execute("SELECT COUNT(*) AS c FROM dim_admission_inputs;")
print("Total in dim_admission_inputs:", cur.fetchone()['c'])

cur.execute("SELECT discharge_status, COUNT(*) AS c FROM dim_admission_inputs GROUP BY discharge_status;")
print("dim_admission_inputs by discharge_status:", cur.fetchall())

cur.execute("""
    SELECT a.admission_id, a.patient_id, p.first_name, p.last_name, a.discharge_status, b.bed_number, b.status as bed_status
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE a.discharge_status IS NULL OR LOWER(a.discharge_status) != 'discharged';
""")
active_admissions = cur.fetchall()
print("Total active admissions returned:", len(active_admissions))

cur.execute("SELECT admission_id, patient_id, discharge_status FROM dim_admission_inputs;")
dim_rows = cur.fetchall()
dim_adm_ids = {r['admission_id'] for r in dim_rows if r['admission_id'] is not None}
dim_pat_ids = {r['patient_id'] for r in dim_rows if r['patient_id'] is not None}

missing_in_dim = [a for a in active_admissions if a['admission_id'] not in dim_adm_ids and a['patient_id'] not in dim_pat_ids]
print("Active admissions missing from dim_admission_inputs:", len(missing_in_dim))
for m in missing_in_dim:
    print("  Missing in dim:", m)

# Discharged in dim vs admissions
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.patient_name, d.discharge_status as dim_ds, a.discharge_status as adm_ds, b.status as bed_status
    FROM dim_admission_inputs d
    LEFT JOIN admissions a ON d.admission_id = a.admission_id OR d.patient_id = a.patient_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE LOWER(d.discharge_status) = 'discharged';
""")
dim_discharged = cur.fetchall()
print("Discharged in dim_admission_inputs count:", len(dim_discharged))
for dd in dim_discharged:
    print("  Dim discharged:", dd)

cur.close()
conn.close()
