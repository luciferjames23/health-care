import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from fastapi.testclient import TestClient
from main import app
from api.auth_helper import encode_token

client = TestClient(app)

def test_routes():
    print("--- 1. Test /api/auth/users ---")
    res_users = client.get("/api/auth/users")
    print("Status:", res_users.status_code)
    if res_users.status_code != 200:
        print("Error:", res_users.text)
    else:
        print("Users count:", len(res_users.json().get("users", [])))

    print("\n--- 2. Test /api/auth/select-account with 'admin' ---")
    res_sel_admin = client.post("/api/auth/select-account", json={"username": "admin"})
    print("Status:", res_sel_admin.status_code)
    if res_sel_admin.status_code != 200:
        print("Error:", res_sel_admin.text)
    else:
        print("Success:", res_sel_admin.json().get("user"))

    print("\n--- 3. Test /api/auth/select-account with 'doctor_1' ---")
    res_sel_doc = client.post("/api/auth/select-account", json={"username": "doctor_1"})
    print("Status:", res_sel_doc.status_code)
    if res_sel_doc.status_code != 200:
        print("Error:", res_sel_doc.text)
    else:
        print("Success:", res_sel_doc.json().get("user"))

    print("\n--- 4. Test /api/dashboard/appointments as ADMIN ---")
    admin_token = encode_token({
        "user_id": 1,
        "username": "admin",
        "role": "ADMIN",
        "full_name": "Hospital Administrator"
    })
    res_appts_admin = client.get("/api/dashboard/appointments", headers={"Authorization": f"Bearer {admin_token}"})
    print("Admin status:", res_appts_admin.status_code)
    if res_appts_admin.status_code == 200:
        d = res_appts_admin.json()
        print("Admin appts total:", d.get("total"), "returned:", len(d.get("appointments", [])))
    else:
        print("Admin appts error:", res_appts_admin.text)

    print("\n--- 5. Test /api/dashboard/appointments as DOCTOR (doctor_id=1) ---")
    doc_token = encode_token({
        "user_id": 1,
        "username": "doctor_1",
        "role": "DOCTOR",
        "doctor_id": 1,
        "full_name": "Dr. Priya Patel"
    })
    res_appts_doc = client.get("/api/dashboard/appointments", headers={"Authorization": f"Bearer {doc_token}"})
    print("Doctor status:", res_appts_doc.status_code)
    if res_appts_doc.status_code == 200:
        d = res_appts_doc.json()
        print("Doctor appts total:", d.get("total"), "returned:", len(d.get("appointments", [])))
    else:
        print("Doctor appts error:", res_appts_doc.text)

    print("\n--- 6. Test /api/dashboard/appointments without Token (Fallback/Demo) ---")
    res_no_token = client.get("/api/dashboard/appointments")
    print("No token status:", res_no_token.status_code)
    if res_no_token.status_code == 200:
        d = res_no_token.json()
        print("No token appts total:", d.get("total"), "returned:", len(d.get("appointments", [])))
    else:
        print("No token error:", res_no_token.text)

if __name__ == '__main__':
    test_routes()
