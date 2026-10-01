import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries, get_executive_kpis

# 1. Executive KPIs
exec_kpis = get_executive_kpis()
print("Executive KPIs:")
print("  Active admissions:", exec_kpis.get("active_admissions"))
print("  Discharged patients:", exec_kpis.get("discharged_patients"))
print("  Total beds:", exec_kpis.get("total_beds"))
print("  Occupied beds:", exec_kpis.get("occupied_beds"))
print("  Available beds:", exec_kpis.get("available_beds"))

# 2. Current Admissions API
adm_res = get_dim_admission_inputs(discharge_status="all")
adm_data = adm_res.get("data", [])
ip_adm = [r for r in adm_data if str(r.get("discharge_status", "")).strip().lower() != "discharged"]
dis_adm = [r for r in adm_data if str(r.get("discharge_status", "")).strip().lower() == "discharged"]
print("\nCurrent Admissions API (discharge_status='all'):")
print("  Total:", len(adm_data))
print("  IP (Active):", len(ip_adm))
print("  Discharged:", len(dis_adm))

# 3. Discharge Summaries API
dis_res = get_dim_generated_discharge_summaries()
dis_data = dis_res.get("data", [])
approved_dis = [r for r in dis_data if str(r.get("approval_status", "")).strip().lower() in ("approved", "signed", "signed off", "completed")]
pending_dis = [r for r in dis_data if str(r.get("approval_status", "")).strip().lower() not in ("approved", "signed", "signed off", "completed")]
print("\nDischarge Summaries API:")
print("  Total summaries:", len(dis_data))
print("  Approved summaries (Discharged):", len(approved_dis))
print("  Pending Approval summaries (Ready / IP):", len(pending_dis))

assert exec_kpis.get("active_admissions") == len(ip_adm) == 209, f"Active mismatch: {exec_kpis.get('active_admissions')} vs {len(ip_adm)}"
assert exec_kpis.get("discharged_patients") == len(dis_adm) == len(approved_dis) == 11, f"Discharged mismatch: {exec_kpis.get('discharged_patients')} vs {len(dis_adm)} vs {len(approved_dis)}"
assert len(dis_data) == 53, f"Summaries total mismatch: {len(dis_data)}"
assert len(pending_dis) == 42, f"Pending mismatch: {len(pending_dis)}"

print("\n>>> ALL CHECKS PASSED: Exactly 209 Active IP and 11 Discharged across all tables and APIs! <<<")
