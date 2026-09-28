import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(BASE_DIR))

from db_config import get_db_connection
from agent.agent_service import process_agent_message

def test_new_patient_registration_flow():
    conv_code = "WA_919988776655_TEST_FLOW"
    
    print("=== TEST 1: User starts New Patient flow ===")
    r1 = process_agent_message(conv_code, "919988776655", "New Patient", interactive_id="btn_new_patient")
    print("Bot prompt 1:", r1.get("response"))
    assert "name" in r1.get("response").lower()

    print("\n=== TEST 2: User provides Name 'Suriya' ===")
    r2 = process_agent_message(conv_code, "919988776655", "Suriya")
    print("Bot prompt 2:", r2.get("response"))
    assert "date of birth" in r2.get("response").lower() or "dob" in r2.get("response").lower()
    assert "Weekly Availability" not in r2.get("response")
    assert "Moorthy" not in r2.get("response")

    print("\n=== TEST 3: User provides DOB '08/09/2004' ===")
    r3 = process_agent_message(conv_code, "919988776655", "08/09/2004")
    print("Bot prompt 3:", r3.get("response"))
    assert "gender" in r3.get("response").lower()

    print("\n=== TEST 4: User selects Gender 'Female' ===")
    r4 = process_agent_message(conv_code, "919988776655", "Female", interactive_id="btn_g_female")
    print("Bot prompt 4:", r4.get("response"))
    assert "registered" in r4.get("response").lower() or "welcome" in r4.get("response").lower() or "successful" in r4.get("response").lower() or "meridian" in r4.get("response").lower()
    
    print("\nALL NEW PATIENT REGISTRATION TESTS PASSED PERFECTLY! [PASS]")

if __name__ == '__main__':
    test_new_patient_registration_flow()
