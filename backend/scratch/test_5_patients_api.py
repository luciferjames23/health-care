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

print("=== VERIFYING 5 SAMPLE PATIENTS AUTHENTICATION & ISOLATION ===")

patients_to_test = [
    {"user": "patient", "code": "MER-PAT-0087227", "expected_id": 87227, "name": "Saanvier Parthalan"},
    {"user": "kavitha.raman", "code": "MER-PAT-0087225", "expected_id": 87225, "name": "Vijayer Parthalan"},
    {"user": "rajesh.v", "code": "MER-PAT-0142901", "expected_id": 142901, "name": "Rajesh Venkataraman"},
    {"user": "anand.n", "code": "MER-PAT-0000004", "expected_id": 4, "name": "Anand Narayanan"},
    {"user": "divya.n", "code": "MER-PAT-0000009", "expected_id": 9, "name": "Divya Narayanan"}
]

tokens = {}

for p in patients_to_test:
    print(f"\n--- Testing Login for {p['name']} ({p['user']} / {p['code']}) ---")
    
    # 1. Login by username
    status, data = post_json("/api/auth/login", {"username": p["user"], "password": "Hospital@2026", "role": "patient"})
    assert status == 200, f"Login failed for {p['user']}: {data}"
    user_info = data["user"]
    assert user_info["patient_id"] == p["expected_id"], f"Mismatch patient_id: {user_info}"
    assert user_info["role"].lower() == "patient"
    tokens[p["user"]] = data["token"]
    print(f"[OK] Authenticated via username -> patient_id: {user_info['patient_id']}, token received")

    # 2. Login by patient code
    status2, data2 = post_json("/api/auth/login", {"username": p["code"], "password": "Hospital@2026", "role": "patient"})
    assert status2 == 200, f"Login by patient code failed for {p['code']}: {data2}"
    assert data2["user"]["patient_id"] == p["expected_id"]
    print(f"[OK] Authenticated via Patient Code ({p['code']})")

    # 3. Retrieve Dashboard
    status_dash, dash_data = get_json("/api/v1/patient/dashboard", token=tokens[p["user"]])
    assert status_dash == 200, f"Dashboard fetch failed: {dash_data}"
    patient_record = dash_data["data"]["patient"]
    assert patient_record["id"] == p["expected_id"], f"Isolation breach: expected {p['expected_id']}, got {patient_record['id']}"
    print(f"[OK] Dashboard data successfully fetched: {patient_record['full_name']} (UHID: {patient_record['patient_code']})")

# 4. Strict Isolation Cross-Check
print("\n--- Testing Cross-Patient Isolation & Security Enforcement ---")
p1_token = tokens["patient"]  # id 87227
# p1 tries to get p3's data by passing p3's id 142901
for hacked_id in [142901, 4, 9, 87225]:
    status, hacked = get_json(f"/api/v1/patient/dashboard?patient_id={hacked_id}", token=p1_token)
    assert status == 200
    returned_id = hacked["data"]["patient"]["id"]
    assert returned_id == 87227, f"CRITICAL SECURITY FAIL: Token patient_id was overridden to {returned_id}"
print("[OK] Cross-patient ID spoofing prevented: Backend strictly binds data to the verified token patient ID.")

print("\n--- Testing Specific Modular Endpoints for Patient 3 (Rajesh Venkataraman) ---")
p3_token = tokens["rajesh.v"]
for ep in ["profile", "admissions", "diagnoses", "appointments", "vitals", "prescriptions", "lab-results", "bills", "insurance", "discharge-summaries", "notifications"]:
    status, ep_data = get_json(f"/api/v1/patient/{ep}", token=p3_token)
    assert status == 200, f"Endpoint {ep} failed: {ep_data}"
    print(f"  GET /api/v1/patient/{ep} -> 200 OK")

print("\n ALL 5 SAMPLE PATIENTS PASSED AUTHENTICATION, ISOLATION & DATA RETRIEVAL TESTS SUCCESSFULLY!")
