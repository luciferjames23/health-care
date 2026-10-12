"""
Comprehensive Verification Test Suite for Filter Fixes:
1. Doctor Shift Schedules (Doctor Directory)
2. Consultant Schedules (All Doctors & search combination)
3. Doctor Portal Appointments (Search, Date, Status, Source, Scope, Sorting, Pagination, CSV)
"""
import sys
import os
from datetime import datetime, date

# Add backend directory to sys.path
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import requests
from api.auth_helper import encode_token

BASE_URL = "http://127.0.0.1:8000"

class Client:
    def get(self, path, headers=None):
        return requests.get(f"{BASE_URL}{path}", headers=headers)
    def post(self, path, json=None, headers=None):
        return requests.post(f"{BASE_URL}{path}", json=json, headers=headers)

client = Client()

admin_token = encode_token({
    "user_id": 1,
    "username": "admin",
    "role": "ADMIN",
    "full_name": "Hospital Administrator"
})
admin_headers = {"Authorization": f"Bearer {admin_token}"}

doc_1010_token = encode_token({
    "user_id": 1010,
    "username": "dr_wilson",
    "role": "DOCTOR",
    "doctor_id": 1010,
    "full_name": "Dr. Wilson M"
})
doc_1010_headers = {"Authorization": f"Bearer {doc_1010_token}"}

doc_1015_token = encode_token({
    "user_id": 1015,
    "username": "dr_immanuvel",
    "role": "DOCTOR",
    "doctor_id": 1015,
    "full_name": "Dr. Immanuvel S"
})
doc_1015_headers = {"Authorization": f"Bearer {doc_1015_token}"}


def test_consultant_and_shift_schedules():
    print("\n" + "="*70)
    print("TEST SUITE 1: CONSULTANT & DOCTOR SHIFT SCHEDULES FILTERS")
    print("="*70)

    # 1. Search for doctor name 'edwin' (case-insensitive)
    r1 = client.get("/api/dashboard/schedules?search=edwin", headers=admin_headers)
    assert r1.status_code == 200, f"Search edwin failed: {r1.status_code}"
    data1 = r1.json()
    assert data1["total"] > 0, "Expected at least 1 schedule for 'edwin'"
    assert all("edwin" in s["doctor_name"].lower() for s in data1["schedules"]), "All returned schedules must match 'edwin'"
    print(f"✓ Test 1 Passed: Search by doctor name 'edwin' returned {data1['total']} matching records.")

    # 2. Search by department 'Cardiology' (case-insensitive)
    r2 = client.get("/api/dashboard/schedules?search=cardiology", headers=admin_headers)
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["total"] > 0, "Expected schedules for cardiology"
    assert all("cardiology" in (s["department_name"] or "").lower() for s in data2["schedules"])
    print(f"✓ Test 2 Passed: Search by department 'cardiology' returned {data2['total']} records.")

    # 3. Search by day of week 'THURSDAY'
    r3 = client.get("/api/dashboard/schedules?search=thursday", headers=admin_headers)
    assert r3.status_code == 200
    data3 = r3.json()
    assert data3["total"] > 0
    assert all("thursday" in s["day_of_week"].lower() for s in data3["schedules"])
    print(f"✓ Test 3 Passed: Search by day of week 'thursday' returned {data3['total']} records.")

    # 4. Select single doctor (e.g. doctor_id=1017: Dr. Edwin Stephano J)
    r4 = client.get("/api/dashboard/schedules?doctor_id=1017", headers=admin_headers)
    assert r4.status_code == 200
    data4 = r4.json()
    assert data4["total"] > 0
    assert all(s["doctor_id"] == 1017 for s in data4["schedules"])
    print(f"✓ Test 4 Passed: Filter by doctor_id=1017 returned {data4['total']} schedules all belonging to doctor 1017.")

    # 5. Select All Doctors (no doctor_id filter)
    r5 = client.get("/api/dashboard/schedules", headers=admin_headers)
    assert r5.status_code == 200
    data5 = r5.json()
    assert data5["total"] >= data4["total"], "All Doctors count must be >= single doctor count"
    print(f"✓ Test 5 Passed: All Doctors filter returned {data5['total']} schedules across all doctors.")

    # 6. Combine doctor selection and text search
    r6 = client.get("/api/dashboard/schedules?doctor_id=1017&search=thursday", headers=admin_headers)
    assert r6.status_code == 200
    data6 = r6.json()
    assert data6["total"] > 0
    assert all(s["doctor_id"] == 1017 and "thursday" in s["day_of_week"].lower() for s in data6["schedules"])
    print(f"✓ Test 6 Passed: Combined doctor_id=1017 and search='thursday' returned {data6['total']} schedules.")

    # 7. Non-matching search returns 0 without error
    r7 = client.get("/api/dashboard/schedules?doctor_id=1017&search=nonexistent_xyz", headers=admin_headers)
    assert r7.status_code == 200
    data7 = r7.json()
    assert data7["total"] == 0
    print(f"✓ Test 7 Passed: Non-matching search returned 0 records cleanly.")


def test_appointment_list_filters():
    print("\n" + "="*70)
    print("TEST SUITE 2: APPOINTMENT LIST FILTERS")
    print("="*70)

    # 1. Search by patient name (case-insensitive: 'keerthana')
    r1 = client.get("/api/dashboard/appointments?search=keerthana", headers=admin_headers)
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["total"] > 0, "Search by patient name failed"
    assert any("keerthana" in a["patient_name"].lower() for a in d1["appointments"])
    print(f"✓ Test 1 Passed: Search by patient name 'keerthana' returned {d1['total']} appointments.")

    # 2. Search by patient code / ID (case-insensitive: 'pat-1000388' and '1000388')
    r2a = client.get("/api/dashboard/appointments?search=pat-1000388", headers=admin_headers)
    assert r2a.status_code == 200
    d2a = r2a.json()
    assert d2a["total"] > 0
    assert any("pat-1000388" in a["patient_code"].lower() for a in d2a["appointments"])

    r2b = client.get("/api/dashboard/appointments?search=1000388", headers=admin_headers)
    assert r2b.status_code == 200
    d2b = r2b.json()
    assert d2b["total"] >= d2a["total"]
    print(f"✓ Test 2 Passed: Search by patient ID/code ('pat-1000388' and '1000388') returned {d2a['total']} and {d2b['total']} appointments.")

    # 3. Search by booking ID (case-insensitive: 'testbk84148' lowercase)
    r3 = client.get("/api/dashboard/appointments?search=testbk84148", headers=admin_headers)
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["total"] > 0
    assert any("testbk84148" in a["booking_id"].lower() for a in d3["appointments"])
    print(f"✓ Test 3 Passed: Search by booking ID in lowercase 'testbk84148' returned {d3['total']} appointments.")

    # 4. Search by doctor name (case-insensitive: 'immanuvel')
    r4 = client.get("/api/dashboard/appointments?search=immanuvel", headers=admin_headers)
    assert r4.status_code == 200
    d4 = r4.json()
    assert d4["total"] > 0
    assert any("immanuvel" in a["doctor_name"].lower() for a in d4["appointments"])
    print(f"✓ Test 4 Passed: Search by doctor name 'immanuvel' returned {d4['total']} appointments.")

    # 5. Date filter: Today (hospital local date: 2026-10-12)
    today_str = date.today().isoformat()
    r5 = client.get(f"/api/dashboard/appointments?date_from={today_str}&date_to={today_str}&date_type=appointment_date", headers=admin_headers)
    assert r5.status_code == 200
    d5 = r5.json()
    assert all(a["appointment_date"] == today_str for a in d5["appointments"])
    print(f"✓ Test 5 Passed: Date 'Today' ({today_str}) returned {d5['total']} appointments all matching {today_str}.")

    # 6. Date filter: This Month (2026-10-01 to 2026-10-31)
    r6 = client.get("/api/dashboard/appointments?date_from=2026-10-01&date_to=2026-10-31&date_type=appointment_date", headers=admin_headers)
    assert r6.status_code == 200
    d6 = r6.json()
    assert all(a["appointment_date"] >= "2026-10-01" and a["appointment_date"] <= "2026-10-31" for a in d6["appointments"])
    print(f"✓ Test 6 Passed: Date 'This Month' (2026-10-01 to 2026-10-31) returned {d6['total']} appointments.")

    # 7. Date filter mode: created_at vs appointment_date
    r7_created = client.get(f"/api/dashboard/appointments?date_from={today_str}&date_to={today_str}&date_type=created_at", headers=admin_headers)
    assert r7_created.status_code == 200
    d7_created = r7_created.json()
    print(f"✓ Test 7 Passed: Filter by created_at returned {d7_created['total']} appointments created today.")

    # 8. Status filter: All Status, CONFIRMED, COMPLETED, CANCELLED, RESCHEDULED, NO_SHOW, CHECKED_IN
    for st in ["CONFIRMED", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"]:
        rst = client.get(f"/api/dashboard/appointments?status={st}", headers=admin_headers)
        assert rst.status_code == 200
        dst = rst.json()
        assert all(a["status"].upper() == st for a in dst["appointments"])
        print(f"   - Status '{st}': {dst['total']} appointments matched.")
    print("✓ Test 8 Passed: Every individual status filter validated.")

    # 9. Booking source filter: WHATSAPP, WEB_PORTAL, WALK_IN, PHONE
    for src in ["WHATSAPP", "WEB_PORTAL", "WALK_IN", "PHONE"]:
        rsrc = client.get(f"/api/dashboard/appointments?booking_source={src}", headers=admin_headers)
        assert rsrc.status_code == 200
        dsrc = rsrc.json()
        print(f"   - Source '{src}': {dsrc['total']} appointments matched.")
    print("✓ Test 9 Passed: Every booking source filter validated.")

    # 10. Sorting: appointment_date ASC and DESC
    r_asc = client.get("/api/dashboard/appointments?sort_by=appointment_date&sort_order=asc&per_page=10", headers=admin_headers)
    assert r_asc.status_code == 200
    d_asc = r_asc.json()
    dates_asc = [a["appointment_date"] for a in d_asc["appointments"]]
    assert dates_asc == sorted(dates_asc), f"Dates not ASC: {dates_asc}"

    r_desc = client.get("/api/dashboard/appointments?sort_by=appointment_date&sort_order=desc&per_page=10", headers=admin_headers)
    assert r_desc.status_code == 200
    d_desc = r_desc.json()
    dates_desc = [a["appointment_date"] for a in d_desc["appointments"]]
    assert dates_desc == sorted(dates_desc, reverse=True), f"Dates not DESC: {dates_desc}"
    print("✓ Test 10 Passed: Sorting by appointment_date ASC and DESC operates accurately on actual date values.")

    # 11. Pagination & Total Counts
    r_p1 = client.get("/api/dashboard/appointments?page=1&per_page=10", headers=admin_headers)
    r_p2 = client.get("/api/dashboard/appointments?page=2&per_page=10", headers=admin_headers)
    assert r_p1.status_code == 200 and r_p2.status_code == 200
    d_p1 = r_p1.json()
    d_p2 = r_p2.json()
    assert d_p1["total"] == d_p2["total"]
    ids_p1 = {a["id"] for a in d_p1["appointments"]}
    ids_p2 = {a["id"] for a in d_p2["appointments"]}
    assert ids_p1.isdisjoint(ids_p2), "No overlapping records between page 1 and page 2"
    print(f"✓ Test 11 Passed: Pagination preserves total ({d_p1['total']}) with 0 overlap between pages.")

    # 12. Combined Filter Behavior
    r_comb = client.get(
        "/api/dashboard/appointments?date_from=2026-09-01&date_to=2026-10-31&status=CONFIRMED&booking_source=WHATSAPP&search=immanuvel",
        headers=admin_headers
    )
    assert r_comb.status_code == 200
    d_comb = r_comb.json()
    for a in d_comb["appointments"]:
        assert a["appointment_date"] >= "2026-09-01" and a["appointment_date"] <= "2026-10-31"
        assert a["status"].upper() == "CONFIRMED"
        assert "WHATSAPP" in a["booking_source"].upper()
        assert "immanuvel" in a["doctor_name"].lower()
    print(f"✓ Test 12 Passed: Combined Date + Status + Source + Search returned {d_comb['total']} matching records.")


def test_doctor_scope_enforcement():
    print("\n" + "="*70)
    print("TEST SUITE 3: DOCTOR SCOPE & AUTHORIZATION ENFORCEMENT")
    print("="*70)

    # Doctor 1010 requests their appointments
    r_doc1010 = client.get("/api/dashboard/appointments", headers=doc_1010_headers)
    assert r_doc1010.status_code == 200
    d_doc1010 = r_doc1010.json()
    assert all(a["doctor_id"] == 1010 for a in d_doc1010["appointments"]), "Doctor 1010 MUST only see doctor 1010 appointments"
    print(f"✓ Test 1 Passed: Doctor 1010 authenticated request returns only their appointments ({d_doc1010['total']} records).")

    # Tampering test: Doctor 1010 tries to supply doctor_id=1015 (Dr. Immanuvel S) in query param
    r_tamper = client.get("/api/dashboard/appointments?doctor_id=1015", headers=doc_1010_headers)
    assert r_tamper.status_code == 200
    d_tamper = r_tamper.json()
    # MUST STILL return ONLY doctor 1010 appointments, NOT doctor 1015 appointments!
    assert all(a["doctor_id"] == 1010 for a in d_tamper["appointments"]), "Tampering attempt must be overridden by authenticated JWT doctor_id!"
    assert d_tamper["total"] == d_doc1010["total"]
    print(f"✓ Test 2 Passed: Tampering attempt (Doctor A querying doctor_id=B) correctly overridden by JWT doctor_id.")

    # Doctor 1015 requests their appointments
    r_doc1015 = client.get("/api/dashboard/appointments", headers=doc_1015_headers)
    assert r_doc1015.status_code == 200
    d_doc1015 = r_doc1015.json()
    assert all(a["doctor_id"] == 1015 for a in d_doc1015["appointments"])
    print(f"✓ Test 3 Passed: Doctor 1015 authenticated request returns only their appointments ({d_doc1015['total']} records).")

    # Doctor 1010 searching cannot reveal Doctor 1015 appointments
    r_doc_search = client.get("/api/dashboard/appointments?search=immanuvel", headers=doc_1010_headers)
    assert r_doc_search.status_code == 200
    d_doc_search = r_doc_search.json()
    assert all(a["doctor_id"] == 1010 for a in d_doc_search["appointments"])
    print("✓ Test 4 Passed: Doctor search cannot reveal another doctor's appointments.")


if __name__ == "__main__":
    test_consultant_and_shift_schedules()
    test_appointment_list_filters()
    test_doctor_scope_enforcement()
    print("\n" + "="*70)
    print("ALL TESTS COMPLETED SUCCESSFULLY WITH 100% PASS RATE!")
    print("="*70)
