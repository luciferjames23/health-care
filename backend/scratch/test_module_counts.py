import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras
import requests

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Check executive-kpis endpoint
res_kpis = requests.get("http://localhost:8000/api/v1/gold/executive-kpis").json()
print("Executive KPIs response:")
print("  active_admissions:", res_kpis.get("active_admissions"))
print("  occupied_beds:", res_kpis.get("occupied_beds"))
print("  total_beds:", res_kpis.get("total_beds"))
print("  available_beds:", res_kpis.get("available_beds"))
print("  discharged_patients:", res_kpis.get("discharged_patients"))

# 2. Check current-admission-llm-inputs endpoint
res_adms = requests.get("http://localhost:8000/api/v1/gold/current-admission-llm-inputs?discharge_status=all").json()
data_adms = res_adms.get("data", [])
print(f"\nCurrent admissions returned: {len(data_adms)}")
from collections import Counter
print("  discharge_status counts in API:", Counter(d.get("discharge_status") for d in data_adms))

# 3. Check generated-discharge-summaries endpoint
res_dc = requests.get("http://localhost:8000/api/v1/gold/generated-discharge-summaries").json()
data_dc = res_dc.get("data", [])
print(f"\nDischarge summaries returned: {len(data_dc)}")
print("  approval_status counts in API:", Counter(d.get("approval_status") for d in data_dc))

# 4. Check how AdmissionsView filters them:
# In AdmissionsView:
# dischargedTracker = extractDischargedPatientIds(dcRes?.data || [])
# actualAdmittedRaw = rawAdmissions.filter(r => !dischargedTracker.has(r))
# Wait! In extractDischargedPatientIds:
# const isExplicitDischarge = String(r.status || r.discharge_status || '').trim().toLowerCase() === 'discharged' || r.is_discharged === true || (dcStatus === 'ready' && r.discharge_date);
# BUT what fields are in generated-discharge-summaries?
# They have approval_status ('Approved', 'Pending Approval'), NOT 'discharge_status' or 'status'!
# Let's inspect what fields are in a record of generated-discharge-summaries!

sample_dc = data_dc[0] if data_dc else {}
print("\nSample discharge summary record keys:", list(sample_dc.keys()))
print("Sample status fields in summary:", {k: sample_dc[k] for k in ('approval_status', 'discharge_status', 'status', 'discharge_date') if k in sample_dc})

# If extractDischargedPatientIds checks r.status or r.discharge_status === 'discharged', but summaries only have approval_status == 'Approved',
# does extractDischargedPatientIds pick up ANY summary records?
discharged_ids = set()
for r in data_dc:
    dc_status = str(r.get("discharge_status") or "").strip().lower()
    if dc_status == "admitted":
        continue
    is_explicit = str(r.get("status") or r.get("discharge_status") or "").strip().lower() == "discharged" or r.get("is_discharged") is True or (dc_status == "ready" and r.get("discharge_date"))
    if is_explicit:
        discharged_ids.add(str(r.get("patient_id")))

print(f"discharged_ids extracted by extractDischargedPatientIds from dcRes: {len(discharged_ids)}")

# What about discharged in rawAdmissions?
adms_admitted = [a for a in data_adms if (a.get("discharge_status") or "").lower() == "admitted"]
adms_discharged = [a for a in data_adms if (a.get("discharge_status") or "").lower() == "discharged"]
print(f"Admissions with discharge_status == 'Admitted': {len(adms_admitted)}")
print(f"Admissions with discharge_status == 'Discharged': {len(adms_discharged)}")

cur.close()
conn.close()
