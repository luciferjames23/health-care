import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import get_db_connection
from connectors.databricks_connector import DatabricksConnector

conn = get_db_connection()
cur = conn.cursor()

# 1. Reset all admissions in dim_admission_inputs to 'Admitted' first
cur.execute("UPDATE dim_admission_inputs SET discharge_status = 'Admitted';")
print("Reset all to Admitted.")

# 2. Pick top 10 patient_ids to be Discharged / Completed
cur.execute("""
    SELECT admission_id, patient_id 
    FROM dim_admission_inputs 
    ORDER BY admission_id ASC 
    LIMIT 10;
""")
completed_10 = cur.fetchall()
completed_aids = [r[0] for r in completed_10]
completed_pids = [r[1] for r in completed_10]

cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Discharged',
        bill_status = 'Paid',
        bill_clearance_status = 'Cleared',
        outstanding_balance = 0.00
    WHERE admission_id = ANY(%s);
""", (completed_aids,))
print("Set 10 Completed in dim_admission_inputs.")

# Set 10 Approved in dim_generated_discharge_summaries
cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Approved'
    WHERE admission_id = ANY(%s) OR patient_id = ANY(%s);
""", (completed_aids, completed_pids))

# 3. Pick next 39 patient_ids to be Ready
cur.execute("""
    SELECT admission_id, patient_id 
    FROM dim_admission_inputs 
    WHERE discharge_status = 'Admitted'
    ORDER BY admission_id ASC 
    LIMIT 39;
""")
ready_39 = cur.fetchall()
ready_aids = [r[0] for r in ready_39]
ready_pids = [r[1] for r in ready_39]

cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Ready',
        bill_status = 'Paid',
        bill_clearance_status = 'Cleared',
        outstanding_balance = 0.00
    WHERE admission_id = ANY(%s);
""", (ready_aids,))
print("Set 39 Ready in dim_admission_inputs.")

# Set summaries for non-completed to Pending Approval
cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Pending Approval'
    WHERE admission_id NOT IN (SELECT admission_id FROM dim_admission_inputs WHERE discharge_status = 'Discharged');
""")

conn.commit()

# Verify counts
cur.execute("SELECT discharge_status, COUNT(*) FROM dim_admission_inputs GROUP BY discharge_status ORDER BY COUNT(*) DESC;")
print("dim_admission_inputs:", cur.fetchall())

cur.execute("SELECT approval_status, COUNT(*) FROM dim_generated_discharge_summaries GROUP BY approval_status;")
print("summaries approval:", cur.fetchall())

DatabricksConnector.clear_cache()
print("Cache cleared.")

conn.close()
