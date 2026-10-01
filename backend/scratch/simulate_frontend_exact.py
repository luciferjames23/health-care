import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT s.*, p.first_name, p.last_name, p.patient_code, p.gender, p.date_of_birth, p.blood_group
    FROM dim_generated_discharge_summaries s
    LEFT JOIN patients p ON s.patient_id = p.id
    ORDER BY s.summary_id;
""")
rawSummaries = cur.fetchall()

cur.execute("""
    SELECT a.*
    FROM dim_admission_inputs a
    ORDER BY a.admission_id;
""")
rawAdmissions = cur.fetchall()

# Frontend exact logic:
admMap = {}
for a in rawAdmissions:
    pid = str(a.get('patient_id') or a.get('id') or '')
    if pid:
        admMap[pid] = a
    aid = str(a.get('admission_id') or '')
    if aid:
        admMap[f"adm_{aid}"] = a

processedPatientIds = set()
allCases = []

# 1. Summaries
for index, c in enumerate(rawSummaries):
    pid = str(c.get('patient_id') or c.get('id') or f"CASE-{index}")
    processedPatientIds.add(pid)
    if c.get('admission_id'):
        processedPatientIds.add(f"adm_{c['admission_id']}")

    adm = admMap.get(pid) or admMap.get(f"adm_{c.get('admission_id')}") or {}
    statusLower = str(c.get('approval_status') or '').strip().lower()
    isApproved = statusLower in ('approved', 'signed', 'signed off', 'completed')
    isDischarged = isApproved or str(c.get('discharge_status') or adm.get('discharge_status') or '').lower() == 'discharged'

    category = 'Completed' if isDischarged else 'Ready'
    blocker = 'All steps completed' if isDischarged else 'Clear'
    initialStatus = 'Completed' if isDischarged else 'Ready'

    allCases.append({
        'id': f"DIS-SUM-{c.get('summary_id')}",
        'patient_id': pid,
        'category': category,
        'blocker': blocker,
        'initialStatus': initialStatus,
        'isCompleted': isDischarged,
        'isApproved': isApproved,
        'isCleared': True,
        'isVitalsStable': True,
        'billDetails': {'actual': 120000, 'insurance': 120000, 'patient': 0},
        'insurer': 'Star Health'
    })

# 2. Admissions
for index, adm in enumerate(rawAdmissions):
    pid = str(adm.get('patient_id') or adm.get('id') or '')
    aid = str(adm.get('admission_id') or '')
    if pid in processedPatientIds or (aid and f"adm_{aid}" in processedPatientIds):
        continue
    processedPatientIds.add(pid)
    if aid:
        processedPatientIds.add(f"adm_{aid}")

    rawBal = float(adm.get('outstanding_balance') or 0)
    billNet = float(adm.get('bill_net_amount') or 120000)
    clearance = str(adm.get('bill_clearance_status') or '').lower()
    bStatus = str(adm.get('bill_status') or '').lower()
    isSettledInDb = clearance in ('cleared', 'settled', 'paid', 'approved', 'full payment', 'released') or bStatus in ('settled', 'paid', 'released')
    isBillCleared = isSettledInDb or rawBal <= 0
    effectiveBal = 0 if isBillCleared else rawBal
    insCoverage = billNet if isBillCleared else max(0, billNet - effectiveBal)

    isDischarged = str(adm.get('discharge_status') or '').lower() == 'discharged'
    isReadyInDb = str(adm.get('discharge_status') or '').lower() == 'ready'
    claimStatus = 'Approved' if isBillCleared else str(adm.get('claim_status') or adm.get('insurance_status') or '').strip()
    isClaimApproved = isBillCleared or 'approv' in claimStatus.lower() or 'settle' in claimStatus.lower()
    isClaimRejected = not isBillCleared and ('reject' in claimStatus.lower() or 'deni' in claimStatus.lower())

    category = 'Ready' if isReadyInDb else ('Completed' if isDischarged else 'Blocked')
    blocker = 'Clear' if isReadyInDb else ('Discharged' if isDischarged else 'billing → insurance')
    initialStatus = 'Ready' if isReadyInDb else ('Discharged' if isDischarged else 'Blocked · billing')

    if isReadyInDb:
        category = 'Ready'
        blocker = 'Clear'
        initialStatus = 'Ready'
    elif isDischarged:
        category = 'Completed'
        blocker = 'Discharged'
        initialStatus = 'Discharged'
    elif isClaimRejected:
        blocker = 'insurance'
        initialStatus = 'Blocked · insurance'
    elif rawBal > 50000 and not isBillCleared:
        blocker = 'billing → insurance'
        initialStatus = 'Blocked · billing'
    elif clearance == 'partial payment' or (0 < rawBal < billNet):
        blocker = 'housekeeping' if (index % 2 == 0) else 'transport'
        initialStatus = 'Blocked · clearance'
    elif rawBal == 0 and not isClaimApproved:
        blocker = 'insurance'
        initialStatus = 'Blocked · insurance'
    elif isBillCleared:
        category = 'In progress'
        blocker = 'clinical review'
        initialStatus = 'In progress · clinical'
    else:
        stepMod = index % 3
        blocker = 'pharmacy → billing' if stepMod == 0 else ('investigations → billing' if stepMod == 1 else 'clinical → billing')
        initialStatus = f"Blocked · {blocker.split(' → ')[0]}"

    allCases.append({
        'id': f"DIS-ADM-{adm.get('admission_id')}",
        'patient_id': pid,
        'category': category,
        'blocker': blocker,
        'initialStatus': initialStatus,
        'isCompleted': isDischarged,
        'isApproved': False,
        'isCleared': isBillCleared,
        'isVitalsStable': True,
        'billDetails': {'actual': billNet, 'insurance': insCoverage, 'patient': effectiveBal},
        'claimStatus': claimStatus,
        'insurer': adm.get('insurance_provider') or 'Star Health'
    })

# Now simulate createCaseInitialState and enrichedCases:
enrichedCases = []
for base in allCases:
    isReady = base['category'] == 'Ready'
    isCompleted = base['category'] == 'Completed' or base['isCompleted']
    blocker = base['blocker'] or ''
    isBillCleared = base['isCleared']
    claimStatus = str(base.get('claimStatus') or '').lower()
    isInsApproved = isReady or isCompleted or 'approv' in claimStatus or 'settle' in claimStatus
    isInsRejected = 'reject' in claimStatus or 'deni' in claimStatus

    deps = {
        'clinical': {'status': 'done'},
        'vitals': {'status': 'blocked' if (base.get('isVitalsStable') is False or (not isReady and not isCompleted and 'vital' in blocker)) else 'done'},
        'investigations': {'status': 'blocked' if (not isReady and not isCompleted and 'investigations' in blocker) else 'done'},
        'pharmacy': {'status': 'done' if (isReady or isCompleted) else ('blocked' if 'pharmacy' in blocker else 'done')},
        'billing': {'status': 'done' if isBillCleared else ('approval' if isInsApproved else ('done' if (isReady or isCompleted) else ('blocked' if 'billing' in blocker else 'pending')))},
        'insurance': {'status': 'done' if isInsApproved else ('blocked' if isInsRejected else ('done' if (isReady or isCompleted) else ('blocked' if 'insurance' in blocker else 'waiting')))},
        'housekeeping': {'status': 'done' if (isReady or isCompleted) else 'waiting'},
        'transport': {'status': 'done' if (isReady or isCompleted) else 'waiting'},
        'summary': {'status': 'done' if (base['isApproved'] or isCompleted) else 'approval'}
    }

    openBlocked = [k for k, v in deps.items() if v['status'] == 'blocked']
    openApproval = [k for k, v in deps.items() if v['status'] == 'approval']
    openPending = [k for k, v in deps.items() if v['status'] in ('pending', 'waiting')]

    if isCompleted:
        computedCategory = 'Completed'
    elif base['category'] == 'Ready':
        computedCategory = 'Ready'
    elif len(openBlocked) > 0:
        computedCategory = 'Blocked'
    elif len(openApproval) > 0:
        computedCategory = 'Approval required'
    elif len(openPending) > 0:
        computedCategory = 'In progress'
    else:
        computedCategory = base['category'] or 'Blocked'

    enrichedCases.append({
        'id': base['id'],
        'category': computedCategory,
        'isCompleted': isCompleted
    })

ready = len([c for c in enrichedCases if c['category'] == 'Ready' and not c['isCompleted']])
blocked = len([c for c in enrichedCases if c['category'] == 'Blocked' and not c['isCompleted']])
approval = len([c for c in enrichedCases if c['category'] == 'Approval required' and not c['isCompleted']])
inProgress = len([c for c in enrichedCases if c['category'] == 'In progress' and not c['isCompleted']])
completed = len([c for c in enrichedCases if c['isCompleted'] or c['category'] == 'Completed'])

print("\n--- EXACT ENRICHED FRONTEND STATS ---")
print(f"Ready: {ready}")
print(f"Blocked: {blocked}")
print(f"Approval required: {approval}")
print(f"In progress: {inProgress}")
print(f"Completed today: {completed}")
print(f"Total: {len(enrichedCases)}")

cur.close()
conn.close()
