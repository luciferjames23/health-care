import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("SELECT COUNT(*) as c FROM dim_admission_inputs WHERE discharge_status = 'Discharged';")
print("Discharged in dim_admission_inputs:", cur.fetchone()['c'])

cur.execute("SELECT COUNT(*) as c FROM dim_admission_inputs WHERE discharge_status IN ('Admitted', 'Ready');")
print("Active IP in dim_admission_inputs:", cur.fetchone()['c'])

cur.execute("SELECT COUNT(*) as c FROM dim_generated_discharge_summaries WHERE LOWER(approval_status) IN ('approved', 'signed', 'signed off', 'completed');")
print("Approved in dim_generated_discharge_summaries:", cur.fetchone()['c'])

cur.execute("SELECT COUNT(*) as c FROM beds WHERE status = 'Occupied';")
print("Occupied Beds in DB:", cur.fetchone()['c'])

from routers.gold import get_executive_kpis, get_dim_admission_inputs, get_dim_generated_discharge_summaries

kpis = get_executive_kpis()
print("\nExecutive KPIs:")
print("  Active admissions:", kpis.get("active_admissions"))
print("  Discharged patients:", kpis.get("discharged_patients"))
print("  Total beds:", kpis.get("total_beds"))
print("  Occupied beds:", kpis.get("occupied_beds"))
print("  Available beds:", kpis.get("available_beds"))

adm = get_dim_admission_inputs(discharge_status="all")
adm_data = adm.get("data", [])
ip_adm = [r for r in adm_data if str(r.get("discharge_status", "")).strip().lower() != "discharged"]
dis_adm = [r for r in adm_data if str(r.get("discharge_status", "")).strip().lower() == "discharged"]
print("\nCurrent Admissions API:")
print("  Total:", len(adm_data))
print("  IP (Active):", len(ip_adm))
print("  Discharged:", len(dis_adm))

cur.close()
conn.close()
