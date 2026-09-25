import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import requests
from api.auth_helper import encode_token

BASE_URL = "http://localhost:8000"

def test_api():
    token = encode_token({"user_id": 1, "username": "admin", "role": "ADMIN", "full_name": "Hospital Administrator"})
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n1. Testing GET /api/dashboard/doctors with no params...")
    res = requests.get(f"{BASE_URL}/api/dashboard/doctors", headers=headers)
    print(f"Status Code: {res.status_code}")
    data = res.json()
    print("Keys in response:", list(data.keys()) if isinstance(data, dict) else "not dict")
    doctors = data.get("doctors", [])
    print(f"Total doctors in response: {len(doctors)}")
    if doctors:
        print("Sample doctor 0:", doctors[0])
        
    print("\n2. Testing GET /api/dashboard/doctors with status='ACTIVE'...")
    res_active = requests.get(f"{BASE_URL}/api/dashboard/doctors?status=ACTIVE", headers=headers)
    data_active = res_active.json()
    print(f"Total ACTIVE doctors in response: {len(data_active.get('doctors', []))}")
    
    print("\n3. Testing GET /api/dashboard/doctors with status='INACTIVE'...")
    res_inactive = requests.get(f"{BASE_URL}/api/dashboard/doctors?status=INACTIVE", headers=headers)
    data_inactive = res_inactive.json()
    print(f"Total INACTIVE doctors in response: {len(data_inactive.get('doctors', []))}")

    print("\n4. Testing GET /api/dashboard/doctors with department='General Medicine'...")
    res_dept = requests.get(f"{BASE_URL}/api/dashboard/doctors?department=General%20Medicine", headers=headers)
    data_dept = res_dept.json()
    print(f"Total General Medicine doctors in response: {len(data_dept.get('doctors', []))}")

if __name__ == "__main__":
    test_api()
