import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.dashboard_routes import (
    get_dashboard_summary,
    get_appointments,
    get_patients,
    get_daily_view,
    get_date_wise_analytics,
    resolve_target_doctor_id
)

def run_tests():
    print("======================================================================")
    print("RUNNING DOCTOR PORTAL VERIFICATION SUITE (KEY DOCTORS)")
    print("======================================================================")

    conn = db_config.get_db_connection()
    cur = conn.cursor()

    # Query key doctors with appointments or active user accounts
    cur.execute("""
        SELECT u.id as user_id, u.username, d.id as doctor_id, d.display_name, dept.department_name
        FROM doctors d
        JOIN users u ON d.user_id = u.id
        LEFT JOIN departments dept ON d.department_id = dept.id
        WHERE u.is_active = true AND (d.id IN (1018, 1005, 1006, 1009, 1010, 1011, 1014, 1015, 1016, 1017, 1026, 1, 2, 3, 4, 5))
        ORDER BY d.id;
    """)
    doctors = cur.fetchall()
    print(f"\n[TESTING {len(doctors)} KEY DOCTOR ACCOUNTS IN DATABASE]\n")

    passed_count = 0

    for user_id, username, doctor_id, display_name, dept_name in doctors:
        current_user = {
            "user_id": user_id,
            "username": username,
            "role": "DOCTOR",
            "doctor_id": doctor_id,
            "full_name": display_name
        }

        date_from = "2026-09-01"
        date_to = "2026-09-30"

        # 1. Summary
        summary = get_dashboard_summary(
            date_from=date_from,
            date_to=date_to,
            doctor_id=None,
            current_user=current_user
        )

        # 2. Appointments
        appts_res = get_appointments(
            date_from=date_from,
            date_to=date_to,
            page=1,
            per_page=50,
            current_user=current_user
        )

        # 3. Patients
        patients_res = get_patients(
            page=1,
            per_page=50,
            current_user=current_user
        )

        # 4. Daily view
        daily_res = get_daily_view(
            date_val="2026-09-25",
            current_user=current_user
        )

        # Verify Data Scoping Integrity:
        for appt in appts_res.get("appointments", []):
            assert appt["doctor_id"] == doctor_id, f"SECURITY VIOLATION: Appointment {appt['id']} belongs to doctor {appt['doctor_id']}, expected {doctor_id}"

        # Verify Security Isolation:
        override_attempt = resolve_target_doctor_id(current_user, requested_doctor_id=9999, cur=cur)
        assert override_attempt == doctor_id, f"SECURITY FAILURE: Doctor was able to override doctor_id to {override_attempt}"

        disp = display_name if display_name else f"Doctor #{doctor_id}"
        print(f"[PASS] Doctor: {disp:<24} | ID: {doctor_id:<4} | Appts: {summary['appointments']['total']:<3} (Confirmed: {summary['appointments']['confirmed']}, Completed: {summary['appointments']['completed']}) | Patients: {patients_res['total']:<3}")
        passed_count += 1

    print(f"\n======================================================================")
    print(f"VERIFICATION SUMMARY: {passed_count} / {len(doctors)} DOCTORS VERIFIED CLEANLY")
    print(f"======================================================================")

    cur.close()
    conn.close()

if __name__ == '__main__':
    run_tests()
