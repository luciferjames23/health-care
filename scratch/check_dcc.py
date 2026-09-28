import urllib.request
import json

# 1. Fetch admissions & summaries
req_adm = urllib.request.urlopen('http://localhost:8000/api/v1/gold/current-admission-llm-inputs?discharge_status=all')
raw_admissions = json.loads(req_adm.read().decode('utf-8'))['data']

req_dc = urllib.request.urlopen('http://localhost:8000/api/v1/gold/generated-discharge-summaries')
raw_summaries = json.loads(req_dc.read().decode('utf-8'))['data']

print('Admissions:', len(raw_admissions), 'Summaries:', len(raw_summaries))

adm_map = {}
for a in raw_admissions:
    pid = str(a.get('patient_id') or a.get('id') or '')
    if pid:
        adm_map[pid] = a
    aid = str(a.get('admission_id') or '')
    if aid:
        adm_map[f'adm_{aid}'] = a

processed_pids = set()
result_cases = []

for index, c in enumerate(raw_summaries):
    pid = str(c.get('patient_id') or c.get('id') or f'CASE-{index}')
    processed_pids.add(pid)
    if c.get('admission_id'):
        processed_pids.add(f"adm_{c.get('admission_id')}")

    adm = adm_map.get(pid) or (adm_map.get(f"adm_{c.get('admission_id')}") if c.get('admission_id') else {}) or {}

    # CURRENT DCC LOGIC:
    doctor_name = c.get('doctor_name') or c.get('primary_consultant') or adm.get('attending_doctor') or 'Dr. Amit Sharma'

    status_lower = str(c.get('approval_status') or '').strip().lower()
    is_approved = status_lower in ('approved', 'signed', 'signed off', 'completed')
    is_discharged = str(c.get('discharge_status') or adm.get('discharge_status') or '').lower() == 'discharged'

    result_cases.append({
        'source': 'summary',
        'patient_id': pid,
        'name': f"{adm.get('first_name')} {adm.get('last_name')}" if adm else c.get('patient_name'),
        'adm_doctor': adm.get('attending_doctor'),
        'sum_doctor': c.get('doctor_name') or c.get('primary_consultant'),
        'case_doctor': doctor_name,
        'is_discharged': is_discharged
    })

for adm in raw_admissions:
    pid = str(adm.get('patient_id') or adm.get('id') or '')
    aid = str(adm.get('admission_id') or '')
    if pid in processed_pids or (aid and f'adm_{aid}' in processed_pids):
        continue
    processed_pids.add(pid)
    if aid:
        processed_pids.add(f'adm_{aid}')

    result_cases.append({
        'source': 'admission',
        'patient_id': pid,
        'name': f"{adm.get('first_name')} {adm.get('last_name')}",
        'adm_doctor': adm.get('attending_doctor'),
        'sum_doctor': None,
        'case_doctor': adm.get('attending_doctor'),
        'is_discharged': str(adm.get('discharge_status') or '').lower() == 'discharged'
    })

import re
def matches_doctor(doc, target):
    norm_target = re.sub(r'[^a-z0-9]', '', target.lower().replace('dr.', '').replace('dr ', ''))
    norm_doc = re.sub(r'[^a-z0-9]', '', (doc or '').lower().split(',')[0].split('(')[0].replace('dr.', '').replace('dr ', ''))
    return norm_target in norm_doc or norm_doc in norm_target

priya_cases = [c for c in result_cases if matches_doctor(c['case_doctor'], 'Dr. Priya Patel')]
print(f"Total cases for Priya with current DCC logic: {len(priya_cases)}")
for pc in priya_cases:
    print(pc)

print("\n--- Cases where admission attending doctor is Priya Patel ---")
priya_adm_cases = [c for c in result_cases if matches_doctor(c['adm_doctor'], 'Dr. Priya Patel')]
print(f"Total admissions for Priya: {len(priya_adm_cases)}")
for pc in priya_adm_cases:
    if not matches_doctor(pc['case_doctor'], 'Dr. Priya Patel'):
        print("MISMATCHED CASE:", pc)
