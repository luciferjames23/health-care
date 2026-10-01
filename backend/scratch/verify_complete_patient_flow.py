import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"

def post_json(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
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

print("=====================================================================")
print("  PATIENT LOGIN & ACCESS CONTROL COMPREHENSIVE VERIFICATION SUITE")
print("=====================================================================\n")

# 5 Target Sample Patients
PATIENTS = [
    {"user": "patient", "code": "MER-PAT-0087227", "id": 87227, "name": "Saanvier Parthalan"},
    {"user": "kavitha.raman", "code": "MER-PAT-0087225", "id": 87225, "name": "Vijayer Parthalan"},
    {"user": "rajesh.v", "code": "MER-PAT-0142901", "id": 142901, "name": "Rajesh Venkataraman"},
    {"user": "anand.n", "code": "MER-PAT-0000004", "id": 4, "name": "Anand Narayanan"},
    {"user": "divya.n", "code": "MER-PAT-0000009", "id": 9, "name": "Divya Narayanan"}
]

patient_tokens = {}

# Test 1: Test Login via select-account (Frontend 1-click account selection)
print("[TEST 1] Testing Patient Account Selection (/api/auth/select-account)...")
for p in PATIENTS:
    status, res = post_json("/api/auth/select-account", {"username": p["user"]})
    assert status == 200, f"Account selection failed for {p['user']}: {res}"
    assert res["success"] is True
    assert res["user"]["role"].upper() == "PATIENT"
    assert res["user"]["patient_id"] == p["id"]
    print(f"  [PASS] Account Selected: {p['name']} -> Token issued, Patient ID: {res['user']['patient_id']}")

# Test 2: Test Login via standard credentials & password (/api/auth/login)
print("\n[TEST 2] Testing Password Authentication (/api/auth/login)...")
for p in PATIENTS:
    # Login using username
    status, res = post_json("/api/auth/login", {"username": p["user"], "password": "Hospital@2026", "role": "patient"})
    assert status == 200, f"Login failed: {res}"
    patient_tokens[p["user"]] = res["token"]
    print(f"  [PASS] Username Login: {p['user']} (ID {p['id']}) verified")

    # Login using UHID / Patient Code
    status2, res2 = post_json("/api/auth/login", {"username": p["code"], "password": "Hospital@2026", "role": "patient"})
    assert status2 == 200, f"Login by UHID failed: {res2}"
    assert res2["user"]["patient_id"] == p["id"]
    print(f"  [PASS] UHID Login: {p['code']} verified")

# Test 3: Test Wrong Password rejection
print("\n[TEST 3] Testing Bad Credentials Rejection...")
status, res = post_json("/api/auth/login", {"username": "rajesh.v", "password": "WrongPassword123", "role": "patient"})
assert status == 401, f"Expected 401, got {status}"
print("  [PASS] Invalid password properly rejected with HTTP 401 Unauthorized")

# Test 4: Verify Patient Portal Dashboard for All 5 Sample Patients
print("\n[TEST 4] Testing Patient Portal Data Retrieval (/api/v1/patient/dashboard)...")
for p in PATIENTS:
    token = patient_tokens[p["user"]]
    status, res = get_json("/api/v1/patient/dashboard", token=token)
    assert status == 200, f"Dashboard retrieval failed: {res}"
    dash = res["data"]
    pat_profile = dash["patient"]
    assert pat_profile["id"] == p["id"]
    print(f"  [PASS] {p['name']} ({p['code']}):")
    print(f"         - Demographics: Age {pat_profile.get('age')}, Gender {pat_profile.get('gender')}, Blood {pat_profile.get('blood_group')}")
    print(f"         - Admissions: {len(dash['admissions'])}")
    print(f"         - Diagnoses: {len(dash['diagnoses'])}")
    print(f"         - Prescriptions: {len(dash['prescriptions'])}")
    print(f"         - Lab Orders: {len(dash['lab_orders'])}")
    print(f"         - Appointments: {len(dash['appointments'])}")
    print(f"         - Bills: {len(dash['bills'])}")
    print(f"         - Vitals: {len(dash['vitals'])}")
    print(f"         - Insurance: {len(dash['insurance_claims'])}")
    print(f"         - Discharge Summaries: {len(dash['discharge_summaries'])}")

# Test 5: Strict Access Control & Parameter Tampering Defense
print("\n[TEST 5] Testing Backend-Enforced Security & Cross-Patient Data Isolation...")
# Saanvier (ID 87227) attempts to tamper with the request and read Rajesh (ID 142901) or Anand (ID 4)
saanvier_token = patient_tokens["patient"]
for target_id in [142901, 4, 9, 87225]:
    status, res = get_json(f"/api/v1/patient/dashboard?patient_id={target_id}", token=saanvier_token)
    assert status == 200
    returned_pat_id = res["data"]["patient"]["id"]
    assert returned_pat_id == 87227, f"CRITICAL SECURITY LEAK: Patient ID altered to {returned_pat_id}"
print("  [PASS] URL parameter tampering rejected: Backend strictly forces authenticated JWT token identity.")

# Test 6: Unauthenticated Request Rejection
print("\n[TEST 6] Testing Unauthenticated Access Rejection...")
status, res = get_json("/api/v1/patient/dashboard")
assert status == 401, f"Expected 401, got {status}"
print("  [PASS] Request without token rejected with HTTP 401")

print("\n=====================================================================")
print("  ALL VERIFICATION TESTS COMPLETED WITH 100% SUCCESS!")
print("=====================================================================\n")
