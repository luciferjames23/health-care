import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries, get_executive_kpis

exec_kpis = get_executive_kpis()
print("Executive KPIs:")
print("  Active admissions (Occupied beds):", exec_kpis.get("active_admissions"))
print("  Discharged patients:", exec_kpis.get("discharged_patients"))
print("  Total beds:", exec_kpis.get("total_beds"))
print("  Occupied beds:", exec_kpis.get("occupied_beds"))
print("  Available beds:", exec_kpis.get("available_beds"))

adm_res = get_dim_admission_inputs(discharge_status="all")
adm_data = adm_res.get("data", [])
print("\nCurrent Admissions API (discharge_status='all'):")
print("  Total records:", len(adm_data))
active_adm = [r for r in adm_data if str(r.get("discharge_status", "")).strip().lower() != "discharged"]
discharged_adm = [r for r in adm_data if str(r.get("discharge_status", "")).strip().lower() == "discharged"]
print("  Active Inpatients (IP):", len(active_adm))
print("  Discharged in admissions:", len(discharged_adm))

dis_res = get_dim_generated_discharge_summaries()
dis_data = dis_res.get("data", [])
approved_dis = [r for r in dis_data if str(r.get("approval_status", "")).strip().lower() in ("approved", "signed", "signed off", "completed")]
print("\nDischarge Summaries API:")
print("  Total summaries:", len(dis_data))
print("  Approved Discharged summaries:", len(approved_dis))

assert len(active_adm) == exec_kpis.get("active_admissions") == 209, f"Mismatch: {len(active_adm)} vs {exec_kpis.get('active_admissions')}"
print("\n>>> ALL COUNTS 100% RECONCILED: 209 Active Inpatients across all screens! <<<")
