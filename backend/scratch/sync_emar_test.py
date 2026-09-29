import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from db_config import get_db_connection
import psycopg2.extras
import random

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Fetch all admitted patients
cur.execute("""
    SELECT 
        adm.admission_id,
        adm.patient_number,
        adm.first_name,
        adm.last_name,
        adm.ward_name,
        adm.bed_number,
        adm.attending_doctor,
        pat.id as patient_id
    FROM dim_admission_inputs adm
    JOIN patients pat ON adm.patient_number = pat.patient_code
    WHERE adm.discharge_status != 'Discharged'
    ORDER BY adm.admission_id ASC;
""")
admitted = cur.fetchall()
print(f"Total admitted patients: {len(admitted)}")

# 2. For each patient, fetch their actual prescriptions
new_emar_rows = []
nurses = [
    "Staff Nurse Anitha Kumar, RN",
    "Staff Nurse Sneha Rao, RN",
    "Staff Nurse Divya Kumar, RN",
    "Staff Nurse Rajesh Nair, RN",
    "Staff Nurse Pooja Sharma, RN",
    "Staff Nurse Kavitha Sundaram, RN",
    "Staff Nurse Priya Mohan, RN",
    "Staff Nurse Deepa Krishnan, RN"
]

times = ["08:00 AM", "09:00 AM", "10:00 AM", "12:00 PM", "02:00 PM", "04:00 PM", "06:00 PM", "08:00 PM", "10:00 PM"]

for p in admitted:
    pid = p['patient_id']
    full_name = f"{p['first_name']} {p['last_name']}".strip()
    bed_no = p['bed_number'] or 'BED-0193'
    doc_name = p['attending_doctor'] or 'Dr. Amit Sharma'
    
    cur.execute("""
        SELECT 
            p.prescription_id, p.prescription_date, p.status,
            pi.dosage, pi.frequency, pi.route, pi.duration, pi.quantity, pi.instructions,
            m.medication_name, m.generic_name, m.dosage_form, m.strength, m.is_high_alert
        FROM prescriptions p
        JOIN prescription_items pi ON p.prescription_id = pi.prescription_id
        JOIN medications m ON pi.medication_id = m.medication_id
        WHERE p.patient_id = %s
        ORDER BY p.prescription_id DESC
    """, (pid,))
    rxs = cur.fetchall()
    
    if not rxs:
        continue
        
    for i, rx in enumerate(rxs):
        med_name = rx['medication_name']
        dose_route = f"{rx['dosage']} {rx['route']} {rx['frequency']}"
        is_high_alert = bool(rx['is_high_alert'])
        rx_status = (rx['status'] or 'Prescribed').lower()
        
        # Determine status and stage
        sched_time = times[(p['admission_id'] + i * 3) % len(times)]
        nurse = nurses[(p['admission_id'] + i) % len(nurses)]
        
        if rx_status == 'dispensed':
            status = 'Given'
            stage = 'Completed'
            admin_by = nurse
            signed_at = sched_time
            is_overdue = False
        elif rx_status == 'verified':
            status = 'Scheduled'
            stage = 'Scheduled'
            admin_by = None
            signed_at = None
            is_overdue = False
        else: # prescribed / pending
            status = 'Scheduled'
            stage = 'Awaiting pharmacy'
            admin_by = None
            signed_at = None
            is_overdue = False
            
        new_emar_rows.append({
            'scheduled_time': sched_time,
            'patient_name': full_name,
            'bed_no': bed_no,
            'medication_name': med_name,
            'dosage_route': dose_route,
            'status': status,
            'administered_by': admin_by,
            'signed_at': signed_at,
            'stage': stage,
            'is_high_alert': is_high_alert,
            'is_overdue': is_overdue,
            'prescribed_by': doc_name,
            'verification_status': 'Verified' if rx_status in ('verified', 'dispensed') else 'Pending Verification'
        })

print(f"Generated {len(new_emar_rows)} eMAR entries matching patient prescriptions perfectly.")
# Print Christoer Parthalan sample
christoer_entries = [e for e in new_emar_rows if 'christoer' in e['patient_name'].lower()]
print("\nChristoer Parthalan eMAR entries:")
for c in christoer_entries:
    print(" ", c)

conn.close()
