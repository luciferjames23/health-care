import sys
import os
import uuid

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import agent.agent_service as agent_service
import agent.state_manager as state_manager
import agent.patient_identification_service as patient_id_service

def test_patient_identification_flows():
    print("\n==================================================")
    print("RUNNING COMPREHENSIVE PATIENT IDENTIFICATION TESTS")
    print("==================================================\n")

    # TC 1: Unknown Phone - Initial Prompt
    test_num_1 = f"91{uuid.uuid4().hex[:10]}"
    session_1 = f"WA_{test_num_1}_session"
    res1 = agent_service.process_agent_message(session_1, None, "Hello")
    print("TC 1 (Unknown phone prompt):", res1.get("response")[:60].replace("\n", " "))
    assert "first-time" in res1.get("response", "").lower() or "existing" in res1.get("response", "").lower()
    assert len(res1.get("interactive_buttons", [])) == 2

    # TC 2: First-time Visitor button tap
    res2 = agent_service.process_agent_message(session_1, None, "First-time Visitor", interactive_id="btn_first_time")
    print("TC 2 (First-time visitor):", res2.get("response")[:60].replace("\n", " "))
    assert "name" in res2.get("response", "").lower()

    # TC 3: Multi-message registration (Name -> DOB -> Gender)
    # Step A: Provide Name
    res3a = agent_service.process_agent_message(session_1, None, "Alex Johnson")
    print("TC 3a (Provide Name -> Prompt DOB):", res3a.get("response")[:60].replace("\n", " "))
    assert "birth" in res3a.get("response", "").lower()

    # Step B: Provide DOB ("15/08/1998") - MUST NOT trigger appointment date workflow!
    res3b = agent_service.process_agent_message(session_1, None, "15/08/1998")
    print("TC 3b (Provide DOB -> Prompt Gender):", res3b.get("response")[:60].replace("\n", " "))
    assert "gender" in res3b.get("response", "").lower()
    assert res3b.get("intent") == "REGISTER_PATIENT"

    # Step C: Provide Gender ("Male") -> Complete registration!
    res3c = agent_service.process_agent_message(session_1, None, "Male", interactive_id="btn_g_male")
    print("TC 3c (Provide Gender -> Registration Success):", res3c.get("response")[:80].replace("\n", " "))
    assert any(w in res3c.get("response", "").lower() for w in ["complete", "successful", "welcome"])
    assert len(res3c.get("interactive_buttons", [])) == 8  # Main Menu buttons shown!

    # TC 4: Existing Phone - Recognized automatically on greeting
    res4 = agent_service.process_agent_message(session_1, None, "Hi")
    print("TC 4 (Existing phone greeting):", res4.get("response", "")[:60].encode('ascii', 'ignore').decode('ascii'))
    assert any(w in res4.get("response", "").lower() for w in ["welcome", "alex", "help"])

    # TC 5: Single Message Registration ("Sarah Conor 12/04/1995 Female")
    test_num_2 = f"91{uuid.uuid4().hex[:10]}"
    session_2 = f"WA_{test_num_2}_session"
    agent_service.process_agent_message(session_2, None, "First-time Visitor", interactive_id="btn_first_time")
    res5 = agent_service.process_agent_message(session_2, None, "Sarah Conor 12/04/1995 Female")
    print("TC 5 (Single message full registration):", res5.get("response", "")[:80].encode('ascii', 'ignore').decode('ascii'))
    assert any(w in res5.get("response", "").lower() for w in ["complete", "successful", "welcome"])

    # TC 6: Existing Patient Flow with Patient ID
    test_num_3 = f"91{uuid.uuid4().hex[:10]}"
    session_3 = f"WA_{test_num_3}_session"
    agent_service.process_agent_message(session_3, None, "Hello")
    res6a = agent_service.process_agent_message(session_3, None, "Existing Patient", interactive_id="btn_existing_patient")
    print("TC 6a (Existing Patient tap -> Prompt Patient ID):", res6a.get("response", "")[:60].encode('ascii', 'ignore').decode('ascii'))
    assert "patient id" in res6a.get("response", "").lower()

    # Enter valid patient ID e.g. "PAT-113641"
    res6b = agent_service.process_agent_message(session_3, None, "PAT-113641")
    print("TC 6b (Enter Patient ID -> Patient Found):", res6b.get("response", "")[:80].encode('ascii', 'ignore').decode('ascii'))
    assert any(w in res6b.get("response", "").lower() for w in ["welcome", "found", "pat-113641", "details"])

    print("\n==================================================")
    print("ALL PATIENT IDENTIFICATION & REGISTRATION TESTS PASSED!")
    print("==================================================\n")

if __name__ == "__main__":
    test_patient_identification_flows()
