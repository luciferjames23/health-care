import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.dashboard_routes import get_appointments

admin_user = {"user_id": 1007, "username": "admin", "role": "ADMIN", "full_name": "System Admin"}

res = get_appointments(
    search=None,
    status=None,
    department="Cardiology",
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
print("Department 'Cardiology' appointments:", res["total"])
print("Sample appointment department:", res["appointments"][0]["department_name"])
