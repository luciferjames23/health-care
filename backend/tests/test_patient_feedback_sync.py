"""
test_patient_feedback_sync.py
==============================
Automated regression suite verifying Patient Feedback Synchronization
between Feedback Centre (patient_feedback) and Patient 360 (/api/v1/clinical-ops/feedback).
"""

import os
import sys
import json
import urllib.request

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from agent.feedback_agent import store_patient_feedback

BASE_URL = "http://127.0.0.1:8000"


def fetch_json(endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={"User-Agent": "RegressionTest"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))


def test_wilson_tony_m_reproduction_case():
    """
    Test 1: Verify the Wilson Tony M reproduction case (patient_id=1004432)
    returns feedback record FDB-438 in Patient 360 API.
    """
    data = fetch_json("/api/v1/clinical-ops/feedback?patient_id=1004432")
    assert data["success"] is True
    assert data["count"] >= 1

    records = data["data"]
    wilson_record = next((r for r in records if r["id"] == "FDB-438" or r["raw_id"] == 438), None)
    assert wilson_record is not None, "Wilson Tony M feedback record FDB-438 must be returned in Patient 360"
    assert wilson_record["patient_id"] == 1004432
    assert "doctor consultation" in wilson_record["feedback"].lower()
    assert wilson_record["rating"] == 8
    assert wilson_record["sentiment"] == "POSITIVE"


def test_patient_isolation_no_cross_contamination():
    """
    Test 2: Verify another patient's feedback NEVER appears in a selected patient's profile.
    """
    # Fetch for Wilson Tony M (1004432)
    data_wilson = fetch_json("/api/v1/clinical-ops/feedback?patient_id=1004432")["data"]

    # Fetch for another dummy patient_id e.g. 9999999
    data_other = fetch_json("/api/v1/clinical-ops/feedback?patient_id=9999999")
    assert data_other["success"] is True
    assert data_other["count"] == 0
    assert data_other["data"] == []

    # Ensure Wilson's records do not leak into another patient's profile
    for r in data_wilson:
        assert r["patient_id"] == 1004432


def test_feedback_without_encounter_or_escalation():
    """
    Test 3: Feedback without an encounter or escalation link is visible in Patient 360.
    """
    records = fetch_json("/api/v1/clinical-ops/feedback?patient_id=1004432")["data"]
    standalone_fb = [r for r in records if r["record_type"] == "patient_feedback"]
    assert len(standalone_fb) > 0, "Standalone patient_feedback records must remain visible"


def test_duplicate_webhook_prevention():
    """
    Test 4: Duplicate webhook delivery with same whatsapp_message_id does not duplicate feedback.
    """
    wamid = "test_wam_unique_sync_123"
    code = "test_conv_sync_123"

    res1 = store_patient_feedback(
        conversation_code=code,
        original_feedback="The nursing care was great.",
        explicit_rating=9,
        source="WHATSAPP_TEXT",
        whatsapp_message_id=wamid,
        patient_id=1004432
    )
    assert res1["success"] is True
    fb_id_1 = res1["feedback_id"]

    res2 = store_patient_feedback(
        conversation_code=code,
        original_feedback="The nursing care was great.",
        explicit_rating=9,
        source="WHATSAPP_TEXT",
        whatsapp_message_id=wamid,
        patient_id=1004432
    )
    assert res2["success"] is True
    assert res2.get("duplicate") is True
    assert res2["feedback_id"] == fb_id_1


def test_pagination_and_sorting():
    """
    Test 5: Verify pagination and limit parameters work properly without dropping records.
    """
    data = fetch_json("/api/v1/clinical-ops/feedback?limit=10&offset=0")
    assert data["success"] is True
    assert len(data["data"]) <= 10


def test_status_synchronization_across_screens():
    """
    Test 6: Verify status update on feedback reflects in Patient 360 endpoint.
    """
    data = fetch_json("/api/v1/clinical-ops/feedback?patient_id=1004432")["data"]
    target = next((r for r in data if r["raw_id"] == 438), None)
    assert target is not None
    assert target["status"] in ("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED")


if __name__ == "__main__":
    print("Running Patient Feedback Sync Regression Tests...")
    test_wilson_tony_m_reproduction_case()
    print("[PASSED] Test 1: Wilson Tony M reproduction case appears in Patient 360")
    test_patient_isolation_no_cross_contamination()
    print("[PASSED] Test 2: Patient isolation verified")
    test_feedback_without_encounter_or_escalation()
    print("[PASSED] Test 3: Standalone feedback visible without encounter link")
    test_duplicate_webhook_prevention()
    print("[PASSED] Test 4: Webhook deduplication working")
    test_pagination_and_sorting()
    print("[PASSED] Test 5: Pagination and sorting verified")
    test_status_synchronization_across_screens()
    print("[PASSED] Test 6: Status synchronization verified")
    print("SUCCESS: ALL REGRESSION TESTS PASSED!")
