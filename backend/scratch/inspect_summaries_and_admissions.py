import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT s.*, p.first_name, p.last_name, p.patient_code, p.gender, p.date_of_birth, p.blood_group
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    ORDER BY s.summary_id;
""")
rawSummaries = cur.fetchall()

cur.execute("""
    SELECT a.*
    FROM dim_admission_inputs a
    ORDER BY a.admission_id;
""")
rawAdmissions = cur.fetchall()

print(f"Total rawSummaries: {len(rawSummaries)}")
print(f"Total rawAdmissions: {len(rawAdmissions)}")

# Let's inspect the 53 summaries in rawSummaries:
print("\n--- Summary details (approval_status and admission_id) ---")
for s in rawSummaries:
    print(f"summary_id: {s['summary_id']}, patient_id: {s['patient_id']}, admission_id: {s['admission_id']}, approval_status: {s['approval_status']}")

cur.close()
conn.close()
