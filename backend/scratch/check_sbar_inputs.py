import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from api.dashboard_routes import get_conn

conn = get_conn()
cur = conn.cursor()

cur.execute("""
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN discharge_status != 'Discharged' THEN 1 END) as active_inpatients
    FROM dim_admission_inputs;
""")
print('Admission counts:', cur.fetchone())

cur.execute("""
    SELECT 
        admission_id, patient_number, first_name, last_name, gender, age_at_admission,
        ward_name, bed_number, primary_diagnosis, attending_doctor,
        latest_systolic_bp, latest_heart_rate, latest_oxygen_saturation, latest_temperature
    FROM dim_admission_inputs
    WHERE discharge_status != 'Discharged'
    ORDER BY admission_id ASC
    LIMIT 5;
""")
for r in cur.fetchall():
    print(r)

cur.close()
conn.close()
