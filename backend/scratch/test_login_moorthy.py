import requests

BASE_URL = "http://localhost:8000"

def test_login_dr_moorthy():
    print("Testing POST /api/auth/login for username 'MD'...")
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "username": "MD",
        "password": "password123",
        "role": "doctor"
    })
    print("HTTP Status:", resp.status_code)
    data = resp.json()
    print("Response Data:", data)
    user = data.get("user", {})
    print(f"Logged in user object:")
    print(f"  - id: {user.get('id')}")
    print(f"  - username: {user.get('username')}")
    print(f"  - role: {user.get('role')}")
    print(f"  - doctorId: {user.get('doctorId')}")
    print(f"  - doctor_id: {user.get('doctor_id')}")
    print(f"  - name: '{user.get('name')}'")
    print(f"  - display_name: '{user.get('display_name')}'")

if __name__ == "__main__":
    test_login_dr_moorthy()
