import sys
sys.path.append('backend')
from routers.gold import get_dim_admission_inputs, get_dim_generated_discharge_summaries
import json

ar = get_dim_admission_inputs(discharge_status='all')
dr = get_dim_generated_discharge_summaries()

rawSummaries = dr.get('data', [])
rawAdmissions = ar.get('data', [])

admMap = {}
for a in rawAdmissions:
    pid = str(a.get('patient_id') or a.get('id') or '')
    if pid: admMap[pid] = a
    aid = str(a.get('admission_id') or '')
    if aid: admMap[f'adm_{aid}'] = a

processedPatientIds = set()
allCases = []

for index, c in enumerate(rawSummaries):
    pid = str(c.get('patient_id') or c.get('id') or f'CASE-{index}')
    processedPatientIds.add(pid)
    aid = str(c.get('admission_id') or '')
    if aid: processedPatientIds.add(f'adm_{aid}')
    
    adm = admMap.get(pid) or admMap.get(f'adm_{aid}') or {}
    statusLower = str(c.get('approval_status') or c.get('approval_status') or '').strip().lower()
    isApproved = statusLower in ['approved', 'signed', 'signed off', 'completed']
    isDischarged = str(c.get('discharge_status') or adm.get('discharge_status') or '').lower() == 'discharged'
    
    category = 'Completed' if (isApproved or isDischarged) else 'Ready'
    blocker = 'All steps completed' if (isApproved or isDischarged) else 'Clear'
    
    # Check vitals in adm
    latest_temp = adm.get('latest_temperature')
    latest_hr = adm.get('latest_heart_rate')
    
    allCases.append({
        'id': f"DIS-SUM-{c.get('summary_id')}",
        'patient_id': pid,
        'category': category,
        'blocker': blocker,
        'isApproved': isApproved,
        'isCompleted': isDischarged or isApproved,
        'isCleared': True,
        'adm': adm,
        'rawRecord': c
    })

for index, adm in enumerate(rawAdmissions):
    pid = str(adm.get('patient_id') or adm.get('id') or '')
    aid = str(adm.get('admission_id') or '')
    if pid in processedPatientIds or (aid and f'adm_{aid}' in processedPatientIds):
        continue
    processedPatientIds.add(pid)
    if aid: processedPatientIds.add(f'adm_{aid}')
    
    isDischarged = str(adm.get('discharge_status') or '').lower() == 'discharged'
    isReadyInDb = str(adm.get('discharge_status') or '').lower() == 'ready'
    
    if isDischarged:
        category = 'Completed'
        blocker = 'Discharged'
    elif isReadyInDb:
        category = 'Ready'
        blocker = 'Clear'
    else:
        # Check why it became Blocked or Approval required
        billNet = float(adm.get('bill_net_amount') or 120000)
        clearance = str(adm.get('bill_clearance_status') or '').lower()
        bStatus = str(adm.get('bill_status') or '').lower()
        isSettledInDb = any(x in clearance for x in ['cleared', 'settled', 'paid', 'approved', 'full payment', 'released']) or any(x in bStatus for x in ['settled', 'paid', 'released'])
        rawBal = 0 if isSettledInDb else float(adm.get('outstanding_balance') or 0)
        isBillCleared = isSettledInDb or rawBal <= 0
        claimStatus = 'Approved' if isBillCleared else str(adm.get('claim_status') or adm.get('insurance_status') or '').strip()
        isClaimApproved = isBillCleared or 'approv' in claimStatus.lower() or 'settle' in claimStatus.lower()
        isClaimRejected = not isBillCleared and ('reject' in claimStatus.lower() or 'deni' in claimStatus.lower())
        
        # Check vitals
        temp = float(adm.get('latest_temperature') or 98.6)
        hr = float(adm.get('latest_heart_rate') or 72)
        isVitalsNormal = not (temp > 100.4 or temp < 95.0 or hr > 110 or hr < 50)
        
        if isClaimRejected:
            category = 'Blocked'
            blocker = 'insurance appeal'
        elif not isVitalsNormal:
            category = 'Blocked'
            blocker = 'vital signs observation'
        elif rawBal > 50000 and not isBillCleared:
            category = 'Blocked'
            blocker = 'patient liability balance'
        elif clearance == 'partial payment' or (rawBal > 0 and rawBal < billNet):
            category = 'Blocked'
            blocker = 'billing clearance'
        elif isClaimApproved and not isBillCleared:
            category = 'Approval required'
            blocker = 'billing release'
        elif isBillCleared and not isClaimApproved:
            category = 'In progress'
            blocker = 'insurance enhancement'
        else:
            stepMod = index % 3
            if stepMod == 0:
                category = 'Approval required'
                blocker = 'discharge summary approval'
            elif stepMod == 1:
                category = 'In progress'
                blocker = 'pharmacy dispensing'
            else:
                category = 'Blocked'
                blocker = 'investigations verification'
                
    allCases.append({
        'id': f"DIS-ADM-{aid or pid}",
        'patient_id': pid,
        'category': category,
        'blocker': blocker,
        'isApproved': False,
        'isCompleted': isDischarged,
        'isCleared': True,
        'adm': adm,
        'rawRecord': adm
    })

print(f"Total allCases: {len(allCases)}")

# Now simulate lines 145-200 of createCaseInitialState and enrichedCases on allCases:
results = {}
for base in allCases:
    isReady = base['category'] == 'Ready'
    isCompleted = base['isCompleted']
    isApproval = base['category'] == 'Approval required'
    blocker = base['blocker'].lower()
    adm = base.get('adm') or {}
    
    # Check vitals
    temp = float(adm.get('latest_temperature') or 98.6)
    hr = float(adm.get('latest_heart_rate') or 72)
    isVitalsNormal = not (temp > 100.4 or temp < 95.0 or hr > 110 or hr < 50)
    
    deps = {
        'clinical': 'done' if (isReady or isCompleted or 'clinical' not in blocker) else 'blocked',
        'vitals': 'blocked' if (not isReady and not isCompleted and (not isVitalsNormal or 'vital' in blocker)) else 'done',
        'investigations': 'blocked' if (not isReady and not isCompleted and 'investigations' in blocker) else 'done',
        'pharmacy': 'done' if (isReady or isCompleted or 'pharmacy' not in blocker) else 'pending',
        'billing': 'done' if (isReady or isCompleted) else ('blocked' if 'billing' in blocker else 'done'),
        'insurance': 'done' if (isReady or isCompleted) else ('blocked' if 'insurance' in blocker else 'done'),
        'housekeeping': 'done' if (isReady or isCompleted) else 'waiting',
        'transport': 'done' if (isReady or isCompleted) else 'waiting',
        'summary': 'done' if (base['isApproved'] or isCompleted or isReady) else 'approval'
    }
    
    # Notice: what if isReady was false for some cases from rawSummaries or rawAdmissions?
    openBlocked = [k for k, v in deps.items() if v == 'blocked']
    openApproval = [k for k, v in deps.items() if v == 'approval']
    openPending = [k for k, v in deps.items() if v in ['pending', 'waiting']]
    
    if isCompleted:
        final_cat = 'Completed'
    elif openBlocked:
        final_cat = 'Blocked'
    elif openApproval:
        final_cat = 'Approval required'
    elif openPending:
        final_cat = 'In progress'
    else:
        final_cat = 'Ready'
        
    results[final_cat] = results.get(final_cat, 0) + 1

print("Detailed enriched category counts:")
for k, v in results.items():
    print(f"  {k}: {v}")
