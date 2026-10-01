import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT admission_id, patient_id FROM dim_admission_inputs;")
dim_rows = cur.fetchall()

existing_adm_ids = {r.get('admission_id') for r in dim_rows if r.get('admission_id') is not None}
existing_pat_ids = {r.get('patient_id') for r in dim_rows if r.get('patient_id') is not None}

cur.execute("""
    SELECT DISTINCT ON (b.bed_id)
        a.admission_id,
        a.patient_id,
        (p.first_name || ' ' || COALESCE(p.last_name, '')) AS patient_name,
        a.discharge_status,
        b.bed_number,
        b.status as bed_status
    FROM admissions a
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE b.status = 'Occupied' AND (a.discharge_status IS NULL OR LOWER(a.discharge_status) != 'discharged')
    ORDER BY b.bed_id, a.admission_id DESC;
""")
live_rows = cur.fetchall()
new_recs = [r for r in live_rows if r['admission_id'] not in existing_adm_ids and r['patient_id'] not in existing_pat_ids]
print(f"Total live rows matching query: {len(live_rows)}")
print(f"Total new_recs added: {len(new_recs)}")
for r in new_recs:
    print("  Extra record:", dict(r))
