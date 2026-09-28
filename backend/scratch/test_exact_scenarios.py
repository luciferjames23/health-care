import os
import sys
import uuid

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import agent.agent_service as agent_service
import agent.response_validator as response_validator

def run_tests():
    print("=" * 70)
    print("RUNNING VERIFICATION FOR WHATSAPP REPLY BUTTON STANDARDIZATION")
    print("=" * 70)

    session_id = f"WA_VERIFY_{uuid.uuid4().hex[:8]}"

    # Step 1: Start booking with Doctor 1 (Dr. Arun Kumar)
    r1 = agent_service.process_agent_message(session_id, "P001", "Select Dr. Arun Kumar", interactive_id="btn_doc_1")
    r1 = response_validator.normalize_interactive_type(r1)
    btns1 = r1.get("interactive_buttons", [])
    t1 = r1.get("interactive_type")
    print(f"\n1. Date Selection Response:")
    print(f"   Button Count: {len(btns1)}")
    print(f"   Button Titles: {[b['title'] for b in btns1]}")
    print(f"   Interactive Type: {t1}")
    assert len(btns1) == 2, f"Expected 2 buttons (Today, Tomorrow), got {len(btns1)}"
    assert t1 == "button", f"Expected 'button', got {t1}"

    # Step 2: Select Date 'Tomorrow' -> Available Slots (Slot List -> 'list')
    r2 = agent_service.process_agent_message(session_id, "P001", "Tomorrow", interactive_id="btn_date_tomorrow")
    r2 = response_validator.normalize_interactive_type(r2)
    btns2 = r2.get("interactive_buttons", [])
    t2 = r2.get("interactive_type")
    print(f"\n2. Time Slots Selection Response:")
    print(f"   Button Count: {len(btns2)}")
    print(f"   Interactive Type: {t2}")
    assert t2 == "list", f"Expected 'list' for time slots, got {t2}"

    # Step 3: Select first slot -> Appointment Confirmation Screen (3 buttons -> 'button')
    slot_id = [b["id"] for b in btns2 if b.get("id", "").startswith("btn_slot_")][0]
    r3 = agent_service.process_agent_message(session_id, "P001", "09:00 AM", interactive_id=slot_id)
    r3 = response_validator.normalize_interactive_type(r3)
    btns3 = r3.get("interactive_buttons", [])
    t3 = r3.get("interactive_type")
    print(f"\n3. Appointment Confirmation Response:")
    print(f"   Button Count: {len(btns3)}")
    print(f"   Button Titles: {[b['title'] for b in btns3]}")
    print(f"   Interactive Type: {t3}")
    assert len(btns3) == 3, f"Expected 3 buttons for confirmation, got {len(btns3)}"
    assert t3 == "button", f"Expected 'button', got {t3}"

    # Step 4: Confirm Appointment -> Payment Method Selection Screen (6 options -> 'list')
    r4 = agent_service.process_agent_message(session_id, "P001", "Confirm Appointment", interactive_id="btn_confirm_appt")
    r4 = response_validator.normalize_interactive_type(r4)
    btns4 = r4.get("interactive_buttons", [])
    t4 = r4.get("interactive_type")
    print(f"\n4. Select Payment Method Response (6 options):")
    print(f"   Button Count: {len(btns4)}")
    print(f"   Button Titles: {[b['title'] for b in btns4]}")
    print(f"   Interactive Type: {t4}")
    assert len(btns4) == 6, f"Expected 6 buttons, got {len(btns4)}"
    assert t4 == "list", f"Expected 'list' for 6 payment methods, got {t4}"

    # Step 5: Select GPay -> Payment Confirmation Screen (SCREENSHOT SCENARIO: 3 options -> 'button')
    r5 = agent_service.process_agent_message(session_id, "P001", "GPay", interactive_id="btn_pay_gpay")
    r5 = response_validator.normalize_interactive_type(r5)
    btns5 = r5.get("interactive_buttons", [])
    t5 = r5.get("interactive_type")
    print(f"\n5. Payment Confirmation Screen (SCREENSHOT SCENARIO):")
    print(f"   Button Count: {len(btns5)}")
    print(f"   Button Titles: {[b['title'] for b in btns5]}")
    print(f"   Button IDs: {[b['id'] for b in btns5]}")
    print(f"   Interactive Type: {t5}")
    assert len(btns5) == 3, f"Expected 3 buttons for payment prompt, got {len(btns5)}"
    assert t5 == "button", f"Expected 'button' for 3 options, got {t5}"
    assert [b["id"] for b in btns5] == ["btn_pay_exec", "btn_pay_change", "btn_pay_cancel"], "Action IDs modified!"

    # Step 6: Click 'Change Payment Method' -> Returns Payment Method Picker (6 options -> 'list')
    r6 = agent_service.process_agent_message(session_id, "P001", "Change Payment Method", interactive_id="btn_pay_change")
    r6 = response_validator.normalize_interactive_type(r6)
    btns6 = r6.get("interactive_buttons", [])
    t6 = r6.get("interactive_type")
    print(f"\n6. Click 'Change Payment Method':")
    print(f"   Button Count: {len(btns6)}")
    print(f"   Interactive Type: {t6}")
    assert len(btns6) == 6, f"Expected 6 options, got {len(btns6)}"
    assert t6 == "list", f"Expected 'list', got {t6}"

    # Step 7: Select PhonePe -> Returns Payment Confirmation Screen (3 options -> 'button')
    r7 = agent_service.process_agent_message(session_id, "P001", "PhonePe", interactive_id="btn_pay_phonepe")
    r7 = response_validator.normalize_interactive_type(r7)
    btns7 = r7.get("interactive_buttons", [])
    t7 = r7.get("interactive_type")
    print(f"\n7. Select PhonePe:")
    print(f"   Button Count: {len(btns7)}")
    print(f"   Interactive Type: {t7}")
    assert len(btns7) == 3, f"Expected 3 buttons, got {len(btns7)}"
    assert t7 == "button", f"Expected 'button', got {t7}"

    # Step 8: Click 'Pay ₹...' -> Executes exact payment handler
    pay_id = [b["id"] for b in btns7 if b.get("id") == "btn_pay_exec"][0]
    r8 = agent_service.process_agent_message(session_id, "P001", "Pay", interactive_id=pay_id)
    r8 = response_validator.normalize_interactive_type(r8)
    print(f"\n8. Execute Payment:")
    print(f"   Response snippet: {r8['response'][:80]}...")
    assert "paid" in r8["response"].lower() or "confirmed" in r8["response"].lower() or "success" in r8["response"].lower()

    print("\n" + "=" * 70)
    print("ALL VERIFICATION CHECKS PASSED! REPLY BUTTON STANDARDIZATION IS WORKING PERFECTLY! ✅")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
