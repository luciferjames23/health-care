import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import requests

# 1. Fetch current-admission-llm-inputs?discharge_status=all
r_adms = requests.get("http://localhost:8000/api/v1/gold/current-admission-llm-inputs?discharge_status=all").json()
data_adms = r_adms.get("data", [])
print(f"current-admission-llm-inputs count: {len(data_adms)}")

# 2. Fetch generated-discharge-summaries
r_dc = requests.get("http://localhost:8000/api/v1/gold/generated-discharge-summaries").json()
data_dc = r_dc.get("data", [])
print(f"generated-discharge-summaries count: {len(data_dc)}")

# 3. Simulate DischargeCommandCentre.jsx allCases:
rawSummaries = data_dc
rawAdmissions = data_adms

admMap = {}
for a in rawAdmissions:
    pid = str(a.get('patient_id') or a.get('id') or '')
    if pid:
        admMap[pid] = a
    aid = str(a.get('admission_id') or '')
    if aid:
        admMap[f"adm_{aid}"] = a

processedPatientIds = set()
resultCases = []

# Part 1: rawSummaries
for index, c in enumerate(rawSummaries):
    pid = str(c.get('patient_id') or c.get('id') or f"CASE-{index}")
    processedPatientIds.add(pid)
    if c.get('admission_id'):
        processedPatientIds.add(f"adm_{c['admission_id']}")

    resultCases.append({
        'from': 'summary',
        'id': c.get('summary_id'),
        'patient_id': pid,
        'admission_id': c.get('admission_id')
    })

# Part 2: rawAdmissions
unmatched_admissions = []
for index, adm in enumerate(rawAdmissions):
    pid = str(adm.get('patient_id') or adm.get('id') or '')
    aid = str(adm.get('admission_id') or '')
    if pid in processedPatientIds or (aid and f"adm_{aid}" in processedPatientIds):
        continue
    processedPatientIds.add(pid)
    if aid:
        processedPatientIds.add(f"adm_{aid}")
    resultCases.append({
        'from': 'admission',
        'id': aid,
        'patient_id': pid,
        'admission_id': aid
    })
    unmatched_admissions.append(adm)

print(f"\nTotal allCases in DischargeCommandCentre: {len(resultCases)}")
print(f"Cases from summaries: {len(rawSummaries)}")
print(f"Cases added from admissions (not in summaries): {len(unmatched_admissions)}")

# Now simulate AdmissionsView.jsx:
# In AdmissionsView.jsx:
# const dischargedTracker = extractDischargedPatientIds(dcRes?.data || []);
# const rawAdmissions = admRes?.data || [];
# const actualAdmittedRaw = rawAdmissions.filter(r => !dischargedTracker.has(r));
# Let's see what AdmissionsView.jsx does:
print(f"\nIn AdmissionsView:")
print(f"rawAdmissions length: {len(rawAdmissions)}")
