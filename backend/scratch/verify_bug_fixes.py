import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from db_config import get_db_connection
from preadmission_service import dispatch_pre_admission_notification, create_pre_admission

conn = get_db_connection()
cur = conn.cursor()

print("=== VERIFICATION REPORT ===")

# 1. False positive SENT notifications count
cur.execute("""
    SELECT count(*) FROM notifications 
    WHERE channel = 'WHATSAPP' AND status = 'SENT' AND external_message_id LIKE 'wam.mock_%';
""")
false_sent_count = cur.fetchone()[0]
print(f"1. Total Historic False-Positive 'SENT' Notifications: {false_sent_count}")

# 2. Patient Vijay (PAD0107) details
cur.execute("""
    SELECT pa.id, pa.pre_admission_code, p.id, p.first_name, p.last_name, p.phone, p.whatsapp_number, pa.status, pa.remarks
    FROM pre_admissions pa
    JOIN patients p ON pa.patient_id = p.id
    WHERE pa.pre_admission_code = 'PAD0107';
""")
vijay_row = cur.fetchone()
print(f"2. Patient Vijay (PAD0107) record: {vijay_row}")

if vijay_row:
    pa_id = vijay_row[0]
    # Test dispatch to Vijay
    vijay_res = dispatch_pre_admission_notification(pa_id)
    print(f"   Dispatch attempt for Vijay (PAD0107): {vijay_res}")

# 3. Test Malformed Number Validation
cur.execute("SELECT id FROM patients WHERE length(regexp_replace(coalesce(phone, whatsapp_number, ''), '\\D', '', 'g')) < 10 LIMIT 1;")
bad_pat = cur.fetchone()

if not bad_pat:
    cur.execute("""
        INSERT INTO patients (patient_code, first_name, last_name, phone, whatsapp_number, date_of_birth, gender, status)
        VALUES ('P99999', 'Test', 'MalformedNum', '12345', '12345', '1990-01-01', 'MALE', 'ACTIVE')
        RETURNING id;
    """)
    bad_pat_id = cur.fetchone()[0]
    conn.commit()
else:
    bad_pat_id = bad_pat[0]

cur.execute("SELECT id FROM doctors LIMIT 1;")
doc_id = cur.fetchone()[0]
cur.execute("SELECT department_id FROM doctors WHERE id = %s;", (doc_id,))
dept_id = cur.fetchone()[0]

malformed_create_res = create_pre_admission(
    patient_id=bad_pat_id,
    doctor_id=doc_id,
    department_id=dept_id,
    expected_admission_date="2026-10-05",
    admission_type="INPATIENT",
    expected_checkin_time="09:00",
    instructions="Test malformed phone handling",
    remarks="Testing malformed number validation",
    pending_documents="ID Card"
)
print(f"3. Malformed Phone Number Pre-Admission Result: {malformed_create_res}")

cur.close()
conn.close()
