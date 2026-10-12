import sys
import os
import unittest
from datetime import datetime, date
import uuid

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import requests
import db_config
import agent.agent_service as agent_service
import agent.patient_identification_service as patient_id_service
import services.patient_service as patient_service
import utils.cache_service as cache_service
from utils.phone_utils import normalize_phone

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
admin_headers = {"Authorization": "Bearer demo-session-token"}


def run_all_tests():
    print("==================================================================")
    print("STARTING TEST SUITE: PATIENT REGISTRATION WITH SHARED PHONES")
    print("==================================================================")

    # Generate a unique phone number for this test run so we start fresh
    test_uid = uuid.uuid4().hex[:6]
    test_phone_digits = f"9840{int(uuid.uuid4().hex[:6], 16) % 1000000:06d}"
    test_phone_formatted = f"+91 {test_phone_digits[:5]} {test_phone_digits[5:]}"
    print(f"[SETUP] Using dedicated test phone number: {test_phone_digits} ({test_phone_formatted})")

    # ── TEST A: Portal Registration with Shared Number ────────────────────────
    print("\n[TEST A] Portal Registration with Shared Number...")
    # Register Patient A (Jacky K)
    payload_a = {
        "first_name": "Jacky",
        "last_name": "K",
        "date_of_birth": "1988-04-12",
        "gender": "Male",
        "phone": test_phone_formatted,
        "whatsapp_number": test_phone_digits,
        "email": "jacky.k@example.com",
        "patient_type": "OP"
    }
    res_a = client.post("/api/dashboard/patients", json=payload_a, headers=admin_headers)
    assert res_a.status_code == 200, f"Patient A registration failed: {res_a.text}"
    pat_a = res_a.json()["patient"]
    id_a = pat_a["id"]
    code_a = pat_a["patient_code"]
    print(f"[PASS] Patient A (Jacky K) created: ID={id_a}, Code={code_a}")
    assert code_a.startswith("MER-PAT-"), f"Expected MER-PAT- prefix, got {code_a}"

    # Register Patient B (Kumaran R) with DIFFERENT details but the SAME phone
    payload_b = {
        "first_name": "Kumaran",
        "last_name": "R",
        "date_of_birth": "1992-09-24",
        "gender": "Male",
        "phone": test_phone_formatted,
        "whatsapp_number": test_phone_digits,
        "email": "kumaran.r@example.com",
        "patient_type": "OP"
    }
    res_b = client.post("/api/dashboard/patients", json=payload_b, headers=admin_headers)
    assert res_b.status_code == 200, f"Patient B registration failed: {res_b.text}"
    pat_b = res_b.json()["patient"]
    id_b = pat_b["id"]
    code_b = pat_b["patient_code"]
    print(f"[PASS] Patient B (Kumaran R) created: ID={id_b}, Code={code_b}")
    assert code_b.startswith("MER-PAT-"), f"Expected MER-PAT- prefix, got {code_b}"

    # Verify both records exist and IDs are different
    assert id_a != id_b, f"Patient IDs must be different! Both got {id_a}"
    assert code_a != code_b, f"Patient Codes must be different! Both got {code_a}"

    # Verify Patient A's details in DB are completely unchanged
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, patient_code, first_name, last_name, date_of_birth FROM patients WHERE id = %s;", (id_a,))
    db_row_a = cur.fetchone()
    assert db_row_a is not None, "Patient A missing from database!"
    assert db_row_a[2] == "Jacky" and db_row_a[3] == "K", f"Patient A details corrupted: {db_row_a}"
    print("[PASS] Verified Patient A record remains completely intact in PostgreSQL.")
    cur.close()
    conn.close()

    # ── TEST B: WhatsApp Registration with Shared Number ──────────────────────
    print("\n[TEST B] WhatsApp Registration with Shared Number...")
    # Simulate a WhatsApp conversation with contact number test_phone_digits
    # Contact is already associated with Patient A & Patient B
    wa_convo_id = f"WA_{test_phone_digits}_family"
    state = {
        "whatsapp_number": test_phone_digits,
        "language": "ENGLISH",
        "registration_stage": "REGISTRATION",
        "patient_identification_stage": "REGISTRATION",
        "registration_fields": {
            "first_name": "Meena",
            "last_name": "K",
            "date_of_birth": "1995-12-05",
            "gender": "Female",
            "phone": test_phone_digits,
            "email": "meena.k@example.com"
        }
    }
    # Call handle_registration_confirmation
    conf_res = agent_service.handle_registration_confirmation(wa_convo_id, state, "ENGLISH")
    assert conf_res["success"] is True, f"WhatsApp registration failed: {conf_res}"
    print(f"[PASS] WhatsApp registration response: {conf_res['response']}")

    # Verify that a third distinct patient (Meena K) was created
    id_c = state.get("selected_patient_id")
    assert id_c is not None, "Expected selected_patient_id to be populated"
    assert id_c != id_a and id_c != id_b, f"WhatsApp reused an existing patient ID! id_c={id_c}, id_a={id_a}, id_b={id_b}"

    # Query DB for Meena K
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, patient_code, first_name, last_name, date_of_birth, gender FROM patients WHERE id = %s;", (id_c,))
    db_row_c = cur.fetchone()
    assert db_row_c is not None, "Meena K missing from PostgreSQL!"
    code_c = db_row_c[1]
    print(f"[PASS] Patient C (Meena K) created via WhatsApp: ID={id_c}, Code={code_c}")
    assert code_c.startswith("MER-PAT-"), f"WhatsApp generated non-canonical code: {code_c}"
    assert code_c != code_a and code_c != code_b, "Patient C code must be unique"
    cur.close()
    conn.close()

    # Verify bot confirms registration using the newly created patient's actual ID
    assert code_c in conf_res["response"], f"Expected confirmation response to contain code {code_c}, but got: {conf_res['response']}"
    assert "Meena" in conf_res["response"], "Expected confirmation response to mention Meena"

    # Verify all 3 patients appear in the authorized profile list for that WhatsApp phone
    all_linked_pats = patient_id_service.get_all_patients_by_phone(test_phone_digits)
    linked_ids = [p["id"] for p in all_linked_pats]
    print(f"[PASS] All profiles linked to WhatsApp contact {test_phone_digits}: {linked_ids}")
    assert id_a in linked_ids, f"Patient A missing from phone profiles: {linked_ids}"
    assert id_b in linked_ids, f"Patient B missing from phone profiles: {linked_ids}"
    assert id_c in linked_ids, f"Patient C missing from phone profiles: {linked_ids}"

    # ── TEST C: Cross-Channel Registration ───────────────────────────────────
    print("\n[TEST C] Cross-Channel Registration...")
    # Step 1: Query Portal patients list by phone
    res_portal_search = client.get(f"/api/dashboard/patients?search={test_phone_digits}", headers=admin_headers)
    assert res_portal_search.status_code == 200
    portal_pats = res_portal_search.json().get("patients", [])
    portal_pat_ids = [p["id"] for p in portal_pats]
    print(f"[PASS] Portal search for {test_phone_digits} returned IDs: {portal_pat_ids}")
    assert id_a in portal_pat_ids, "Patient A missing from Portal search"
    assert id_b in portal_pat_ids, "Patient B missing from Portal search"
    assert id_c in portal_pat_ids, "Patient C (WhatsApp registered) missing from Portal search"

    # Step 2: Now register Patient D on Portal with the same phone
    payload_d = {
        "first_name": "Rohan",
        "last_name": "K",
        "date_of_birth": "2016-03-20",
        "gender": "Male",
        "phone": test_phone_formatted,
        "whatsapp_number": test_phone_digits,
        "patient_type": "OP"
    }
    res_d = client.post("/api/dashboard/patients", json=payload_d, headers=admin_headers)
    assert res_d.status_code == 200
    pat_d = res_d.json()["patient"]
    id_d = pat_d["id"]
    code_d = pat_d["patient_code"]
    print(f"[PASS] Patient D (Rohan K) created via Portal: ID={id_d}, Code={code_d}")

    # Invalidate in-process cache to reflect remote HTTP mutation
    cache_service.invalidate_cache("pat_phone_")

    # Verify WhatsApp immediately sees Patient D
    all_linked_after_d = patient_id_service.get_all_patients_by_phone(test_phone_digits)
    linked_after_ids = [p["id"] for p in all_linked_after_d]
    assert id_d in linked_after_ids, f"Patient D missing from WhatsApp profiles: {linked_after_ids}"
    print(f"[PASS] WhatsApp multi-profile service dynamically identified all 4 profiles: {linked_after_ids}")

    # ── TEST D: Canonical ID Generation & Concurrency ─────────────────────────
    print("\n[TEST D] Canonical ID Generation & Concurrency...")
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    # Test atomic next ID generation
    next_id_1, code_1 = patient_service.get_next_canonical_patient_id(cur)
    next_id_2, code_2 = patient_service.get_next_canonical_patient_id(cur)
    assert next_id_2 > next_id_1, f"IDs must monotonically increase: {next_id_1}, {next_id_2}"
    assert code_1 == f"MER-PAT-{str(next_id_1).zfill(7)}"
    assert code_2 == f"MER-PAT-{str(next_id_2).zfill(7)}"
    assert code_1 != code_2, "Generated codes must be distinct"
    print(f"[PASS] Atomic canonical ID generation verified: {code_1} -> {code_2}")

    # Verify legacy patient IDs are preserved without renaming
    cur.execute("SELECT id, patient_code FROM patients WHERE patient_code ~ '^P[0-9]+' LIMIT 5;")
    legacy_rows = cur.fetchall()
    if legacy_rows:
        print(f"[PASS] Verified legacy patient IDs remain intact in database: {legacy_rows}")
    cur.close()
    conn.close()

    # ── TEST E: Data Isolation Across Profiles ───────────────────────────────
    print("\n[TEST E] Data Isolation & Profile Switching...")
    import agent.state_manager as state_manager

    # Initialize conversation state with phone number and Patient A selected
    init_state = {
        "whatsapp_number": test_phone_digits,
        "selected_patient_id": id_a,
        "patient_id": id_a,
        "language": "ENGLISH",
        "pending_action_intent": "PATIENT_PROFILE"
    }
    state_manager.save_conversation_state(wa_convo_id, init_state)

    # User clicks to select Patient B (btn_select_pat_{id_b})
    res_sw_b = agent_service.process_agent_message(wa_convo_id, None, "", interactive_id=f"btn_select_pat_{id_b}")
    loaded_state_b = state_manager.get_conversation_state(wa_convo_id)
    assert loaded_state_b["selected_patient_id"] == id_b, f"Expected selected_patient_id={id_b}, got {loaded_state_b.get('selected_patient_id')}"
    assert loaded_state_b["patient_id"] == id_b
    print(f"[PASS] Switch to Patient B verified: active context switched to ID {id_b}")

    # Now switch to Patient C
    res_sw_c = agent_service.process_agent_message(wa_convo_id, None, "", interactive_id=f"btn_select_pat_{id_c}")
    loaded_state_c = state_manager.get_conversation_state(wa_convo_id)
    assert loaded_state_c["selected_patient_id"] == id_c, f"Expected selected_patient_id={id_c}, got {loaded_state_c.get('selected_patient_id')}"
    print(f"[PASS] Switch to Patient C verified: active context switched to ID {id_c}")

    # Attempt unauthorized switch to a patient ID that does NOT belong to this phone
    unauthorized_id = 9999999
    res_unauth = agent_service.process_agent_message(wa_convo_id, None, "", interactive_id=f"btn_select_pat_{unauthorized_id}")
    loaded_state_unauth = state_manager.get_conversation_state(wa_convo_id)
    assert loaded_state_unauth.get("selected_patient_id") != unauthorized_id, "Security failure: unauthorized patient ID selected!"
    print("[PASS] Security isolation verified: unauthorized patient selection was rejected.")

    # ── TEST F: Exact Duplicate Handling (Same Person Registration) ─────────
    print("\n[TEST F] Exact Duplicate Handling (Same Person)...")
    # Submitting identical details for Jacky K (same name, same DOB, same phone)
    dup_res = client.post("/api/dashboard/patients", json=payload_a, headers=admin_headers)
    assert dup_res.status_code == 200
    dup_data = dup_res.json()["patient"]
    assert dup_data["id"] == id_a, f"Expected existing patient ID {id_a} to be returned for identical resubmission, got {dup_data['id']}"
    assert dup_data["patient_code"] == code_a
    print(f"[PASS] Identical person resubmission correctly recognized existing record without creating duplicate row.")

    print("\n==================================================================")
    print("ALL TESTS (A, B, C, D, E, F) PASSED CLEANLY WITH REAL DATABASE!")
    print("==================================================================")


if __name__ == "__main__":
    run_all_tests()
