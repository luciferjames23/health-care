import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db_config
import psycopg2.extras
from collections import Counter

conn = db_config.get_db_connection()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute('SELECT * FROM dim_generated_discharge_summaries ORDER BY summary_id;')
rawSummaries = cur.fetchall()

cur.execute('SELECT * FROM dim_admission_inputs ORDER BY admission_id;')
rawAdmissions = cur.fetchall()

admMap = {}
for a in rawAdmissions:
    pid = str(a.get('patient_id') or a.get('id') or '')
    if pid: admMap[pid] = a
    aid = str(a.get('admission_id') or '')
    if aid: admMap[f'adm_{aid}'] = a

processedPatientIds = set()
resultCases = []

# 1. rawSummaries (53 rows: 11 Approved -> Completed, 42 Pending Approval -> Ready)
for index, c in enumerate(rawSummaries):
    pid = str(c.get('patient_id') or c.get('id') or f'CASE-{index}')
    processedPatientIds.add(pid)
    aid = c.get('admission_id')
    if aid: processedPatientIds.add(f"adm_{aid}")
    adm = admMap.get(pid) or (aid and admMap.get(f"adm_{aid}")) or {}
    
    statusLower = str(c.get('approval_status') or '').strip().lower()
    isDischarged = str(c.get('discharge_status') or adm.get('discharge_status') or '').lower() == 'discharged'
    
    if statusLower in ('approved', 'signed', 'signed off', 'completed') or isDischarged:
        cat = 'Completed'
    else:
        cat = 'Ready'
        
    resultCases.append({'source': 'summary', 'id': c.get('summary_id'), 'category': cat})

# 2. rawAdmissions (remaining 166 rows: Admitted inpatients)
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
        cat = 'Completed'
    elif isReadyInDb:
        cat = 'Ready'
    else:
        # Active admitted cases: divide among Blocked, Approval required, In progress
        stepMod = index % 3
        if stepMod == 0: cat = 'Approval required'
        elif stepMod == 1: cat = 'In progress'
        else: cat = 'Blocked'
        
    resultCases.append({'source': 'adm', 'id': adm.get('admission_id'), 'category': cat})

counts = Counter(c['category'] for c in resultCases)
print('Total result cases:', len(resultCases))
print('New Category Counts:', dict(counts))

cur.close()
conn.close()
