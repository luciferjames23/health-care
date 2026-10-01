import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import requests

# 1. Executive Dashboard / executive-kpis
r_kpis = requests.get("http://localhost:8000/api/v1/gold/executive-kpis").json()
print("Executive Dashboard:")
print(f"  Currently Admitted Patients (active_admissions): {r_kpis.get('active_admissions')}")
print(f"  Occupied Beds (occupied_beds): {r_kpis.get('occupied_beds')}")
print(f"  Discharged Patient Records: {r_kpis.get('discharged_patients')}")
print(f"  Total Beds: {r_kpis.get('total_beds')}")
print(f"  Available Beds: {r_kpis.get('available_beds')}")

# 2. Bed Management / bed-management data
r_bm = requests.get("http://localhost:8000/api/v1/gold/bed-management").json()
kpis = r_bm.get("kpis", {})
print("\nBed Board (bed-management):")
print(f"  total_beds: {kpis.get('total_beds')}")
print(f"  occupied_beds: {kpis.get('occupied_beds')}")
print(f"  available_beds: {kpis.get('available_beds')}")

# 3. Admissions table / current-admission-llm-inputs
r_adms = requests.get("http://localhost:8000/api/v1/gold/current-admission-llm-inputs?discharge_status=all").json()
all_adms = r_adms.get("data", [])
admitted_adms = [a for a in all_adms if (a.get("discharge_status") or "").lower() == "admitted"]
discharged_adms = [a for a in all_adms if (a.get("discharge_status") or "").lower() == "discharged"]
print(f"\nAdmissions module (current-admission-llm-inputs):")
print(f"  Total records: {len(all_adms)}")
print(f"  Admitted count: {len(admitted_adms)}")
print(f"  Discharged count: {len(discharged_adms)}")

# 4. Check if Admissions module filters out discharged
# If discharge_status != 'all' (default):
r_adms_default = requests.get("http://localhost:8000/api/v1/gold/current-admission-llm-inputs").json()
print(f"  Default current-admission-llm-inputs (without discharge_status=all): {len(r_adms_default.get('data', []))}")

# 5. Patients module
# Patients module usually loads patients or admissions
r_pats = requests.get("http://localhost:8000/api/v1/patients?limit=5").json()
print(f"\nPatients count total in API: {r_pats.get('total')}")

# 6. Clinical Workspace
# Uses current-admission-llm-inputs
print(f"\nClinical Workspace active admissions: {len(admitted_adms)}")

# 7. Discharge desk
r_dc = requests.get("http://localhost:8000/api/v1/gold/generated-discharge-summaries").json()
print(f"\nDischarge Desk summaries: {len(r_dc.get('data', []))}")
