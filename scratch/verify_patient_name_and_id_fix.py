import sys
import os

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('backend'))
sys.path.insert(0, os.path.abspath('backend/agent'))

from db_config import get_db_connection
from agent_service import resolve_patient_info, resolve_doctor_details

def verify_patient_resolution():
    print("=" * 70)
    print("VERIFICATION: PATIENT NAME & PATIENT ID RESOLUTION IN MESSAGING")
    print("=" * 70)

    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Fetch a sample patient from database
        cur.execute("SELECT id, first_name, last_name, patient_code FROM patients LIMIT 1;")
        p_row = cur.fetchone()
        if not p_row:
            print("[FAIL] No patients found in database to test.")
            return

        p_id, p_fn, p_ln, p_code = p_row
        expected_name = f"{p_fn} {p_ln or ''}".strip()
        expected_code = p_code or f"PAT-{p_id}"
        print(f"[OK] Database Sample Patient: ID={p_id}, Name='{expected_name}', Code='{expected_code}'")

        # 2. Test resolve_patient_info with patient_id
        res_by_id = resolve_patient_info(patient_id=p_id)
        print(f"[OK] resolve_patient_info(patient_id={p_id}) =>", res_by_id)
        assert res_by_id["name"] == expected_name
        assert res_by_id["patient_code"] == expected_code

        # 3. Fetch a sample appointment linked to this patient or create one
        cur.execute("SELECT booking_id, id, patient_id FROM appointments WHERE patient_id = %s LIMIT 1;", (p_id,))
        a_row = cur.fetchone()
        if a_row:
            b_id = a_row[0] or str(a_row[1])
            print(f"[OK] Testing resolve_patient_info with appointment booking_id='{b_id}'...")
            res_by_b_id = resolve_patient_info(booking_id=b_id)
            print(f"[OK] resolve_patient_info(booking_id='{b_id}') =>", res_by_b_id)
            assert res_by_b_id["name"] == expected_name
            assert res_by_b_id["patient_code"] == expected_code
        else:
            print("[INFO] No appointment found for sample patient, testing by ID passed.")

        # 4. Test state fallback with conversation_code or patient_id
        dummy_state = {"patient_id": p_id}
        res_state = resolve_patient_info(state=dummy_state)
        print(f"[OK] resolve_patient_info(state={{'patient_id': {p_id}}}) =>", res_state)
        assert res_state["name"] == expected_name

        print("=" * 70)
        print("ALL PATIENT NAME & PATIENT ID RESOLUTION TESTS PASSED!")
        print("=" * 70)

    except Exception as e:
        print(f"[FAIL] Error during verification: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    verify_patient_resolution()
