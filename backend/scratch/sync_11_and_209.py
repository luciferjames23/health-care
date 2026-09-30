import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Check all 53 summaries in dim_generated_discharge_summaries
# We ensure the 11 summaries: 87223, 87224, 87225, 87226, 87227, 87228, 87229, 87230, 87231, 87232, 87239 are 'Approved'
# And the other 42 summaries are 'Pending Approval'
approved_summary_ids = (87223, 87224, 87225, 87226, 87227, 87228, 87229, 87230, 87231, 87232, 87239)

cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Approved'
    WHERE summary_id IN %s;
""", (approved_summary_ids,))

cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Pending Approval'
    WHERE summary_id NOT IN %s;
""", (approved_summary_ids,))

# 2. Check dim_admission_inputs:
# Ensure exactly 11 discharged records in dim_admission_inputs matching the discharged records
# The 11 discharged: 87501, 87502, 87503, 87504, 87505, 87506, 87507, 87508, 87224, 87229, 87239 (or 87240)
discharged_adm_ids = (87501, 87502, 87503, 87504, 87505, 87506, 87507, 87508, 87224, 87229, 87239)

cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Discharged'
    WHERE admission_id IN %s;
""", (discharged_adm_ids,))

# Ensure all 209 active admissions on occupied beds are 'Admitted' or 'Ready'
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Admitted'
    WHERE admission_id NOT IN %s AND discharge_status NOT IN ('Admitted', 'Ready');
""", (discharged_adm_ids,))

# 3. Verify counts
cur.execute("SELECT approval_status, COUNT(*) as c FROM dim_generated_discharge_summaries GROUP BY approval_status;")
print("dim_generated_discharge_summaries breakdown:", cur.fetchall())

cur.execute("SELECT discharge_status, COUNT(*) as c FROM dim_admission_inputs GROUP BY discharge_status;")
print("dim_admission_inputs breakdown:", cur.fetchall())

cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Occupied';")
print("Occupied Beds:", cur.fetchone()['c'])

cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Available';")
print("Available Beds:", cur.fetchone()['c'])

conn.commit()
cur.close()
conn.close()
