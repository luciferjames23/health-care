import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from db.postgres_connector import PostgresConnector

db = PostgresConnector()
conn = db.get_connection()
cur = db.get_dict_cursor(conn)

# Find discharge summaries that link to dim_admission_inputs
cur.execute("""
    SELECT ds.*
    FROM discharge_summaries ds
    JOIN dim_admission_inputs d ON (ds.admission_id = d.admission_id OR ds.patient_id = d.patient_id)
    ORDER BY ds.summary_id;
""")
matched_summaries = cur.fetchall()
print(f"Total discharge_summaries matching dim_admission_inputs: {len(matched_summaries)}")

# Also check discharge summaries by summary_id between 87200 and 87300
cur.execute("""
    SELECT summary_id, admission_id, patient_id, primary_consultant, discharge_date
    FROM discharge_summaries
    WHERE summary_id >= 87220 AND summary_id <= 87275
    ORDER BY summary_id;
""")
range_sums = cur.fetchall()
print(f"Total in 87220..87275 range: {len(range_sums)}")
for s in range_sums[:15]:
    print(" ", s)

conn.close()
