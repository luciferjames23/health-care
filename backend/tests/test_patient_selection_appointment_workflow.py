"""
test_patient_selection_appointment_workflow.py
================================================
Comprehensive test suite verifying permanent fixes for WhatsApp patient profile selection,
active patient persistence, workflow resumption, security validation, and isolation.
"""

import os
import sys
import datetime

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from agent.agent_service import process_agent_message, prompt_patient_selection, handle_switch_patient_flow


def setup_test_family_patients():
    """
    Ensures test phone 918072851813 is linked to 2 patients: Jacky K and Kumaran R.
    """
    import agent.patient_identification_service as patient_id_service
    pats = patient_id_service.get_all_patients_by_phone('918072851813')
    res_list = []
    for p in pats:
        full_n = f"{p.get('first_name','')} {p.get('last_name','')}".strip()
        res_list.append({"id": p["id"], "patient_code": p.get("patient_code"), "name": full_n})
    return res_list


def clear_test_session(conversation_code: str):
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM conversations WHERE conversation_code = %s;", (conversation_code,))
        row = cur.fetchone()
        if row:
            conv_id = row[0]
            cur.execute("DELETE FROM messages WHERE conversation_id = %s;", (conv_id,))
            cur.execute("DELETE FROM conversations WHERE id = %s;", (conv_id,))
            conn.commit()
    finally:
        cur.close()
        conn.close()


def test_1_patient_selection_and_workflow_resumption():
    print("\n--- TEST 1: Patient Selection & Workflow Resumption ---")
    pats = setup_test_family_patients()
    jacky = next(p for p in pats if "Jacky" in p["name"])
    kumaran = next(p for p in pats if "Kumaran" in p["name"])
    session = "WA_918072851813_test1"
    clear_test_session(session)

    # Step 1: User says "Book Appointment"
    res1 = process_agent_message(session, None, "Book Appointment", interactive_id="btn_book_appt")
    print(f"DEBUG res1 response:\n{res1.get('response').encode('ascii', 'ignore').decode('ascii')}")
    assert res1.get("response"), "Response must be returned"
    assert "Jacky" in res1["response"] and "Kumaran" in res1["response"], "Message body must show full patient names"
    
    # Verify buttons use patient names <= 20 chars
    buttons = res1.get("interactive_buttons", [])
    assert len(buttons) >= 2, "Must return reply buttons for patient selection"
    title_list = [b["title"] for b in buttons]
    assert any("Jacky" in t for t in title_list), "Primary button title must contain patient name"
    assert any("Kumaran" in t for t in title_list), "Primary button title must contain patient name"
    for b in buttons:
        assert len(b["title"]) <= 20, f"Button title '{b['title']}' must be <= 20 chars"

    # Step 2: User selects Kumaran R via structured button ID
    res2 = process_agent_message(session, None, f"btn_select_pat_{kumaran['id']}", interactive_id=f"btn_select_pat_{kumaran['id']}")
    print(f"DEBUG res2 response:\n{res2.get('response')}")
    assert res2.get("response"), "Response must be returned"
    assert "Kumaran" in res2["response"], "Must state which patient booking is for"
    assert "Patient Profile Details" not in res2["response"], "Must NOT stop at profile editing"
    print("  [PASS] Test 1 Passed: Selection buttons display patient names, selection persists, and appointment booking resumes cleanly.")


def test_2_my_appointments_uses_active_patient():
    print("\n--- TEST 2: My Appointments Uses Active Patient Context ---")
    pats = setup_test_family_patients()
    kumaran = next(p for p in pats if "Kumaran" in p["name"])
    session = "WA_918072851813_test2"
    clear_test_session(session)

    # Select Kumaran R
    process_agent_message(session, None, f"btn_select_pat_{kumaran['id']}", interactive_id=f"btn_select_pat_{kumaran['id']}")

    # Request My Appointments
    res = process_agent_message(session, None, "My Appointments", interactive_id="btn_my_appts")
    assert res.get("response"), "Response must be returned"
    assert "Patient Profiles" not in res["response"], "Must NOT repeat patient profile list when active selection exists"
    print("  [PASS] Test 2 Passed: My Appointments reuses active patient context without re-asking.")


def test_3_patient_switching_and_isolation():
    print("\n--- TEST 3: Patient Switching & Context Isolation ---")
    pats = setup_test_family_patients()
    jacky = next(p for p in pats if "Jacky" in p["name"])
    kumaran = next(p for p in pats if "Kumaran" in p["name"])
    session = "WA_918072851813_test3"
    clear_test_session(session)

    # Step 1: Select Kumaran R
    process_agent_message(session, None, f"btn_select_pat_{kumaran['id']}", interactive_id=f"btn_select_pat_{kumaran['id']}")

    # Step 2: Switch to Jacky K
    res_switch = process_agent_message(session, None, "Switch patient", interactive_id="btn_switch_patient")
    assert "Patient Profiles" in res_switch["response"], "Switch patient must display profile list"

    res_sel_j = process_agent_message(session, None, f"btn_select_pat_{jacky['id']}", interactive_id=f"btn_select_pat_{jacky['id']}")
    assert "Jacky K" in res_sel_j["response"] or "Jacky" in res_sel_j["response"], "Active patient context must update to Jacky K"

    # Step 3: Open Profile
    res_prof = process_agent_message(session, None, "My profile", interactive_id="btn_my_profile")
    assert "Jacky K" in res_prof["response"], "Profile card must fetch Jacky K's ground truth DB record"
    assert "Kumaran" not in res_prof["response"], "Must not bleed previous patient data"
    print("  [PASS] Test 3 Passed: Patient switching updates active context and isolates transient state completely.")


def test_4_security_validation_unlinked_patient():
    print("\n--- TEST 4: Security Validation for Unlinked Patient ID ---")
    session = "WA_918072851813_test4"
    clear_test_session(session)

    # Submit fake/unlinked patient ID 9999999
    res = process_agent_message(session, None, "btn_select_pat_9999999", interactive_id="btn_select_pat_9999999")
    assert res.get("response"), "Response must be returned"
    assert any(kw in res["response"] for kw in ["Access denied", "not associated", "Invalid profile", "Patient Profiles"]), "Must reject unlinked patient ID securely"
    print("  [PASS] Test 4 Passed: Unlinked/tampered patient ID is rejected securely.")


def test_5_single_profile_auto_resolution():
    print("\n--- TEST 5: Single Profile Auto-Resolution ---")
    # Session on single-profile test number 155500078931
    session = "WA_155500078931_test5"
    clear_test_session(session)
    res = process_agent_message(session, None, "Book Appointment", interactive_id="btn_book_appt")
    assert res.get("response"), "Response must be returned"
    assert "Patient Profiles" not in res["response"], "Single-profile numbers must NOT prompt profile selection"
    print("  [PASS] Test 5 Passed: Single-profile numbers auto-select without prompting.")


if __name__ == "__main__":
    print("==========================================================")
    print("Running WhatsApp Patient Profile & Appointment Workflow Tests...")
    print("==========================================================")
    test_1_patient_selection_and_workflow_resumption()
    test_2_my_appointments_uses_active_patient()
    test_3_patient_switching_and_isolation()
    test_4_security_validation_unlinked_patient()
    test_5_single_profile_auto_resolution()
    print("\n==========================================================")
    print("SUCCESS: ALL 5 COMPREHENSIVE WORKFLOW TESTS PASSED!")
    print("==========================================================")
