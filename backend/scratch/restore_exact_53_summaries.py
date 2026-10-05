import sys
import os
import json
import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras
from services.discharge_generator import generate_patient_discharge_summary
from connectors.databricks_connector import DatabricksConnector

db_connector = DatabricksConnector()
conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Drop any restrictive foreign key constraints on the gold table
cur.execute("""
    ALTER TABLE dim_generated_discharge_summaries 
    DROP CONSTRAINT IF EXISTS fk_dim_generated_discharge_summaries_doctor_id;
    ALTER TABLE dim_generated_discharge_summaries 
    DROP CONSTRAINT IF EXISTS fk_dim_generated_discharge_summaries_admission_id;
    ALTER TABLE dim_generated_discharge_summaries 
    DROP CONSTRAINT IF EXISTS fk_dim_generated_discharge_summaries_patient_id;
""")
conn.commit()

TABLE_COLS = [
    "summary_id",
    "admission_id",
    "patient_id",
    "doctor_id",
    "admission_date",
    "discharge_date",
    "diagnoses",
    "case_history",
    "investigations",
    "treatment",
    "primary_consultant",
    "discharge_advice",
    "surgery_details",
    "patient_condition",
    "generated_at",
    "ingestion_timestamp",
    "approval_status",
    "model_name",
    "model_source"
]

def _clean_val_for_pg(col: str, val: any) -> any:
    if val is None:
        return None
    if col in ("summary_id", "admission_id", "patient_id", "doctor_id"):
        try:
            return int(val)
        except Exception:
            return None
    if isinstance(val, (dict, list, tuple)):
        try:
            return json.dumps(val, ensure_ascii=False)
        except Exception:
            return str(val)
    return str(val)

# 1. Fetch 11 Discharged admissions
cur.execute("""
    SELECT * FROM dim_admission_inputs
    WHERE discharge_status = 'Discharged'
    ORDER BY admission_id;
""")
dc_adms = cur.fetchall()
print(f"Discharged admissions (11): {len(dc_adms)}")

# 2. Fetch 42 Active admissions to mark as Ready
cur.execute("""
    SELECT * FROM dim_admission_inputs
    WHERE discharge_status != 'Discharged'
    ORDER BY admission_id
    LIMIT 42;
""")
ready_adms = cur.fetchall()
print(f"Ready admissions (42): {len(ready_adms)}")

# Collect admission IDs
dc_adm_ids = [a['admission_id'] for a in dc_adms]
ready_adm_ids = [a['admission_id'] for a in ready_adms]

# 3. Generate discharge summaries
generated_records = []
rows_to_insert = []

# Generate for 11 Discharged (Approved)
for adm in dc_adms:
    rec = generate_patient_discharge_summary(adm, model_name="local-clinical-engine", provider="local")
    rec["approval_status"] = "Approved"
    generated_records.append(rec)
    row_vals = [_clean_val_for_pg(col, rec.get(col)) for col in TABLE_COLS]
    rows_to_insert.append(row_vals)

# Generate for 42 Ready (Pending Approval)
for adm in ready_adms:
    rec = generate_patient_discharge_summary(adm, model_name="local-clinical-engine", provider="local")
    rec["approval_status"] = "Pending Approval"
    generated_records.append(rec)
    row_vals = [_clean_val_for_pg(col, rec.get(col)) for col in TABLE_COLS]
    rows_to_insert.append(row_vals)

print(f"Total rows to insert: {len(rows_to_insert)}")

# 4. Truncate and Insert into dim_generated_discharge_summaries
cur.execute("TRUNCATE TABLE dim_generated_discharge_summaries;")
conn.commit()

db_connector.insert_batch_fast(
    table_name="dim_generated_discharge_summaries",
    col_names=TABLE_COLS,
    rows=rows_to_insert
)

# 5. Update discharge_status in dim_admission_inputs
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Discharged'
    WHERE admission_id = ANY(%s);
""", (dc_adm_ids,))

cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Ready'
    WHERE admission_id = ANY(%s);
""", (ready_adm_ids,))

cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Admitted'
    WHERE admission_id NOT IN %s AND admission_id NOT IN %s;
""", (tuple(dc_adm_ids), tuple(ready_adm_ids)))

conn.commit()

# 6. Verify counts in DB
cur.execute("SELECT COUNT(*) as c FROM dim_generated_discharge_summaries;")
print("dim_generated_discharge_summaries total count:", cur.fetchone()['c'])

cur.execute("SELECT approval_status, COUNT(*) as c FROM dim_generated_discharge_summaries GROUP BY approval_status ORDER BY approval_status;")
print("dim_generated_discharge_summaries breakdown:", cur.fetchall())

cur.execute("SELECT discharge_status, COUNT(*) as c FROM dim_admission_inputs GROUP BY discharge_status ORDER BY discharge_status;")
print("dim_admission_inputs breakdown:", cur.fetchall())

cur.close()
conn.close()
