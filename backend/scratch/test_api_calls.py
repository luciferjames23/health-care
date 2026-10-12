import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.dashboard_routes import get_appointments

def test_api():
    # Test Admin call (no filters)
    admin_user = {"user_id": 1, "username": "admin", "role": "ADMIN", "full_name": "Hospital Administrator"}
    try:
        res_admin = get_appointments(
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
        print("Admin get_appointments without date range:")
        print("  Total:", res_admin.get("total"))
        print("  Returned:", len(res_admin.get("appointments", [])))
        if res_admin.get("appointments"):
            print("  First appt:", res_admin["appointments"][0])
    except Exception as e:
        import traceback
        traceback.print_exc()

    # What does the frontend Admin send?
    # Let's check AppointmentManagement.tsx default state!
if __name__ == '__main__':
    test_api()
