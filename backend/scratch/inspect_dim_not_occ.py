import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. 209 Occupied beds in beds table
cur.execute("""
    SELECT DISTINCT ON (b.bed_id)
        b.bed_id, b.bed_number, b.status as bed_status,
        a.admission_id, a.admission_number, a.patient_id, a.discharge_status as adm_ds,
        p.patient_code, p.first_name, p.last_name
    FROM beds b
    JOIN admissions a ON b.bed_id = a.bed_id
    JOIN patients p ON a.patient_id = p.id
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id, a.admission_id DESC;
""")
active_209 = cur.fetchall()
occ_pids = {r['patient_id'] for r in active_209}
occ_aids = {r['admission_id'] for r in active_209}

# 2. dim_admission_inputs rows
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.first_name, d.last_name, d.discharge_status, d.bed_number,
           b.status as bed_status, a.discharge_status as adm_ds
    FROM dim_admission_inputs d
    LEFT JOIN admissions a ON d.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE LOWER(d.discharge_status) != 'discharged';
""")
dim_active = cur.fetchall()

not_in_occ = [r for r in dim_active if r['patient_id'] not in occ_pids and r['admission_id'] not in occ_aids]
print(f"dim active records not in current 209 occupied beds: {len(not_in_occ)}")
for r in not_in_occ:
    print(dict(r))

cur.close()
conn.close()
