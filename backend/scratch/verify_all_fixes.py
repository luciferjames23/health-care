"""
Comprehensive Verification Suite for Schedule Deduplication, Filters, and Queue Statistics
=============================================================================================
Runs against real PostgreSQL database and FastAPI endpoints.
"""

import sys
import os
import datetime

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import requests
import db_config
import services.queue_service as queue_service
import appointment_service

BASE_URL = "http://127.0.0.1:8000"

class ClientWrapper:
    def get(self, path, **kwargs):
        return requests.get(f"{BASE_URL}{path}", **kwargs)
    def post(self, path, **kwargs):
        return requests.post(f"{BASE_URL}{path}", **kwargs)
    def put(self, path, **kwargs):
        return requests.put(f"{BASE_URL}{path}", **kwargs)
    def patch(self, path, **kwargs):
        return requests.patch(f"{BASE_URL}{path}", **kwargs)
    def delete(self, path, **kwargs):
        return requests.delete(f"{BASE_URL}{path}", **kwargs)

client = ClientWrapper()

def run_tests():
    print("==================================================================")
    print("STARTING REAL BACKEND & DATABASE TESTS")
    print("==================================================================")

    # ── Test 1: Schedule Listing & Doctor Filter ─────────────────────────────
    print("\n[TEST 1] Testing Schedule Listing & Doctor Filters...")
    admin_headers = {"Authorization": "Bearer demo-session-token"}

    # Clean up any leftover test shift from previous run
    res_pre = client.get("/api/dashboard/schedules?doctor_id=28", headers=admin_headers)
    for s in res_pre.json().get("schedules", []):
        if s["day_of_week"] == "MONDAY" and s["start_time"] == "17:00":
            client.delete(f"/api/dashboard/schedules/{s['id']}", headers=admin_headers)

    # All Doctors
    res_all = client.get("/api/dashboard/schedules", headers=admin_headers)
    assert res_all.status_code == 200, f"Expected 200, got {res_all.status_code}: {res_all.text}"
    data_all = res_all.json()
    all_schedules = data_all.get("schedules", [])
    total_count = data_all.get("total", 0)
    print(f"[PASS] All Doctors schedules count: {total_count} (Total records: {len(all_schedules)})")
    assert total_count > 0, "Expected non-zero schedules count"

    # Specific Doctor: Dr. Dragon Gupta (ID: 28)
    res_doc28 = client.get("/api/dashboard/schedules?doctor_id=28", headers=admin_headers)
    assert res_doc28.status_code == 200, f"Expected 200, got {res_doc28.status_code}: {res_doc28.text}"
    data_doc28 = res_doc28.json()
    doc28_schedules = data_doc28.get("schedules", [])
    print(f"[PASS] Doctor 28 schedules count: {data_doc28.get('total')} (Records: {len(doc28_schedules)})")
    for s in doc28_schedules:
        assert s["doctor_id"] == 28, f"Expected doctor_id 28, found {s['doctor_id']}"
        assert s["status"] in ("ACTIVE", "ON_LEAVE"), f"Expected ACTIVE/ON_LEAVE, found {s['status']}"
        print(f"   Schedule #{s['id']}: {s['day_of_week']} {s['start_time']}-{s['end_time']} ({s['slot_duration_minutes']} min, {s['status']})")

    # Verify no duplicates among Dr. Dragon Gupta's Monday schedules
    monday_shifts = [s for s in doc28_schedules if s["day_of_week"] == "MONDAY"]
    print(f"[PASS] Dr. Dragon Gupta Monday shifts remaining after reconciliation: {len(monday_shifts)}")
    assert len(monday_shifts) == 1, f"Expected exactly 1 active Monday shift for Dr. Dragon Gupta, found {len(monday_shifts)}"
    assert monday_shifts[0]["start_time"] == "09:00" and monday_shifts[0]["end_time"] == "17:00", f"Unexpected times: {monday_shifts[0]}"

    # ── Test 2: Duplicate Schedule Prevention ────────────────────────────────
    print("\n[TEST 2] Testing Duplicate Schedule Rejection...")
    dup_payload = {
        "doctor_id": 28,
        "day_of_week": "MONDAY",
        "start_time": "09:00",
        "end_time": "17:00",
        "slot_duration_minutes": 30,
        "status": "ACTIVE"
    }
    res_dup = client.post("/api/dashboard/schedules", json=dup_payload, headers=admin_headers)
    assert res_dup.status_code == 400, f"Expected 400 for duplicate, got {res_dup.status_code}: {res_dup.text}"
    print(f"[PASS] Duplicate schedule correctly rejected: {res_dup.json().get('detail')}")

    # ── Test 3: Overlapping Schedule Prevention ──────────────────────────────
    print("\n[TEST 3] Testing Overlapping Schedule Rejection...")
    overlap_payloads = [
        {"doctor_id": 28, "day_of_week": "MONDAY", "start_time": "10:00", "end_time": "16:00", "slot_duration_minutes": 30},
        {"doctor_id": 28, "day_of_week": "MONDAY", "start_time": "08:00", "end_time": "12:00", "slot_duration_minutes": 30},
        {"doctor_id": 28, "day_of_week": "MONDAY", "start_time": "15:00", "end_time": "19:00", "slot_duration_minutes": 30},
        {"doctor_id": 28, "day_of_week": "MONDAY", "start_time": "08:00", "end_time": "18:00", "slot_duration_minutes": 30},
    ]
    for p in overlap_payloads:
        res_ov = client.post("/api/dashboard/schedules", json=p, headers=admin_headers)
        assert res_ov.status_code == 400, f"Expected 400 for overlap {p}, got {res_ov.status_code}: {res_ov.text}"
        print(f"[PASS] Overlap {p['start_time']}-{p['end_time']} correctly rejected: {res_ov.json().get('detail')}")

    # ── Test 4: Invalid Shift Times (start >= end) ───────────────────────────
    print("\n[TEST 4] Testing Invalid Shift Times...")
    invalid_time_payload = {
        "doctor_id": 28,
        "day_of_week": "WEDNESDAY",
        "start_time": "17:00",
        "end_time": "09:00",
        "slot_duration_minutes": 30
    }
    res_inv = client.post("/api/dashboard/schedules", json=invalid_time_payload, headers=admin_headers)
    assert res_inv.status_code == 400, f"Expected 400, got {res_inv.status_code}: {res_inv.text}"
    print(f"[PASS] Invalid shift times correctly rejected: {res_inv.json().get('detail')}")

    # ── Test 5: Legitimate Contiguous / Adjacent Shift ───────────────────────
    print("\n[TEST 5] Testing Legitimate Contiguous Shift...")
    # Dr. Dragon Gupta has Monday 09:00-17:00. Create adjacent evening shift 17:00-20:00:
    adjacent_payload = {
        "doctor_id": 28,
        "day_of_week": "MONDAY",
        "start_time": "17:00",
        "end_time": "20:00",
        "slot_duration_minutes": 30,
        "status": "ACTIVE"
    }
    res_adj = client.post("/api/dashboard/schedules", json=adjacent_payload, headers=admin_headers)
    assert res_adj.status_code == 200, f"Expected 200 for contiguous shift, got {res_adj.status_code}: {res_adj.text}"
    adj_sched_id = res_adj.json().get("schedule_id")
    print(f"[PASS] Contiguous shift successfully created with ID {adj_sched_id}: {res_adj.json().get('message')}")

    # Verify both shifts are listed for Doctor 28
    res_both = client.get("/api/dashboard/schedules?doctor_id=28", headers=admin_headers)
    monday_shifts_now = [s for s in res_both.json()["schedules"] if s["day_of_week"] == "MONDAY"]
    assert len(monday_shifts_now) == 2, f"Expected 2 contiguous Monday shifts, found {len(monday_shifts_now)}"
    print(f"[PASS] Both adjacent shifts successfully present: {[s['start_time'] + '-' + s['end_time'] for s in monday_shifts_now]}")

    # ── Test 6: Slot Generation across Contiguous Shifts (No Boundary Duplication) ──
    print("\n[TEST 6] Testing Slot Generation Across Adjacent Shifts...")
    next_monday = (datetime.date.today() + datetime.timedelta(days=(0 - datetime.date.today().weekday()) % 7))
    if next_monday == datetime.date.today():
        next_monday += datetime.timedelta(days=7)
    next_monday_str = next_monday.isoformat()

    available_slots = appointment_service.get_available_slots(28, next_monday_str)
    print(f"[PASS] Available slots count for next Monday ({next_monday_str}): {len(available_slots)}")
    # Verify 17:00 appears once, 16:30 is in shift 1, 17:00 is first slot in shift 2
    assert "16:30" in available_slots, "Expected 16:30 slot in shift 1"
    assert "17:00" in available_slots, "Expected 17:00 slot in shift 2"
    assert "19:30" in available_slots, "Expected 19:30 slot in shift 2"
    assert len(available_slots) == len(set(available_slots)), "Duplicate slot detected across boundaries!"
    print("[PASS] Verified: No duplicate slots generated across adjacent shift boundaries.")

    # ── Test 7: Clean up contiguous test shift ────────────────────────────────
    print("\n[TEST 7] Cleaning up contiguous test shift...")
    res_del = client.delete(f"/api/dashboard/schedules/{adj_sched_id}", headers=admin_headers)
    assert res_del.status_code == 200, f"Expected 200 on delete, got {res_del.status_code}"
    print(f"[PASS] Test schedule #{adj_sched_id} deleted successfully.")

    # ── Test 8: Today's Queue API & Statistics ───────────────────────────────
    print("\n[TEST 8] Testing Today's Queue API & Derived Statistics...")
    res_q = client.get("/api/queue/doctor/today?doctor_id=28", headers=admin_headers)
    assert res_q.status_code == 200, f"Expected 200, got {res_q.status_code}: {res_q.text}"
    q_data = res_q.json().get("data", {})
    session_data = q_data.get("session")
    print(f"[PASS] Doctor 28 Queue Session: {session_data.get('session_id') if session_data else 'None'}, Status: {session_data.get('status') if session_data else 'None'}")
    assert session_data is not None, "Expected active session 11 for Doctor 28 today"
    assert session_data["status"] == "ACTIVE"
    print("   Total Checked In:", session_data["total_checked_in"])
    print("   Waiting:", session_data["waiting_count"])
    print("   Called:", session_data["called_count"])
    print("   In Consultation:", session_data["in_consultation_count"])
    print("   Completed:", session_data["completed_count"])
    print("   No Show:", session_data["no_show_count"])
    assert session_data["total_checked_in"] == len(session_data["entries"])
    assert session_data["completed_count"] >= 1

    # ── Test 9: Doctor-level Authorization (Server-side Enforced) ────────────
    print("\n[TEST 9] Testing Doctor Role Authorization Scoping...")
    # Generate doctor token for Doctor 28
    from api.auth_helper import encode_token
    doc_token = encode_token({"user_id": 28, "username": "doctor_28", "role": "DOCTOR", "doctor_id": 28})
    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    # Doctor requesting with doctor_id=1018 in query params: server-side MUST ignore/enforce doctor 28
    res_doc_auth = client.get("/api/queue/doctor/today?doctor_id=1018", headers=doc_headers)
    assert res_doc_auth.status_code == 200
    doc_q_data = res_doc_auth.json().get("data", {})
    assert doc_q_data.get("doctor_info", {}).get("doctor_id") == 28, f"Doctor isolation failed: returned {doc_q_data.get('doctor_info')}"
    print("[PASS] Server-side Doctor scoping verified: Doctor 28 cannot access another doctor's queue via parameter tampering.")

    print("\n==================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
