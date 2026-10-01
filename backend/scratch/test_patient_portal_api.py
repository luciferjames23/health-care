import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def post_json(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers={"Content-Type": "application/json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def get_json(endpoint, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

print("=== 1. Testing Patient Login by username 'patient' ===")
status, data = post_json("/api/auth/login", {"username": "patient", "password": "Hospital@2026", "role": "patient"})
print(f"Status: {status}")
assert status == 200, f"Login failed: {data}"
patient1_token = data["token"]
user1 = data["user"]
print(f"Logged in: {user1['name']} ({user1['patient_code']}), Patient ID: {user1['patient_id']}")
assert user1["patient_id"] == 87227
assert user1["role"] == "Patient"

print("\n=== 2. Testing Patient Login by patient_code 'MER-PAT-0087227' ===")
status, data = post_json("/api/auth/login", {"username": "MER-PAT-0087227", "password": "Hospital@2026", "role": "patient"})
print(f"Status: {status}")
assert status == 200, f"Login by patient code failed: {data}"
print(f"Logged in successfully via Patient Code!")

print("\n=== 3. Testing Patient 2 Login 'kavitha.raman' ===")
status, data = post_json("/api/auth/login", {"username": "kavitha.raman", "password": "Hospital@2026", "role": "patient"})
print(f"Status: {status}")
assert status == 200, f"Login 2 failed: {data}"
patient2_token = data["token"]
user2 = data["user"]
print(f"Logged in: {user2['name']} ({user2['patient_code']}), Patient ID: {user2['patient_id']}")
assert user2["patient_id"] == 87225

print("\n=== 4. Testing Patient 1 Dashboard Retrieval ===")
status, data = get_json("/api/v1/patient/dashboard", token=patient1_token)
print(f"Status: {status}")
assert status == 200, f"Dashboard failed: {data}"
dashboard1 = data["data"]
print(f"Profile Name: {dashboard1['patient']['full_name']}")
print(f"UHID: {dashboard1['patient']['patient_code']}")
print(f"Admissions: {len(dashboard1['admissions'])}")
print(f"Diagnoses: {len(dashboard1['diagnoses'])}")
print(f"Appointments: {len(dashboard1['appointments'])}")
print(f"Prescriptions: {len(dashboard1['prescriptions'])}")
print(f"Lab Orders: {len(dashboard1['lab_orders'])}")
print(f"Bills: {len(dashboard1['bills'])}")
print(f"Insurance Claims: {len(dashboard1['insurance_claims'])}")
assert dashboard1["patient"]["id"] == 87227

print("\n=== 5. Testing Access Control / Cross-Patient Isolation ===")
# Patient 1 tries to query with ?patient_id=87225 (Patient 2's ID)
status, data = get_json("/api/v1/patient/dashboard?patient_id=87225", token=patient1_token)
print(f"Status: {status}")
assert status == 200
hacked_dashboard = data["data"]
# Must STILL be Patient 1's ID!
print(f"Returned Patient ID when requesting 87225: {hacked_dashboard['patient']['id']}")
assert hacked_dashboard["patient"]["id"] == 87227, "SECURITY BREACH: Patient accessed another patient's data!"
print("SECURITY VERIFIED: Strict token-level patient identity enforced, parameter tampering rejected.")

print("\n=== 6. Testing Patient 2 Dashboard Retrieval ===")
status, data = get_json("/api/v1/patient/dashboard", token=patient2_token)
assert status == 200
dashboard2 = data["data"]
print(f"Patient 2 Profile Name: {dashboard2['patient']['full_name']}")
print(f"Patient 2 UHID: {dashboard2['patient']['patient_code']}")
assert dashboard2["patient"]["id"] == 87225

print("\n=== 7. Testing All Individual Modular Endpoints for Patient 1 ===")
for ep in ["profile", "admissions", "diagnoses", "appointments", "vitals", "prescriptions", "lab-results", "bills", "insurance", "discharge-summaries", "notifications"]:
    status, ep_data = get_json(f"/api/v1/patient/{ep}", token=patient1_token)
    print(f"  GET /api/v1/patient/{ep} -> HTTP {status} (success: {ep_data.get('success')})")
    assert status == 200

print("\n ALL BACKEND PATIENT PORTAL ENDPOINTS & ACCESS CONTROLS PASSED!")
