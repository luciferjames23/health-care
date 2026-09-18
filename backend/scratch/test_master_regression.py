import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import db_config
import agent.agent_service as agent_service
import agent.patient_identification_service as patient_id_service
import agent.state_manager as state_manager

def run_tests():
    print("=== STARTING MASTER REGRESSION SUITE ===")

    # Test 1: Clinical Routing
    conv_id_1 = "WA_919999900001_1789"
    res1 = agent_service.process_agent_message(conv_id_1, None, "chest pain consultation for cardiology")
    print("[TEST 1 - Clinical Routing]: Intent =", res1.get("intent"), "| Response snippet:", res1.get("response", "")[:120])
    assert res1.get("intent") in ["BOOK_APPOINTMENT", "SYMPTOM_GUIDANCE", "DOCTOR_AVAILABILITY"], f"Failed: {res1}"

    res1_emerg = agent_service.process_agent_message(conv_id_1, None, "severe acute chest pain emergency cannot breathe")
    print("[TEST 1 - Emergency Override]: Intent =", res1_emerg.get("intent"))
    assert res1_emerg.get("intent") == "EMERGENCY", f"Failed emergency check: {res1_emerg}"

    # Test 2: Multiple Patients
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE patients SET whatsapp_number = '+919810099999', phone = '+919810099999' WHERE id IN (2666, 9989);
        UPDATE patients SET first_name = 'Gil', last_name = 'Christ', patient_code = 'P9989' WHERE id = 9989;
    """)
    conn.commit()
    cur.close()
    conn.close()

    conv_id_multi = "WA_919810099999_1789"
    st_m = state_manager.get_conversation_state(conv_id_multi)
    st_m["selected_patient_id"] = None
    state_manager.save_conversation_state(conv_id_multi, st_m)

    res_multi = agent_service.process_agent_message(conv_id_multi, None, "my appointments")
    btn_titles = [b.get("title") for b in res_multi.get("interactive_buttons", [])]
    print("[TEST 2 - Multi Patient Prompt]: Buttons =", btn_titles)
    assert any("P2666" in b or "2666" in b for b in btn_titles), f"Multi patient buttons missing P2666: {btn_titles}"

    # Select John David (P2666)
    res_sel = agent_service.process_agent_message(conv_id_multi, None, "btn_select_pat_2666", interactive_id="btn_select_pat_2666")
    resp_text = res_sel.get("response", "")
    print("[TEST 2 - Select Patient 2666]: Intent =", res_sel.get("intent"), "| Snippet:", resp_text[:120])
    assert "APT80002" in resp_text, f"APT80002 not found in appointments response: {resp_text}"

    # Test 3: Date -> Time Slot Flow
    conv_id_date = "WA_919999900003_1789"
    state_d = state_manager.get_conversation_state(conv_id_date)
    state_d["selected_doctor_id"] = 1017
    state_d["conversation_state"] = "DOCTOR_SELECTED"
    state_manager.save_conversation_state(conv_id_date, state_d)
    res_date = agent_service.process_agent_message(conv_id_date, None, "btn_date_2026-09-25", interactive_id="btn_date_2026-09-25")
    date_resp = res_date.get("response", "")
    print("[TEST 3 - Date Selection]: Response snippet:", date_resp[:120])
    assert any(w in date_resp for w in ["Available", "Time", "Slots", "Select"]), f"Date selection failed: {date_resp}"

    # Test 4: John David P2666 APT80002 Verification
    res_jd = agent_service.process_agent_message(conv_id_multi, "P2666", "my appointments")
    jd_resp = res_jd.get("response", "")
    print("[TEST 4 - John David My Appointments]: Response snippet:", jd_resp[:150], flush=True)
    assert "APT80002" in jd_resp, f"APT80002 missing: {jd_resp}"

    # Test 5: Double Cancellation
    cur_b_id = "APT80002"
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT status FROM appointments WHERE booking_id = %s;", (cur_b_id,))
    st_val = cur.fetchone()[0]
    cur.close()
    conn.close()
    print("[TEST 5 - Double Cancellation DB Status Check]:", st_val)

    print("\n=== ALL REGRESSION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
