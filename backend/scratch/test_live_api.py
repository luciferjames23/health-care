import urllib.request
import json

BASE = "http://127.0.0.1:8000/api/v1/admin"

def test_api(role, username, user_name):
    # 1. Count
    q_params = []
    if role: q_params.append(f"role={urllib.parse.quote(role)}")
    if username: q_params.append(f"username={urllib.parse.quote(username)}")
    if user_name: q_params.append(f"user_name={urllib.parse.quote(user_name)}")
    qs = f"?{'&'.join(q_params)}" if q_params else ""

    url_count = f"{BASE}/notifications/count{qs}"
    req = urllib.request.Request(url_count)
    with urllib.request.urlopen(req) as resp:
        cnt_data = json.loads(resp.read().decode())

    # 2. List
    url_list = f"{BASE}/notifications{qs}&limit=50" if qs else f"{BASE}/notifications?limit=50"
    req_l = urllib.request.Request(url_list)
    with urllib.request.urlopen(req_l) as resp:
        list_data = json.loads(resp.read().decode())

    leaves = [item for item in list_data.get('data', []) if 'LEAVE-' in item.get('id', '')]
    leaves_desc = [f"{l['patient_name']} ({l['title']})" for l in leaves]

    print(f"\nUser: {user_name} | Role: {role} | Username: {username}")
    print(f"  Count API -> unread: {cnt_data.get('unread_count')}, critical: {cnt_data.get('critical_count')}, leaves: {cnt_data.get('leave_count')}, total: {cnt_data.get('total')}")
    print(f"  List API  -> returned: {len(list_data.get('data', []))} items | leaves returned: {len(leaves)} -> {leaves_desc}")

print("=== LIVE FASTAPI ENDPOINT TESTS ===")
test_api("Hospital Management", "admin", "System Admin")
test_api("Doctor", "doctor_32", "Dr. Venkat Reddy - Surgeon")
test_api("Doctor", "doctor_1", "Dr. Priya Patel")
test_api("Doctor", "doctor_4", "Dr. Vikram Singh")
test_api("Nurse", "nurse.priya", "Nurse Priya Narayanan")
test_api("Nurse", "anitha.kumar", "Nurse Anitha Kumar")
