import sys, os, re
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.path.insert(0, r'e:\Bosco-projects\POC\Health-care\code\health-care\backend')
from fastapi.testclient import TestClient
from fastapi import FastAPI
from routers.admin_system import router

app = FastAPI()
app.include_router(router)
client = TestClient(app)

resp = client.get('/api/v1/admin/notifications?limit=100')
data = resp.json()
items = data.get('data', [])

print(f"Total items: {len(items)}")

# Check for patient ID numbers in patient_name
bad_numeric = [x for x in items if x.get('patient_name', '').startswith('Patient #')]
bad_still_placeholder = [x for x in items if re.match(r'^Patient\s+\d', x.get('patient_name', ''))]
code_fallback = [x for x in items if (x.get('patient_name') or '').startswith('PAT-')]
phone_fallback = [x for x in items if '···' in (x.get('patient_name') or '')]
real_names = [x for x in items if x.get('patient_name') and not (x.get('patient_name','').startswith('PAT-') or '···' in x.get('patient_name','') or x.get('patient_name','').startswith('Patient'))]

print(f"\nName resolution results:")
print(f"  Real names resolved: {len(real_names)}")
print(f"  Patient code fallback (PAT-xxx): {len(code_fallback)}")
print(f"  Phone fallback (···1234): {len(phone_fallback)}")
print(f"  Still showing 'Patient #NNN' (BAD): {len(bad_numeric)}")
print(f"  Still showing 'Patient NNN' (BAD): {len(bad_still_placeholder)}")

if bad_numeric or bad_still_placeholder:
    print("\nFAIL - still showing numbers:")
    for b in (bad_numeric + bad_still_placeholder)[:5]:
        print(f"  id={b['id']}, patient_name='{b['patient_name']}'")
else:
    print("\nPASS: No raw 'Patient #ID' placeholders in output")

print("\nSample of escalations (the PAT-138843 case):")
for e in items:
    if e.get('type') == 'ESCALATION':
        print(f"  {e['id']}: patient_name='{e['patient_name']}', patient_code={e.get('patient_code')}")

print("\nSample real names:")
for x in real_names[:5]:
    print(f"  {x['id']}: patient_name='{x['patient_name']}'")
