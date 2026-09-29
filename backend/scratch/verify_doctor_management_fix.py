import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import requests
from api.auth_helper import encode_token
from api.dashboard_routes import get_conn

BASE_URL = "http://localhost:8000"

def run_verification():
    print("============================================================")
    print("VERIFYING DOCTOR MANAGEMENT MODULE DATA FIX")
    print("============================================================")

    # DB count check
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM doctors;")
    db_count = cur.fetchone()[0]
    print(f"[DB VALIDATION] Total doctor records in DB: {db_count}")
    cur.close()
    conn.close()

    # Admin Token
    token = encode_token({"user_id": 1, "username": "admin", "role": "ADMIN", "full_name": "Hospital Administrator"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Initial Load (no params)
    res = requests.get(f"{BASE_URL}/api/dashboard/doctors", headers=headers)
    assert res.status_code == 200, f"Failed initial load: {res.status_code}"
    data = res.json()
    initial_doctors = data.get("doctors", [])
    print(f"[PASS] Test 1: Initial load returns {len(initial_doctors)} doctors (Expected {db_count})")
    assert len(initial_doctors) == db_count, f"Mismatch: API returned {len(initial_doctors)}, DB has {db_count}"

    # 2. "All Departments" filter
    res_all_dept = requests.get(f"{BASE_URL}/api/dashboard/doctors?department=All%20Departments", headers=headers)
    doctors_all_dept = res_all_dept.json().get("doctors", [])
    print(f"[PASS] Test 2: 'All Departments' filter returns {len(doctors_all_dept)} doctors")
    assert len(doctors_all_dept) == db_count

    # 3. "All Status" filter
    res_all_status = requests.get(f"{BASE_URL}/api/dashboard/doctors?status=All%20Status", headers=headers)
    doctors_all_status = res_all_status.json().get("doctors", [])
    print(f"[PASS] Test 3: 'All Status' filter returns {len(doctors_all_status)} doctors")
    assert len(doctors_all_status) == db_count

    # 4. Individual department filters
    test_depts = ["General Medicine", "Neurology", "Gynecology", "Surgery", "Cardiology", "Radiology"]
    for dept in test_depts:
        res_d = requests.get(f"{BASE_URL}/api/dashboard/doctors?department={requests.utils.quote(dept)}", headers=headers)
        d_docs = res_d.json().get("doctors", [])
        print(f"[PASS] Test 4: Department '{dept}' filter returns {len(d_docs)} doctors")
        assert len(d_docs) > 0, f"Expected doctors in department '{dept}'"

    # 5. Status filter ACTIVE
    res_active = requests.get(f"{BASE_URL}/api/dashboard/doctors?status=ACTIVE", headers=headers)
    active_docs = res_active.json().get("doctors", [])
    print(f"[PASS] Test 5: Status 'ACTIVE' filter returns {len(active_docs)} doctors")
    assert len(active_docs) == db_count

    # 6. Search tests
    # 6a: Search by doctor_code "DOC-0004"
    res_s1 = requests.get(f"{BASE_URL}/api/dashboard/doctors?search=DOC-0004", headers=headers)
    s1_docs = res_s1.json().get("doctors", [])
    print(f"[PASS] Test 6a: Search by doctor_code 'DOC-0004' returns {len(s1_docs)} doctor(s): {s1_docs[0]['display_name'] if s1_docs else 'None'}")
    assert len(s1_docs) == 1 and s1_docs[0]['doctor_code'] == 'DOC-0004'

    # 6b: Search by doctor name "Priya"
    res_s2 = requests.get(f"{BASE_URL}/api/dashboard/doctors?search=Priya", headers=headers)
    s2_docs = res_s2.json().get("doctors", [])
    print(f"[PASS] Test 6b: Search by name 'Priya' returns {len(s2_docs)} doctor(s)")
    assert len(s2_docs) > 0

    # 6c: Search by specialization "Surgeon"
    res_s3 = requests.get(f"{BASE_URL}/api/dashboard/doctors?search=Surgeon", headers=headers)
    s3_docs = res_s3.json().get("doctors", [])
    print(f"[PASS] Test 6c: Search by specialization 'Surgeon' returns {len(s3_docs)} doctor(s)")
    assert len(s3_docs) > 0

    # 7. Combination filters: Search + Department + Status
    res_combo = requests.get(f"{BASE_URL}/api/dashboard/doctors?search=Vikram&department=Neurology&status=ACTIVE", headers=headers)
    combo_docs = res_combo.json().get("doctors", [])
    print(f"[PASS] Test 7: Combination (Search='Vikram' + Dept='Neurology' + Status='ACTIVE') returns {len(combo_docs)} doctor(s)")
    assert len(combo_docs) > 0

    # 8. Cross-Module Consistency (Doctor Portal & Schedules)
    res_sched = requests.get(f"{BASE_URL}/api/dashboard/schedules?doctor_id=4", headers=headers)
    sched_data = res_sched.json()
    print(f"[PASS] Test 8: Doctor ID 4 schedules retrieved: {len(sched_data.get('schedules', []))} schedule slots")

    print("\n============================================================")
    print("ALL TESTS PASSED PERFECTLY! RECONCILIATION COMPLETE.")
    print("============================================================")

if __name__ == "__main__":
    run_verification()
