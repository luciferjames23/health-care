import sys
sys.path.append('backend')
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries
import json

ar = get_dim_admission_inputs(discharge_status='all')
dr = get_dim_generated_discharge_summaries()

rawAdmissions = ar.get('data', [])
rawDischarges = dr.get('data', [])

print(f"rawAdmissions count: {len(rawAdmissions)}")
print(f"rawDischarges count: {len(rawDischarges)}")

dischargeMapByPid = {}
dischargeMapByAid = {}
for d in rawDischarges:
    if d.get('patient_id'):
        dischargeMapByPid[str(d['patient_id'])] = d
    if d.get('admission_id'):
        dischargeMapByAid[str(d['admission_id'])] = d

seenDischargedPids = set()
parsedDischargedList = []
actualAdmitted = []

for r in rawAdmissions:
    st = str(r.get('discharge_status') or r.get('admission_status') or '').strip().lower()
    pid = str(r.get('patient_id') or r.get('id') or '').strip()
    aid = str(r.get('admission_id') or '').strip()
    d_date = r.get('discharge_date')

    # Line 126:
    isDischarged = (st == 'discharged') or (st == 'ready' and bool(d_date)) or (bool(d_date) and st != 'admitted')
    matchedSummary = dischargeMapByPid.get(pid) or (dischargeMapByAid.get(aid) if aid else None)

    if isDischarged:
        if pid:
            seenDischargedPids.add(pid)
        parsedDischargedList.append(r)
    else:
        isReady = str(r.get('discharge_status') or '').strip().lower() == 'ready'
        actualAdmitted.append(r)

print(f"actualAdmitted count (IP): {len(actualAdmitted)}")
print(f"parsedDischargedList count (from admissions): {len(parsedDischargedList)}")

# Now check step 2 in PatientsView.jsx (lines 194-222):
seenAdmittedPids = set(str(a.get('patient_id') or a.get('id') or '') for a in actualAdmitted)
for r in rawDischarges:
    dcStatus = str(r.get('discharge_status') or '').strip().lower()
    if dcStatus == 'admitted':
        continue
    isExplicitDischarge = str(r.get('status') or r.get('discharge_status') or '').strip().lower() == 'discharged' or r.get('is_discharged') is True or (dcStatus == 'ready' and bool(r.get('discharge_date')))
    if not isExplicitDischarge:
        continue
    pid = str(r.get('patient_id') or r.get('id') or '').strip()
    if pid and (pid in seenDischargedPids or pid in seenAdmittedPids):
        continue
    if pid:
        seenDischargedPids.add(pid)
    parsedDischargedList.append(r)

print(f"Total Discharged count: {len(parsedDischargedList)}")
print(f"seenDischargedPids count: {len(seenDischargedPids)}")
