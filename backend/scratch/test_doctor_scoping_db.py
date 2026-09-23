import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")

import db_config
from api.dashboard_routes import get_appointments, get_patients

print("=== TESTING DOCTOR PORTAL DATA SCOPING ===")

conn = db_config.get_db_connection()
cur = conn.cursor()
try:
    # 1. Get Dr. Immanuvel S doctor record (id 1015)
    cur.execute("SELECT id, display_name, department_id FROM doctors WHERE id = 1015;")
    doc_immanuvel = cur.fetchone()
    print("Doctor Immanuvel Record:", doc_immanuvel)

    # 2. Get Dr. Priya Ramesh doctor record (id 1006)
    cur.execute("SELECT id, display_name, department_id FROM doctors WHERE id = 1006;")
    doc_priya = cur.fetchone()
    print("Doctor Priya Record:", doc_priya)

    # 3. Test get_appointments with current_user as Dr. Immanuvel (role=DOCTOR, doctor_id=1015)
    user_immanuvel = {"id": 2, "role": "DOCTOR", "doctor_id": 1015, "email": "immanuvel@meridian.com", "username": "dr.immanuvel"}
    appts_immanuvel = get_appointments(page=1, per_page=20, current_user=user_immanuvel)
    print(f"\nDr. Immanuvel Total Appointments Returned: {appts_immanuvel.get('total')}")
    all_immanuvel = all(a.get("doctor_id") == 1015 for a in appts_immanuvel.get("appointments", []))
    print(f"Are 100% of returned appointments for Dr. Immanuvel (id=1015)? -> {all_immanuvel}")

    # 4. Test get_appointments with current_user as Dr. Priya (role=DOCTOR, doctor_id=1006)
    user_priya = {"id": 3, "role": "DOCTOR", "doctor_id": 1006, "email": "priya@meridian.com", "username": "dr.priya"}
    appts_priya = get_appointments(page=1, per_page=20, current_user=user_priya)
    print(f"\nDr. Priya Total Appointments Returned: {appts_priya.get('total')}")
    all_priya = all(a.get("doctor_id") == 1006 for a in appts_priya.get("appointments", []))
    print(f"Are 100% of returned appointments for Dr. Priya (id=1006)? -> {all_priya}")

    # 5. Test get_patients with current_user as Dr. Immanuvel (role=DOCTOR, doctor_id=1015)
    patients_immanuvel = get_patients(page=1, per_page=20, current_user=user_immanuvel)
    print(f"\nDr. Immanuvel Total Patients Returned: {patients_immanuvel.get('total')}")

    # 6. Test get_patients with current_user as Admin (role=ADMIN)
    user_admin = {"id": 1, "role": "ADMIN", "email": "admin@meridian.com", "username": "admin"}
    appts_admin = get_appointments(page=1, per_page=20, current_user=user_admin)
    print(f"\nAdmin Total Appointments Returned (all doctors): {appts_admin.get('total')}")

finally:
    cur.close()
    conn.close()

print("\n=== DOCTOR PORTAL DATA SCOPING TEST PASSED ===")
