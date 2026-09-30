import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Check all 209 occupied beds in beds table
cur.execute("""
    SELECT DISTINCT ON (b.bed_id)
        b.bed_id, b.bed_number, b.bed_type, b.status as bed_status,
        r.room_number, w.ward_name,
        a.admission_id, a.admission_number, a.patient_id, a.admission_date, a.admission_type,
        a.discharge_status as adm_ds, a.reason_for_admission,
        p.patient_code, p.first_name, p.last_name, p.gender, p.blood_group, p.date_of_birth,
        p.phone, p.email, p.address,
        d.display_name as doctor_name, d.specialization as doctor_dept
    FROM beds b
    JOIN rooms r ON b.room_id = r.room_id
    JOIN wards w ON b.ward_id = w.ward_id
    JOIN admissions a ON b.bed_id = a.bed_id
    JOIN patients p ON a.patient_id = p.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    WHERE b.status = 'Occupied'
    ORDER BY b.bed_id, a.admission_id DESC;
""")
occ_beds = cur.fetchall()
print(f"Total Occupied Beds found: {len(occ_beds)}")

cur.execute("SELECT admission_id, patient_id, discharge_status FROM dim_admission_inputs;")
dim_rows = cur.fetchall()
dim_map_aid = {r['admission_id']: r for r in dim_rows if r['admission_id']}
dim_map_pid = {r['patient_id']: r for r in dim_rows if r['patient_id']}

updated_count = 0
inserted_count = 0

for b in occ_beds:
    aid = b['admission_id']
    pid = b['patient_id']
    
    existing_dim = dim_map_aid.get(aid) or dim_map_pid.get(pid)
    
    if existing_dim:
        curr_ds = str(existing_dim.get('discharge_status', '')).strip().lower()
        if curr_ds == 'discharged':
            # This occupied bed was erroneously marked as discharged in dim_admission_inputs -> update to Admitted
            cur.execute("""
                UPDATE dim_admission_inputs
                SET discharge_status = 'Admitted',
                    bed_number = %s,
                    room_number = %s,
                    ward_name = %s
                WHERE admission_id = %s OR patient_id = %s;
            """, (b['bed_number'], b['room_number'], b['ward_name'], aid, pid))
            updated_count += 1
        else:
            # Update bed/room/ward info
            cur.execute("""
                UPDATE dim_admission_inputs
                SET bed_number = %s,
                    room_number = %s,
                    ward_name = %s
                WHERE admission_id = %s OR patient_id = %s;
            """, (b['bed_number'], b['room_number'], b['ward_name'], aid, pid))
    else:
        # Insert missing record into dim_admission_inputs
        cur.execute("""
            INSERT INTO dim_admission_inputs (
                admission_id, patient_id, admission_number, patient_number,
                first_name, last_name, gender, blood_group,
                admission_date, admission_type, reason_for_admission, primary_diagnosis,
                discharge_status, bed_number, room_number, ward_name,
                attending_doctor, doctor_specialization
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                'Admitted', %s, %s, %s,
                %s, %s
            ) ON CONFLICT DO NOTHING;
        """, (
            aid, pid, b['admission_number'], b['patient_code'],
            b['first_name'], b['last_name'], b['gender'], b['blood_group'],
            b['admission_date'], b['admission_type'], b['reason_for_admission'], b['reason_for_admission'],
            b['bed_number'], b['room_number'], b['ward_name'],
            b['doctor_name'] or 'Attending Physician', b['doctor_dept'] or 'General Medicine'
        ))
        inserted_count += 1

# Update any stale admissions where bed status is Available in beds table to Discharged
cur.execute("""
    SELECT d.admission_id, d.patient_id, d.bed_number, b.status as bed_status
    FROM dim_admission_inputs d
    LEFT JOIN admissions a ON d.admission_id = a.admission_id
    LEFT JOIN beds b ON a.bed_id = b.bed_id
    WHERE b.status = 'Available' AND d.discharge_status IN ('Admitted', 'Ready');
""")
stale_available = cur.fetchall()
print(f"Stale admitted on available beds: {len(stale_available)}")
for sa in stale_available:
    cur.execute("""
        UPDATE dim_admission_inputs
        SET discharge_status = 'Discharged'
        WHERE admission_id = %s;
    """, (sa['admission_id'],))
    cur.execute("""
        UPDATE admissions
        SET discharge_status = 'Discharged'
        WHERE admission_id = %s;
    """, (sa['admission_id'],))

conn.commit()
print(f"Updated {updated_count} rows in dim_admission_inputs.")
print(f"Inserted {inserted_count} rows in dim_admission_inputs.")

# Verify final counts
cur.execute("SELECT discharge_status, COUNT(*) as c FROM dim_admission_inputs GROUP BY discharge_status;")
print("dim_admission_inputs status breakdown after sync:", cur.fetchall())

cur.execute("""
    SELECT COUNT(*) as c FROM dim_admission_inputs 
    WHERE discharge_status IN ('Admitted', 'Ready');
""")
print("Active Inpatients in dim_admission_inputs:", cur.fetchone()['c'])

cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Occupied';")
print("Occupied Beds in beds table:", cur.fetchone()['c'])

cur.close()
conn.close()
