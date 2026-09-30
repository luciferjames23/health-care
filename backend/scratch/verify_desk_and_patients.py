import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries, get_executive_kpis

# 1. Test Executive KPIs
exec_kpis = get_executive_kpis()
print("Executive KPIs:")
print("  Active admissions:", exec_kpis.get("active_admissions"))
print("  Discharged patients:", exec_kpis.get("discharged_patients"))
print("  Total beds:", exec_kpis.get("total_beds"))
print("  Occupied beds:", exec_kpis.get("occupied_beds"))
print("  Available beds:", exec_kpis.get("available_beds"))

# 2. Test Current Admissions (Patients View)
adm_res = get_dim_admission_inputs(discharge_status="all")
dis_res = get_dim_generated_discharge_summaries()

raw_admissions = adm_res.get("data", [])
raw_discharges = dis_res.get("data", [])

print(f"\nRaw Admissions count: {len(raw_admissions)}")
print(f"Raw Discharge Summaries count: {len(raw_discharges)}")

# Simulate PatientsView classification
actual_admitted = []
parsed_discharged = []
for r in raw_admissions:
    st = str(r.get("discharge_status") or "").strip().lower()
    if st == "discharged":
        parsed_discharged.append(r)
    else:
        actual_admitted.append(r)

print(f"\nPatients View classification:")
print(f"  IP (Active Inpatients): {len(actual_admitted)}")
print(f"  Discharged: {len(parsed_discharged)}")

# Simulate DischargeCommandCentre classification
processed_pids = set()
desk_completed = []
desk_ready = []
desk_other = []

for c in raw_discharges:
    pid = str(c.get("patient_id") or "")
    aid = str(c.get("admission_id") or "")
    if pid: processed_pids.add(pid)
    if aid: processed_pids.add(f"adm_{aid}")
    
    st = str(c.get("approval_status") or "").strip().lower()
    if st in ("approved", "signed", "signed off", "completed"):
        desk_completed.append(c)
    else:
        desk_ready.append(c)

for a in raw_admissions:
    pid = str(a.get("patient_id") or "")
    aid = str(a.get("admission_id") or "")
    if pid in processed_pids or f"adm_{aid}" in processed_pids:
        continue
    processed_pids.add(pid)
    if aid: processed_pids.add(f"adm_{aid}")
    
    st = str(a.get("discharge_status") or "").strip().lower()
    if st == "discharged":
        desk_completed.append(a)
    elif st == "ready":
        desk_ready.append(a)
    else:
        desk_other.append(a)

print(f"\nDischarge Management Desk classification:")
print(f"  Completed today: {len(desk_completed)}")
print(f"  Ready: {len(desk_ready)}")
print(f"  Blocked/In-progress: {len(desk_other)}")
print(f"  Total Active cases: {len(desk_ready) + len(desk_other)}")
print(f"  Total all cases: {len(desk_completed) + len(desk_ready) + len(desk_other)}")

assert len(actual_admitted) == 209, f"Patients IP mismatch: {len(actual_admitted)}"
assert len(parsed_discharged) == 11, f"Patients Discharged mismatch: {len(parsed_discharged)}"
assert len(desk_completed) == 11, f"Desk Completed mismatch: {len(desk_completed)}"
assert len(desk_ready) == 42, f"Desk Ready mismatch: {len(desk_ready)}"
assert len(desk_ready) + len(desk_other) == 209, f"Desk Active cases mismatch: {len(desk_ready) + len(desk_other)}"
assert len(desk_completed) + len(desk_ready) + len(desk_other) == 220, f"Desk Total mismatch"

print("\n>>> ALL SYSTEM COUNTS 100% PERFECTLY HARMONIZED! <<<")
