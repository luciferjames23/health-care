"""
End-to-end test of the notification and alert system.
Tests: route order, role filtering, field names, count API, mark-read flow.
"""
import sys
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.path.insert(0, r'e:\Bosco-projects\POC\Health-care\code\health-care\backend')

from fastapi.testclient import TestClient
sys.path.insert(0, r'e:\Bosco-projects\POC\Health-care\code\health-care\backend')

# Import the router
from routers.admin_system import router
from fastapi import FastAPI
app = FastAPI()
app.include_router(router)
client = TestClient(app)

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results = []

def check(name, condition, detail=""):
    status = PASS if condition else FAIL
    results.append((name, condition))
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))

print("\n=== NOTIFICATION SYSTEM END-TO-END TESTS ===\n")

# ─────────────────────────────────────────────────────────────
# TEST 1: /count route (must NOT be caught by /{notif_id}/read)
# ─────────────────────────────────────────────────────────────
print("1. Route Order Test: /notifications/count not swallowed by /{notif_id}")
resp = client.get("/api/v1/admin/notifications/count")
check("  GET /notifications/count returns 200", resp.status_code == 200, f"status={resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    check("  Response has unread_count field", 'unread_count' in data, str(data.keys()))
    check("  Response has critical_count field", 'critical_count' in data)
    check("  unread_count is int >= 0", isinstance(data.get('unread_count'), int) and data.get('unread_count') >= 0, str(data.get('unread_count')))
    print(f"     unread_count={data.get('unread_count')}, critical_count={data.get('critical_count')}, total={data.get('total')}")

# ─────────────────────────────────────────────────────────────
# TEST 2: /notifications endpoint field names
# ─────────────────────────────────────────────────────────────
print("\n2. Notification Field Names Test")
resp = client.get("/api/v1/admin/notifications?limit=5")
check("  GET /notifications returns 200", resp.status_code == 200, f"status={resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    check("  Response has success=True", data.get('success') is True)
    check("  Response has unread_count", 'unread_count' in data, str(data.keys()))
    check("  Response has critical_count", 'critical_count' in data)
    items = data.get('data', [])
    check("  data array is present", isinstance(items, list))
    if items:
        item = items[0]
        print(f"     Sample item keys: {list(item.keys())}")
        check("  Item has 'priority' field (not 'pri' only)", 'priority' in item, f"keys={list(item.keys())}")
        check("  Item has 'status' field (not 'state' only)", 'status' in item)
        check("  Item has 'message' field (not 'detail' only)", 'message' in item)
        check("  Item has 'title' field", 'title' in item)
        check("  Item has 'type' field", 'type' in item)
        check("  Item has 'patient_id' field", 'patient_id' in item)
        check("  Item has 'patient_name' field", 'patient_name' in item)
        check("  Item has 'created_at' field", 'created_at' in item)
        check("  Item has 'id' field", 'id' in item)
        # Verify priority is UPPERCASE standard value
        valid_priorities = {'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'}
        check("  priority is uppercase standard value", item.get('priority') in valid_priorities, f"priority={item.get('priority')}")
        # Verify status is UPPERCASE standard value
        valid_statuses = {'UNREAD', 'READ'}
        check("  status is UNREAD or READ", item.get('status') in valid_statuses, f"status={item.get('status')}")
        # Legacy fields should also be present for backward compat
        check("  Legacy 'pri' still present (backward compat)", 'pri' in item)
        check("  Legacy 'unread' bool still present (backward compat)", 'unread' in item)

# ─────────────────────────────────────────────────────────────
# TEST 3: Role-based filtering
# ─────────────────────────────────────────────────────────────
print("\n3. Role-Based Notification Filtering")

# Hospital Management = should see everything including escalations
resp_mgmt = client.get("/api/v1/admin/notifications?role=Hospital+Management&limit=100")
check("  Hospital Management: 200 OK", resp_mgmt.status_code == 200)
mgmt_data = resp_mgmt.json() if resp_mgmt.status_code == 200 else {}
mgmt_count = len(mgmt_data.get('data', []))
mgmt_escs = [x for x in mgmt_data.get('data', []) if x.get('type') == 'ESCALATION']
print(f"     Hospital Management: {mgmt_count} total, {len(mgmt_escs)} escalations")
check("  Hospital Management sees escalations", len(mgmt_escs) > 0, f"escalations={len(mgmt_escs)}")

# Doctor = should see clinical notifications + escalations
resp_doctor = client.get("/api/v1/admin/notifications?role=Doctor&limit=100")
check("  Doctor: 200 OK", resp_doctor.status_code == 200)
doctor_data = resp_doctor.json() if resp_doctor.status_code == 200 else {}
doctor_escs = [x for x in doctor_data.get('data', []) if x.get('type') == 'ESCALATION']
print(f"     Doctor: {len(doctor_data.get('data',[]))} total, {len(doctor_escs)} escalations")
check("  Doctor sees escalations (clinical role)", len(doctor_escs) > 0, f"escalations={len(doctor_escs)}")

# Front Office = should NOT see escalations (non-clinical)
resp_fo = client.get("/api/v1/admin/notifications?role=Front+Office&limit=100")
check("  Front Office: 200 OK", resp_fo.status_code == 200)
fo_data = resp_fo.json() if resp_fo.status_code == 200 else {}
fo_escs = [x for x in fo_data.get('data', []) if x.get('type') == 'ESCALATION']
print(f"     Front Office: {len(fo_data.get('data',[]))} total, {len(fo_escs)} escalations")
check("  Front Office does NOT see escalations", len(fo_escs) == 0, f"escalations={len(fo_escs)}")

# Billing = should NOT see escalations
resp_bill = client.get("/api/v1/admin/notifications?role=Billing&limit=100")
check("  Billing: 200 OK", resp_bill.status_code == 200)
bill_data = resp_bill.json() if resp_bill.status_code == 200 else {}
bill_escs = [x for x in bill_data.get('data', []) if x.get('type') == 'ESCALATION']
check("  Billing does NOT see escalations", len(bill_escs) == 0, f"escalations={len(bill_escs)}")

# Verify roles see different content
check("  Hospital Management sees >= Doctor notifications (broader access)", mgmt_count >= len(doctor_data.get('data', [])),
      f"mgmt={mgmt_count}, doctor={len(doctor_data.get('data', []))}")

# ─────────────────────────────────────────────────────────────
# TEST 4: Unread filter
# ─────────────────────────────────────────────────────────────
print("\n4. Unread/Read Filter Test")
resp_unread = client.get("/api/v1/admin/notifications?status=unread&limit=100")
check("  status=unread filter: 200 OK", resp_unread.status_code == 200)
if resp_unread.status_code == 200:
    unread_data = resp_unread.json()
    unread_items = unread_data.get('data', [])
    # All returned items should be UNREAD
    all_unread = all(item.get('status') == 'UNREAD' or item.get('unread') is True for item in unread_items)
    check("  All returned items have status=UNREAD", all_unread, f"count={len(unread_items)}")
    print(f"     Unread notifications returned: {len(unread_items)}")

# ─────────────────────────────────────────────────────────────
# TEST 5: Priority filter
# ─────────────────────────────────────────────────────────────
print("\n5. Priority Filter Test")
resp_crit = client.get("/api/v1/admin/notifications?priority=CRITICAL&limit=100")
check("  priority=CRITICAL filter: 200 OK", resp_crit.status_code == 200)
if resp_crit.status_code == 200:
    crit_data = resp_crit.json()
    crit_items = crit_data.get('data', [])
    all_critical = all(item.get('priority') == 'CRITICAL' for item in crit_items)
    check("  All returned items have priority=CRITICAL", all_critical or len(crit_items) == 0, f"count={len(crit_items)}")

# ─────────────────────────────────────────────────────────────
# TEST 6: mark-all-read route (must not conflict with /{notif_id}/read)
# ─────────────────────────────────────────────────────────────
print("\n6. Route: /notifications/mark-all-read (POST)")
resp_mar = client.post("/api/v1/admin/notifications/mark-all-read")
check("  POST /notifications/mark-all-read returns 200", resp_mar.status_code == 200, f"status={resp_mar.status_code}")
if resp_mar.status_code == 200:
    check("  Response has success=True", resp_mar.json().get('success') is True)

# ─────────────────────────────────────────────────────────────
# TEST 7: Mark individual notification read
# ─────────────────────────────────────────────────────────────
print("\n7. Mark Individual Notification Read")
# Get a notification
resp_list = client.get("/api/v1/admin/notifications?limit=1")
if resp_list.status_code == 200 and resp_list.json().get('data'):
    notif = resp_list.json()['data'][0]
    notif_id = notif.get('id')
    print(f"     Testing with notification ID: {notif_id}")
    resp_read = client.post(f"/api/v1/admin/notifications/{notif_id}/read")
    check(f"  POST /notifications/{notif_id}/read returns 200", resp_read.status_code == 200, f"status={resp_read.status_code}")
    if resp_read.status_code == 200:
        check("  Response has success=True", resp_read.json().get('success') is True)
else:
    print("     No notifications found to test mark-read")

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
print("\n" + "="*60)
passed = sum(1 for _, ok in results if ok)
failed = sum(1 for _, ok in results if not ok)
total = len(results)
print(f"RESULTS: {passed}/{total} passed, {failed} failed")
if failed > 0:
    print("\nFailed tests:")
    for name, ok in results:
        if not ok:
            print(f"  ❌ {name}")
print("="*60)
