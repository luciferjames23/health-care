import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import requests
from api.auth_helper import encode_token

BASE_URL = "http://localhost:8000"

def test_param_variations():
    token = encode_token({"user_id": 1, "username": "admin", "role": "ADMIN", "full_name": "Hospital Administrator"})
    headers = {"Authorization": f"Bearer {token}"}
    
    test_params = [
        {},
        {"department": "All Departments"},
        {"department": "all"},
        {"department": "NULL"},
        {"department": "undefined"},
        {"status": "All Status"},
        {"status": "all"},
        {"status": "NULL"},
        {"status": "undefined"},
        {"status": "ACTIVE"},
        {"status": "Active"},
        {"status": "INACTIVE"},
        {"search": "DOC-0004"},
        {"search": "Dermatology"},
    ]
    
    for p in test_params:
        res = requests.get(f"{BASE_URL}/api/dashboard/doctors", headers=headers, params=p)
        data = res.json()
        doc_count = len(data.get("doctors", [])) if isinstance(data, dict) and isinstance(data.get("doctors"), list) else f"ERR: {data}"
        print(f"Params: {str(p):45} -> Count: {doc_count}")

if __name__ == "__main__":
    test_param_variations()
