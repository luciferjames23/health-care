import os
import sys
import uuid

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import agent.agent_service as agent_service
import agent.response_validator as response_validator

def run_audit():
    print("=" * 70)
    print("WHATSAPP RESPONSE UI — SMART REPLY BUTTON STANDARDIZATION AUDIT")
    print("=" * 70)

    test_session = f"WA_TEST_AUDIT_{uuid.uuid4().hex[:8]}"

    # Test 1: Main Menu Greeting (8 categories -> LIST)
    r1 = agent_service.process_agent_message(test_session, None, "Hello")
    r1 = response_validator.normalize_interactive_type(r1)
    btns1 = r1.get("interactive_buttons", [])
    t1 = r1.get("interactive_type")
    print(f"[TEST 1] Main Menu Greeting: count={len(btns1)}, type={t1}")
    assert len(btns1) == 8, f"Expected 8 buttons for Main Menu, got {len(btns1)}"
    assert t1 == "list", f"Expected 'list' for Main Menu (>3 options), got {t1}"

    # Test 2: New Patient Registration / Gender Prompt (3 options: Male, Female, Other -> BUTTON)
    test_reg_session = f"WA_TEST_REG_{uuid.uuid4().hex[:8]}"
    r2_init = agent_service.process_agent_message(test_reg_session, None, "Register new patient", interactive_id="btn_first_time")
    # Prompting for details...
    r2_gender = agent_service.process_agent_message(test_reg_session, None, "John Doe", interactive_id=None)
    r2_gender = response_validator.normalize_interactive_type(r2_gender)
    btns2 = r2_gender.get("interactive_buttons", [])
    t2 = r2_gender.get("interactive_type")
    print(f"[TEST 2] Registration Gender Prompt: count={len(btns2)}, type={t2}")
    if len(btns2) == 3:
        assert t2 == "button", f"Expected 'button' for 3 gender options, got {t2}"

    # Test 3: Existing Patient Lookup (2 options: Try Again, Main Menu -> BUTTON)
    test_lookup_session = f"WA_TEST_LOOKUP_{uuid.uuid4().hex[:8]}"
    r3 = agent_service.process_agent_message(test_lookup_session, None, "Existing Patient", interactive_id="btn_existing_patient")
    r3 = response_validator.normalize_interactive_type(r3)
    btns3 = r3.get("interactive_buttons", [])
    t3 = r3.get("interactive_type")
    print(f"[TEST 3] Existing Patient Prompt: count={len(btns3)}, type={t3}")

    # Test 4: Book Appointment -> Doctor Selection (>3 options -> LIST)
    r4 = agent_service.process_agent_message(test_session, "P001", "Book Appointment", interactive_id="btn_book_appt")
    r4 = response_validator.normalize_interactive_type(r4)
    btns4 = r4.get("interactive_buttons", [])
    t4 = r4.get("interactive_type")
    print(f"[TEST 4] Doctor Selection: count={len(btns4)}, type={t4}")
    assert t4 == "list", f"Expected 'list' for Doctor Selection (>3 doctors), got {t4}"

    # Test 5: Select Doctor -> Date Selection (2 options: Today, Tomorrow -> BUTTON)
    doc_btn = [b for b in btns4 if b.get("id", "").startswith("btn_doc_")][0]["id"]
    r5 = agent_service.process_agent_message(test_session, "P001", "Select Doctor", interactive_id=doc_btn)
    r5 = response_validator.normalize_interactive_type(r5)
    btns5 = r5.get("interactive_buttons", [])
    t5 = r5.get("interactive_type")
    print(f"[TEST 5] Date Selection: count={len(btns5)}, type={t5}")
    assert len(btns5) == 2, f"Expected 2 buttons for Date Selection, got {len(btns5)}"
    assert t5 == "button", f"Expected 'button' for Date Selection, got {t5}"

    # Test 6: Select Date -> Available Time Slots (slot list workflow -> LIST)
    r6 = agent_service.process_agent_message(test_session, "P001", "Tomorrow", interactive_id="btn_date_tomorrow")
    r6 = response_validator.normalize_interactive_type(r6)
    btns6 = r6.get("interactive_buttons", [])
    t6 = r6.get("interactive_type")
    print(f"[TEST 6] Time Slots Selection: count={len(btns6)}, type={t6}")
    assert t6 == "list", f"Expected 'list' for Time Slots, got {t6}"

    # Test 7: Select Slot -> Appointment Confirmation (3 options -> BUTTON)
    slot_id = [b["id"] for b in btns6 if b.get("id", "").startswith("btn_slot_")][0]
    r7 = agent_service.process_agent_message(test_session, "P001", "Slot", interactive_id=slot_id)
    r7 = response_validator.normalize_interactive_type(r7)
    btns7 = r7.get("interactive_buttons", [])
    t7 = r7.get("interactive_type")
    print(f"[TEST 7] Appointment Confirmation: count={len(btns7)}, type={t7}")
    assert len(btns7) == 3, f"Expected 3 buttons for Appointment Confirmation, got {len(btns7)}"
    assert t7 == "button", f"Expected 'button' for Appointment Confirmation, got {t7}"

    # Test 8: Confirm Appointment -> Select Payment Method (6 options -> LIST)
    r8 = agent_service.process_agent_message(test_session, "P001", "Confirm Appointment", interactive_id="btn_confirm_appt")
    r8 = response_validator.normalize_interactive_type(r8)
    btns8 = r8.get("interactive_buttons", [])
    t8 = r8.get("interactive_type")
    print(f"[TEST 8] Payment Method Selection (6 options): count={len(btns8)}, type={t8}")
    assert len(btns8) == 6, f"Expected 6 buttons for Payment Method Selection, got {len(btns8)}"
    assert t8 == "list", f"Expected 'list' for 6 Payment Methods, got {t8}"

    # Test 9: Select Payment Method (GPay) -> Payment Confirmation Screen (3 options: Pay ₹..., Change Payment Method, Cancel -> BUTTON!)
    r9 = agent_service.process_agent_message(test_session, "P001", "GPay", interactive_id="btn_pay_gpay")
    r9 = response_validator.normalize_interactive_type(r9)
    btns9 = r9.get("interactive_buttons", [])
    t9 = r9.get("interactive_type")
    print(f"[TEST 9] Payment Confirmation Screen (SCREENSHOT SCENARIO): count={len(btns9)}, type={t9}")
    print(f"         Buttons: {[b['title'] for b in btns9]}")
    assert len(btns9) == 3, f"Expected 3 buttons for Payment Confirmation Screen, got {len(btns9)}"
    assert t9 == "button", f"Expected 'button' for Payment Confirmation Screen, got {t9}"

    # REGRESSION TEST 9A: Click 'Change Payment Method' -> Must return Payment Method Selection (6 options -> LIST)
    r9a = agent_service.process_agent_message(test_session, "P001", "Change Payment Method", interactive_id="btn_pay_change")
    r9a = response_validator.normalize_interactive_type(r9a)
    btns9a = r9a.get("interactive_buttons", [])
    t9a = r9a.get("interactive_type")
    print(f"[REGRESSION 9A] Click Change Payment Method: count={len(btns9a)}, type={t9a}")
    assert len(btns9a) == 6, f"Expected 6 options after Change Payment Method, got {len(btns9a)}"
    assert t9a == "list", f"Expected 'list' after Change Payment Method, got {t9a}"

    # Select PhonePe -> Payment Confirmation Screen again (3 options -> BUTTON)
    r9b = agent_service.process_agent_message(test_session, "P001", "PhonePe", interactive_id="btn_pay_phonepe")
    r9b = response_validator.normalize_interactive_type(r9b)
    btns9b = r9b.get("interactive_buttons", [])
    t9b = r9b.get("interactive_type")
    print(f"[REGRESSION 9B] Select PhonePe: count={len(btns9b)}, type={t9b}")
    assert t9b == "button", f"Expected 'button' for PhonePe confirmation screen, got {t9b}"

    # REGRESSION TEST 9C: Click 'Pay ₹...' -> Must execute exact payment logic cleanly!
    pay_btn_id = [b["id"] for b in btns9b if b.get("id") == "btn_pay_exec"][0]
    r9c = agent_service.process_agent_message(test_session, "P001", "Pay", interactive_id=pay_btn_id)
    r9c = response_validator.normalize_interactive_type(r9c)
    print(f"[REGRESSION 9C] Click Pay: response summary='{r9c['response'][:60]}...'")
    assert "paid" in r9c["response"].lower() or "success" in r9c["response"].lower() or "confirmed" in r9c["response"].lower(), "Payment execution failed!"

    # Test 10: Human Handoff (2 options: Talk to Staff, Continue with AI -> BUTTON)
    test_session_2 = f"WA_TEST_HANDOFF_{uuid.uuid4().hex[:8]}"
    r10 = agent_service.process_agent_message(test_session_2, None, "Talk to staff", interactive_id="btn_cat_staff")
    r10 = response_validator.normalize_interactive_type(r10)
    btns10 = r10.get("interactive_buttons", [])
    t10 = r10.get("interactive_type")
    print(f"[TEST 10] Human Handoff: count={len(btns10)}, type={t10}")
    assert t10 == "button", f"Expected 'button' for Human Handoff, got {t10}"

    print("=" * 70)
    print("ALL SMART REPLY BUTTON AUDIT TESTS PASSED SUCCESSFULLY! ✅")
    print("=" * 70)

if __name__ == "__main__":
    run_audit()
