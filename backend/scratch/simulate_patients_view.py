import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries, get_executive_kpis

# Simulate frontend logic
adm_res = get_dim_admission_inputs(discharge_status="all")
dis_res = get_dim_generated_discharge_summaries()

raw_admissions = adm_res.get("data", [])
raw_discharges = dis_res.get("data", [])

actual_admitted = []
parsed_discharged = []

for r in raw_admissions:
    st = str(r.get("discharge_status") or "").strip().lower()
    if st == "discharged":
        parsed_discharged.append(r)
    else:
        actual_admitted.append(r)

print(f"Total admissions returned: {len(raw_admissions)}")
print(f"IP (Active Inpatients): {len(actual_admitted)}")
print(f"Discharged from admissions: {len(parsed_discharged)}")

exec_kpis = get_executive_kpis()
print(f"Executive Dashboard Occupied Beds (Active Admissions): {exec_kpis.get('active_admissions')}")

assert len(actual_admitted) == exec_kpis.get("active_admissions") == 209, f"Mismatch: {len(actual_admitted)} vs {exec_kpis.get('active_admissions')}"
print("VERIFICATION SUCCESS: IP count is exactly 209 matching Executive Dashboard 209!")
