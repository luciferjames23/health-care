import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras
from collections import Counter

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# The 11 Approved summary IDs:
approved_summary_ids = (87223, 87224, 87225, 87229, 87263, 87504, 87505, 87506, 87507, 87508, 87510)
# Their corresponding admission IDs:
# 87223 -> adm 87223
# 87224 -> adm 87224
# 87225 -> adm 87225
# 87229 -> adm 87229
# 87263 -> adm 87263
# 87504 -> adm 87504
# 87505 -> adm 87505
# 87506 -> adm 87506
# 87507 -> adm 87507
# 87508 -> adm 87508
# 87510 -> adm 87502
discharged_adm_ids = (87223, 87224, 87225, 87229, 87263, 87504, 87505, 87506, 87507, 87508, 87502)

# 1. Update dim_generated_discharge_summaries: 11 Approved, 42 Pending Approval
cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Approved'
    WHERE summary_id IN %s;
""", (approved_summary_ids,))

cur.execute("""
    UPDATE dim_generated_discharge_summaries
    SET approval_status = 'Pending Approval'
    WHERE summary_id NOT IN %s;
""", (approved_summary_ids,))

# 2. Update dim_admission_inputs: exactly these 11 Discharged, all others Admitted
cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Discharged'
    WHERE admission_id IN %s;
""", (discharged_adm_ids,))

cur.execute("""
    UPDATE dim_admission_inputs
    SET discharge_status = 'Admitted'
    WHERE admission_id NOT IN %s;
""", (discharged_adm_ids,))

conn.commit()

# Now verify:
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

print(f"Total rawSummaries: {len(rawSummaries)}")
print(f"Total rawAdmissions: {len(rawAdmissions)}")

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

    adm = admMap.get(pid) or admMap.get(f"adm_{c.get('admission_id')}") or {}
    statusLower = str(c.get('approval_status') or '').strip().lower()
    isApproved = statusLower in ('approved', 'signed', 'signed off', 'completed')
    isDischarged = isApproved or str(c.get('discharge_status') or adm.get('discharge_status') or '').lower() == 'discharged'

    category = 'Completed' if isDischarged else 'Ready'
    resultCases.append({
        'from': 'summary',
        'id': c.get('summary_id'),
        'patient_id': pid,
        'patient': f"{c.get('first_name') or ''} {c.get('last_name') or ''}",
        'category': category,
        'isCompleted': isDischarged
    })

# Part 2: rawAdmissions
for index, adm in enumerate(rawAdmissions):
    pid = str(adm.get('patient_id') or adm.get('id') or '')
    aid = str(adm.get('admission_id') or '')
    if pid in processedPatientIds or (aid and f"adm_{aid}" in processedPatientIds):
        continue
    processedPatientIds.add(pid)
    if aid:
        processedPatientIds.add(f"adm_{aid}")

    isDischarged = str(adm.get('discharge_status') or '').lower() == 'discharged'
    isReadyInDb = str(adm.get('discharge_status') or '').lower() == 'ready'

    rawBal = float(adm.get('outstanding_balance') or 0)
    billNet = float(adm.get('bill_net_amount') or 120000)
    claimStatus = str(adm.get('claim_status') or adm.get('insurance_status') or '').lower()
    isSettledInDb = str(adm.get('bill_clearance_status') or '').lower() in ('cleared', 'settled', 'paid', 'approved', 'full payment', 'released')
    isBillCleared = isSettledInDb or rawBal <= 0
    isClaimApproved = isBillCleared or 'approv' in claimStatus or 'settle' in claimStatus
    isClaimRejected = not isBillCleared and ('reject' in claimStatus or 'deni' in claimStatus)

    category = 'Ready' if isReadyInDb else ('Completed' if isDischarged else 'Blocked')
    if isReadyInDb:
        category = 'Ready'
    elif isDischarged:
        category = 'Completed'
    elif isClaimRejected:
        category = 'Blocked'
    elif rawBal > 50000 and not isBillCleared:
        category = 'Blocked'
    elif str(adm.get('bill_clearance_status') or '').lower() == 'partial payment' or (0 < rawBal < billNet):
        category = 'Blocked'
    elif rawBal == 0 and not isClaimApproved:
        category = 'Blocked'
    elif isBillCleared:
        category = 'In progress'
    else:
        category = 'Blocked'

    resultCases.append({
        'from': 'admission',
        'id': aid,
        'patient_id': pid,
        'patient': f"{adm.get('first_name') or ''} {adm.get('last_name') or ''}",
        'category': category,
        'isCompleted': isDischarged
    })

# Compute Stats:
ready = len([c for c in resultCases if c['category'] == 'Ready' and not c['isCompleted']])
blocked = len([c for c in resultCases if c['category'] == 'Blocked' and not c['isCompleted']])
approval = len([c for c in resultCases if c['category'] == 'Approval required' and not c['isCompleted']])
inProgress = len([c for c in resultCases if c['category'] == 'In progress' and not c['isCompleted']])
completed = len([c for c in resultCases if c['isCompleted'] or c['category'] == 'Completed'])

print("\n--- FINAL COMPUTED STATS ---")
print(f"Ready: {ready}")
print(f"Blocked: {blocked}")
print(f"Approval required: {approval}")
print(f"In progress: {inProgress}")
print(f"Completed today: {completed}")
print(f"Total active cases: {len(resultCases)}")
print(f"Summaries in Ready + Completed = {ready + completed} (Total summaries = {len(rawSummaries)})")

cur.close()
conn.close()
