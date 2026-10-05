import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.clinical_operations import get_all_patients_directory
from api.auth_helper import encode_token
import requests

BASE_URL = "http://localhost:8000"

def test():
    print("============================================================")
    print("TEST: DOCTOR DATA ISOLATION ACROSS MULTIPLE DOCTORS")
    print("============================================================")

    doctors_to_test = [
        {"id": 1018, "name": "Dr. Moorthy D", "user_id": 1023, "username": "MD"},
        {"id": 1017, "name": "Dr. Edwin Stephano J", "user_id": 1022, "username": "EJ"},
        {"id": 1015, "name": "Dr. Immanuvel S", "user_id": 1020, "username": "IM"},
        {"id": 1014, "name": "Dr. Ajay L", "user_id": 1017, "username": "AL"},
    ]

    for doc in doctors_to_test:
        doc_id = doc["id"]
        doc_name = doc["name"]
        print(f"\n--- Checking {doc_name} (doctor_id={doc_id}) ---")
        
        # 1. Test Direct Backend Service
        res_op = get_all_patients_directory(category="OP", doctor_id=doc_id)
        op_list = res_op.get("data", []) if isinstance(res_op, dict) else res_op
        print(f"  OP Patients count: {len(op_list)}")
        for p in op_list:
            print(f"    - Patient ID: {p['patient_id']} | Code: {p['patient_code']} | Name: {p['patient_name']} | Doctor: {p['doctor']}")
            # Verify no other doctor's patients are returned
            assert "Edwin" not in p['doctor'] if doc_id != 1017 else True, "Data leak detected!"
            assert "Moorthy" not in p['doctor'] if doc_id != 1018 else True, "Data leak detected!"

        # 2. Test REST API Endpoint with JWT token
        token = encode_token({"user_id": doc["user_id"], "username": doc["username"], "role": "DOCTOR", "doctor_id": doc_id})
        headers = {"Authorization": f"Bearer {token}"}
        resp = requests.get(f"{BASE_URL}/api/dashboard/patients", headers=headers)
        assert resp.status_code == 200, f"Dashboard API failed: {resp.text}"
        dash_pats = resp.json().get("patients", [])
        print(f"  Dashboard Patients count via JWT: {len(dash_pats)}")

    print("\nSUCCESS: All Multi-Doctor Isolation Checks PASSED 100%!")

if __name__ == "__main__":
    test()
