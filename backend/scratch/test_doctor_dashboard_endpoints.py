import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.dashboard_routes import get_dashboard_summary, get_appointments, get_date_wise_analytics, get_daily_view, get_patients

def test_for_doctor(user_id, username, doctor_id, doc_name):
    print(f"\n==================================================")
    print(f"TESTING FOR DOCTOR: {doc_name} (User ID: {user_id}, Doctor ID: {doctor_id})")
    print(f"==================================================")
    
    current_user = {
        "user_id": user_id,
        "username": username,
        "role": "DOCTOR",
        "doctor_id": doctor_id
    }
    
    # 1. Summary for Sept 2026
    date_from = "2026-09-01"
    date_to = "2026-09-30"
    
    summary = get_dashboard_summary(
        date_from=date_from,
        date_to=date_to,
        doctor_id=None,
        current_user=current_user
    )
    print(f"\n[Summary Result] Date Range: {date_from} to {date_to}")
    print(f"  Total Appts: {summary['appointments']['total']}")
    print(f"  Confirmed:   {summary['appointments']['confirmed']}")
    print(f"  Completed:   {summary['appointments']['completed']}")
    print(f"  Booked:      {summary['appointments']['booked']}")
    print(f"  Cancelled:   {summary['appointments']['cancelled']}")
    print(f"  Patients:    {summary['patients']['total']} total, {summary['patients'].get('unique_in_range')} unique in range")

    # 2. Appointments
    appts_res = get_appointments(
        date_from=date_from,
        date_to=date_to,
        page=1,
        per_page=50,
        current_user=current_user
    )
    print(f"\n[Appointments Result]")
    print(f"  Total Appts Count: {appts_res['total']}")
    for a in appts_res['appointments']:
        print(f"    - [{a['appointment_date']} {a['appointment_time']}] ID: {a['id']}, Patient: {a['patient_name']}, Status: {a['status']}, Doctor: {a['doctor_name']}")

    # 3. My Patients
    patients_res = get_patients(
        page=1,
        per_page=50,
        current_user=current_user
    )
    print(f"\n[Patients Result]")
    print(f"  Total Doctor Patients: {patients_res['total']}")
    for p in patients_res['patients']:
        print(f"    - ID: {p['id']}, Code: {p['patient_code']}, Name: {p['first_name']} {p['last_name']}")

def main():
    test_for_doctor(1023, "MD", 1018, "Dr. Moorthy D")
    test_for_doctor(1008, "AK", 1005, "Dr. Arun Kumar")
    test_for_doctor(1009, "doc2", 1006, "Dr. Priya Ramesh")
    test_for_doctor(1012, "JR", 1009, "Dr. James R")
    test_for_doctor(1013, "wilson", 1010, "Dr. Wilson M")

if __name__ == '__main__':
    main()
