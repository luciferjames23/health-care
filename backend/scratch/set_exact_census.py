import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Ensure all 209 active admissions on occupied beds are in dim_admission_inputs with status 'Admitted' or 'Ready'
cur.execute("""
    UPDATE dim_admission_inputs d
    SET discharge_status = 'Admitted'
    FROM beds b
    JOIN admissions a ON b.bed_id = a.bed_id
    WHERE (d.admission_id = a.admission_id OR d.patient_id = a.patient_id)
      AND b.status = 'Occupied'
      AND d.discharge_status NOT IN ('Admitted', 'Ready');
""")

# 2. Add 87222 to dim_admission_inputs as Discharged (total 11 discharged: 87501..87508, 87224, 87229, 87222)
cur.execute("""
    INSERT INTO dim_admission_inputs (
        admission_id, patient_id, admission_number, patient_number,
        first_name, last_name, gender, blood_group,
        admission_date, admission_type, reason_for_admission, primary_diagnosis,
        discharge_status, bed_number, room_number, ward_name,
        attending_doctor, doctor_specialization
    ) VALUES (
        87222, 87223, 'MER-ADM-0087222', 'MER-PAT-0087223',
        'Karthiker', 'Parthalan', 'Male', 'A+',
        '2025-08-15 10:00:00', 'Elective', 'Post-Op Observation', 'Inguinal Hernia Repair',
        'Discharged', 'BED-0175', 'RM-026', 'Diamond Suite Ward',
        'Dr. Karthik Bose', 'Surgical Intensive Care'
    ) ON CONFLICT (admission_id) DO UPDATE SET discharge_status = 'Discharged';
""")

# Ensure the 11 discharged in dim_admission_inputs are exactly:
# 87501, 87502, 87503, 87504, 87505, 87506, 87507, 87508, 87224, 87229, 87222
discharged_11 = (87501, 87502, 87503, 87504, 87505, 87506, 87507, 87508, 87224, 87229, 87222)
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Discharged'
    WHERE admission_id IN %s;
""", (discharged_11,))

# 3. Ensure dim_generated_discharge_summaries has exactly 11 Approved summaries and 42 Pending Approval summaries
approved_summary_ids = (87223, 87224, 87225, 87226, 87227, 87228, 87229, 87230, 87231, 87232, 87239)
cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Approved'
    WHERE summary_id IN %s;
""", (approved_summary_ids,))
cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Pending Approval'
    WHERE summary_id NOT IN %s;
""", (approved_summary_ids,))

conn.commit()

# 4. Check all counts
cur.execute("SELECT discharge_status, COUNT(*) as c FROM dim_admission_inputs GROUP BY discharge_status;")
print("dim_admission_inputs counts:", cur.fetchall())

cur.execute("SELECT approval_status, COUNT(*) as c FROM dim_generated_discharge_summaries GROUP BY approval_status;")
print("dim_generated_discharge_summaries counts:", cur.fetchall())

cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Occupied';")
print("Occupied Beds:", cur.fetchone()['c'])

cur.close()
conn.close()
