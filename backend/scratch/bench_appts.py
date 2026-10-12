import os
import sys
import time

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.dashboard_routes import get_appointments

# Warm up pool
conn = db_config.get_db_connection()
conn.close()

admin_user = {"user_id": 1007, "username": "admin", "role": "ADMIN", "full_name": "System Admin"}

t0 = time.time()
res = get_appointments(
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
t1 = time.time()
print(f"get_appointments execution time: {t1 - t0:.3f}s. Total: {res['total']}")
