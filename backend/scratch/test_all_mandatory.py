import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import db_config
import agent.agent_service as agent_service
import agent.state_manager as state_manager

def run_mandatory_tests():
    print("==================================================")
    print("RUNNING ALL MANDATORY TESTS 1 - 10")
    print("==================================================")

    conv_id = "WA_919999966666_mandatory"

    # Reset state
    st = state_manager.get_default_state()
    st["conversation_id"] = conv_id
    st["patient_id"] = 9989
    state_manager.save_conversation_state(conv_id, st)

    # 1. Start Booking
    res = agent_service.process_agent_message(conv_id, None, "Book Appointment", interactive_id="btn_book_appt")
    
    # 2. Clinical reason
    res = agent_service.process_agent_message(conv_id, None, "hair fall")

    # 3. Select Dr. Santhosh Kumar K
    res = agent_service.process_agent_message(conv_id, None, "btn_doc_1016", interactive_id="btn_doc_1016")
    
    print("\n[MANDATORY TEST 1]: Select Sat, Sep 19")
    res1 = agent_service.process_agent_message(conv_id, None, "Sat, Sep 19")
    resp1 = res1.get("response", "")
    print("Response snippet:\n", resp1[:250])
    assert "Dr. Santhosh Kumar k" in resp1, f"Doctor name lost: {resp1}"
    assert "Dermatology" in resp1, f"Department lost: {resp1}"
    assert "Saturday, September 19" in resp1 or "Sep 19" in resp1 or "September 19" in resp1, f"Date mismatch: {resp1}"
    assert "General Medicine" not in resp1, f"FAIL: Routed to General Medicine!"

    print("\n[MANDATORY TEST 2]: Select Fri, Sep 18")
    res2 = agent_service.process_agent_message(conv_id, None, "Fri, Sep 18")
    resp2 = res2.get("response", "")
    print("Response snippet:\n", resp2[:200])
    assert "Dr. Santhosh Kumar k" in resp2, f"Doctor name lost: {resp2}"

    print("\n[MANDATORY TEST 3]: Select Sun, Sep 20")
    res3 = agent_service.process_agent_message(conv_id, None, "Sun, Sep 20")
    resp3 = res3.get("response", "")
    print("Response snippet:\n", resp3[:200])
    assert "Dr. Santhosh Kumar k" in resp3, f"Doctor name lost: {resp3}"

    print("\n[MANDATORY TEST 4]: Select valid time slot (btn_slot_11:30)")
    res4 = agent_service.process_agent_message(conv_id, None, "btn_slot_11:30", interactive_id="btn_slot_11:30")
    resp4 = res4.get("response", "")
    print("Response preview:\n", resp4)
    assert "Dr. Santhosh Kumar k" in resp4, f"Doctor missing: {resp4}"
    assert "Dermatology" in resp4, f"Department missing: {resp4}"
    assert "Confirm" in resp4 or "confirm" in resp4, f"Confirmation missing: {resp4}"

    print("\n[MANDATORY TEST 5]: Confirm Appointment -> Payment Method -> Mock Payment -> Success")
    res5 = agent_service.process_agent_message(conv_id, None, "btn_confirm_appt", interactive_id="btn_confirm_appt")
    resp5 = res5.get("response", "")
    print("Confirm snippet:", resp5[:180])

    res_pm = agent_service.process_agent_message(conv_id, None, "btn_pay_gpay", interactive_id="btn_pay_gpay")
    resp_pm = res_pm.get("response", "")
    print("Payment method snippet:", resp_pm[:180])

    res_pay = agent_service.process_agent_message(conv_id, None, "btn_pay_exec", interactive_id="btn_pay_exec")
    resp_pay = res_pay.get("response", "")
    print("Payment success snippet:\n", resp_pay)
    assert "Confirmed" in resp_pay or "Successful" in resp_pay or "APT" in resp_pay or "booked" in resp_pay.lower(), f"Payment flow failed: {resp_pay}"

    print("\n==================================================")
    print("ALL MANDATORY TESTS COMPLETED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == "__main__":
    run_mandatory_tests()
