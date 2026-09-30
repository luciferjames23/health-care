import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.gold import get_dim_admission_inputs
from db_config import get_db_connection
import psycopg2.extras

conn = get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT COUNT(*) as dim_cnt FROM dim_admission_inputs;")
print("dim_admission_inputs count in DB:", cur.fetchone())

cur.execute("SELECT COUNT(DISTINCT admission_id) as distinct_adm, COUNT(DISTINCT patient_id) as distinct_pat FROM dim_admission_inputs;")
print("dim_admission_inputs distinct counts:", cur.fetchone())

# Check if there is any duplicate admission_id or patient_id
cur.execute("""
    SELECT admission_id, patient_id, COUNT(*) 
    FROM dim_admission_inputs 
    GROUP BY admission_id, patient_id 
    HAVING COUNT(*) > 1;
""")
print("Duplicates in dim_admission_inputs:", cur.fetchall())

# Now check what get_dim_admission_inputs returns
res = get_dim_admission_inputs(discharge_status='all')
data = res.get('data', [])
print(f"get_dim_admission_inputs(discharge_status='all') returned: {len(data)}")

# Let's inspect where the extra record came from in get_dim_admission_inputs
# Let's see how get_dim_admission_inputs merges dim_admission_inputs with live admissions
