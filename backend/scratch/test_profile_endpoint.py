import sys
sys.path.insert(0, 'backend')
from fastapi.testclient import TestClient
from main import app

client = TestClient(app, client=("127.0.0.1", 50000))

print("--- Testing /api/auth/select-account with doctor_6 ---")
res_sel = client.post("/api/auth/select-account", json={"username": "doctor_6"})
print("Status:", res_sel.status_code)
print("User doc fields:", {k: res_sel.json()["user"][k] for k in ["name", "role", "qualification", "phone", "email", "consultation_fee", "designation", "department"]})

print("\n--- Testing /api/auth/login with doctor_6 ---")
res_login = client.post("/api/auth/login", json={"username": "doctor_6", "password": "Hospital@2026"})
print("Status:", res_login.status_code)
print("Login user fields:", {k: res_login.json()["user"][k] for k in ["name", "role", "qualification", "phone", "email", "consultation_fee", "designation", "department"]})

print("\n--- Testing /api/auth/login with admin ---")
res_adm_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
print("Status:", res_adm_login.status_code)
print("Admin user fields:", {k: res_adm_login.json()["user"][k] for k in ["name", "role", "qualification", "phone", "email", "consultation_fee", "designation", "department"]})
