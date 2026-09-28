import requests
import json
import uuid
import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config

BASE_URL = "http://127.0.0.1:8000"

def get_active_doctor_id():
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM doctors WHERE status = 'ACTIVE' LIMIT 1;")
        row = cur.fetchone()
        return row[0] if row else 1011
    finally:
        cur.close()
        conn.close()

def test_live_chat_endpoint():
    print("=" * 70)
    print("TESTING LIVE BACKEND HTTP ENDPOINT /api/agent/chat")
    print("=" * 70)

    doc_id = get_active_doctor_id()
    doc_btn_id = f"btn_doc_{doc_id}"
    print(f"Using Active Doctor Button ID: {doc_btn_id}")

    conv_id = f"LIVE_TEST_{uuid.uuid4().hex[:8]}"

    # Step 1: Select Doctor -> Date Selection (2 options: Today, Tomorrow -> 'button')
    res1 = requests.post(f"{BASE_URL}/api/agent/chat", json={
        "conversation_id": conv_id,
        "patient_id": "P001",
        "message": "Select Doctor",
        "button_id": doc_btn_id
    }).json()
    btns1 = res1.get('interactive_buttons') or []
    print(f"\n1. Select Doctor Response: type={res1.get('interactive_type')}, btn_count={len(btns1)}")
    print(f"   Buttons: {[b['title'] for b in btns1]}")
    assert res1.get('interactive_type') == 'button', f"Expected 'button' for Date Selection, got {res1.get('interactive_type')}"
    assert len(btns1) == 2, f"Expected 2 buttons for Date Selection, got {len(btns1)}"

    # Step 2: Select 'Tomorrow' -> Available Time Slots (slot list -> 'list')
    res2 = requests.post(f"{BASE_URL}/api/agent/chat", json={
        "conversation_id": conv_id,
        "patient_id": "P001",
        "message": "Tomorrow",
        "button_id": "btn_date_tomorrow"
    }).json()
    btns2 = res2.get('interactive_buttons') or []
    print(f"2. Select Tomorrow Response: type={res2.get('interactive_type')}, btn_count={len(btns2)}")
    assert res2.get('interactive_type') == 'list', f"Expected 'list' for Time Slots, got {res2.get('interactive_type')}"

    # Step 3: Select Time Slot -> Appointment Confirmation Screen (3 options -> 'button')
    slot_id = [b['id'] for b in btns2 if b.get('id', '').startswith('btn_slot_')][0]
    res3 = requests.post(f"{BASE_URL}/api/agent/chat", json={
        "conversation_id": conv_id,
        "patient_id": "P001",
        "message": "Slot",
        "button_id": slot_id
    }).json()
    btns3 = res3.get('interactive_buttons') or []
    print(f"3. Select Slot Response: type={res3.get('interactive_type')}, btn_count={len(btns3)}")
    print(f"   Buttons: {[b['title'] for b in btns3]}")
    assert res3.get('interactive_type') == 'button', f"Expected 'button' for Confirmation, got {res3.get('interactive_type')}"
    assert len(btns3) == 3, f"Expected 3 buttons for Confirmation, got {len(btns3)}"

    # Step 4: Confirm Appointment -> Payment Method Selection (6 options -> 'list')
    res4 = requests.post(f"{BASE_URL}/api/agent/chat", json={
        "conversation_id": conv_id,
        "patient_id": "P001",
        "message": "Confirm Appointment",
        "button_id": "btn_confirm_appt"
    }).json()
    btns4 = res4.get('interactive_buttons') or []
    print(f"4. Confirm Appointment Response: type={res4.get('interactive_type')}, btn_count={len(btns4)}")
    assert res4.get('interactive_type') == 'list', f"Expected 'list' for 6 payment methods, got {res4.get('interactive_type')}"
    assert len(btns4) == 6, f"Expected 6 payment options, got {len(btns4)}"

    # Step 5: Select GPay -> Payment Confirmation Screen (SCREENSHOT SCENARIO: 3 options -> 'button')
    res5 = requests.post(f"{BASE_URL}/api/agent/chat", json={
        "conversation_id": conv_id,
        "patient_id": "P001",
        "message": "GPay",
        "button_id": "btn_pay_gpay"
    }).json()
    btns5 = res5.get('interactive_buttons') or []
    print(f"5. Payment Confirmation Response (SCREENSHOT SCENARIO):")
    print(f"   interactive_type: {res5.get('interactive_type')}")
    print(f"   interactive_buttons: {[b['title'] for b in btns5]}")
    assert res5.get('interactive_type') == 'button', f"Expected 'button' for screenshot scenario, got {res5.get('interactive_type')}"
    assert len(btns5) == 3, f"Expected 3 buttons, got {len(btns5)}"

    # Step 6: Click 'Change Payment Method' -> returns 6 payment options -> 'list'
    res6 = requests.post(f"{BASE_URL}/api/agent/chat", json={
        "conversation_id": conv_id,
        "patient_id": "P001",
        "message": "Change Payment Method",
        "button_id": "btn_pay_change"
    }).json()
    btns6 = res6.get('interactive_buttons') or []
    print(f"6. Change Payment Method Response: type={res6.get('interactive_type')}, btn_count={len(btns6)}")
    assert res6.get('interactive_type') == 'list', f"Expected 'list', got {res6.get('interactive_type')}"
    assert len(btns6) == 6, f"Expected 6 payment options, got {len(btns6)}"

    # Step 7: Select PhonePe -> Payment Confirmation Screen (3 options -> 'button')
    res7 = requests.post(f"{BASE_URL}/api/agent/chat", json={
        "conversation_id": conv_id,
        "patient_id": "P001",
        "message": "PhonePe",
        "button_id": "btn_pay_phonepe"
    }).json()
    btns7 = res7.get('interactive_buttons') or []
    print(f"7. Select PhonePe Response: type={res7.get('interactive_type')}, btn_count={len(btns7)}")
    assert res7.get('interactive_type') == 'button', f"Expected 'button', got {res7.get('interactive_type')}"

    # Step 8: Execute Payment -> success response
    pay_btn_id = [b['id'] for b in btns7 if b.get('id') == 'btn_pay_exec'][0]
    res8 = requests.post(f"{BASE_URL}/api/agent/chat", json={
        "conversation_id": conv_id,
        "patient_id": "P001",
        "message": "Pay",
        "button_id": pay_btn_id
    }).json()
    print(f"8. Execute Payment Response: response snippet='{res8.get('response')[:80]}...'")

    print("\n" + "=" * 70)
    print("ALL LIVE ENDPOINT TESTS PASSED 100% SUCCESSFULLY! ✅")
    print("=" * 70)

if __name__ == "__main__":
    test_live_chat_endpoint()
