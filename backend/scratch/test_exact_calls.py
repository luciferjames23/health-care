import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.dashboard_routes import get_appointments
from api.auth_helper import encode_token

def test_exact_calls():
    # 1. Admin call with exact parameters sent by frontend
    admin_user = {
        "user_id": 1007,
        "username": "admin",
        "role": "ADMIN",
        "full_name": "System Admin"
    }
    
    print("--- Call 1: Admin initial load (no filters) ---")
    res1 = get_appointments(
        search=None,
        status=None,
        department=None,
        doctor_id=None,
        booking_source=None,
        date_from=None,
        date_to=None,
        date_type='appointment_date',
        sort_by='appointment_date',
        sort_order='desc',
        page=1,
        per_page=25,
        current_user=admin_user
    )
    print("Result 1: Total =", res1["total"], "Returned =", len(res1["appointments"]))
    
    # 2. Doctor call for Doctor 1 (Dr. Priya Patel)
    doc1_user = {
        "user_id": 1,
        "username": "doctor_1",
        "role": "DOCTOR",
        "doctor_id": 1,
        "full_name": "Dr. Priya Patel"
    }
    print("\n--- Call 2: Doctor 1 initial load (no filters) ---")
    res2 = get_appointments(
        search=None,
        status=None,
        department=None,
        doctor_id=1,
        booking_source=None,
        date_from=None,
        date_to=None,
        date_type='appointment_date',
        sort_by='appointment_date',
        sort_order='desc',
        page=1,
        per_page=25,
        current_user=doc1_user
    )
    print("Result 2: Total =", res2["total"], "Returned =", len(res2["appointments"]))
    
    # 3. What if doctor_id is NOT passed in query params for Doctor 1?
    print("\n--- Call 3: Doctor 1 without doctor_id param ---")
    res3 = get_appointments(
        search=None,
        status=None,
        department=None,
        doctor_id=None,
        booking_source=None,
        date_from=None,
        date_to=None,
        date_type='appointment_date',
        sort_by='appointment_date',
        sort_order='desc',
        page=1,
        per_page=25,
        current_user=doc1_user
    )
    print("Result 3: Total =", res3["total"], "Returned =", len(res3["appointments"]))

    # 4. What if doctor token only has user_id, NO doctor_id?
    doc_no_docid_user = {
        "user_id": 1,
        "username": "doctor_1",
        "role": "DOCTOR",
        "full_name": "Dr. Priya Patel"
    }
    print("\n--- Call 4: Doctor token missing doctor_id ---")
    res4 = get_appointments(
        search=None,
        status=None,
        department=None,
        doctor_id=None,
        booking_source=None,
        date_from=None,
        date_to=None,
        date_type='appointment_date',
        sort_by='appointment_date',
        sort_order='desc',
        page=1,
        per_page=25,
        current_user=doc_no_docid_user
    )
    print("Result 4: Total =", res4["total"], "Returned =", len(res4["appointments"]))

    # 5. What if user has role "Hospital Management" instead of "ADMIN"?
    hm_user = {
        "user_id": 1007,
        "username": "admin",
        "role": "HOSPITAL MANAGEMENT",
        "full_name": "Hospital Administrator"
    }
    print("\n--- Call 5: Role 'HOSPITAL MANAGEMENT' ---")
    res5 = get_appointments(
        search=None,
        status=None,
        department=None,
        doctor_id=None,
        booking_source=None,
        date_from=None,
        date_to=None,
        date_type='appointment_date',
        sort_by='appointment_date',
        sort_order='desc',
        page=1,
        per_page=25,
        current_user=hm_user
    )
    print("Result 5: Total =", res5["total"], "Returned =", len(res5["appointments"]))

if __name__ == '__main__':
    test_exact_calls()
