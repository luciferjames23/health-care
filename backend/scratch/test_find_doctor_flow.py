import os
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
sys.path.insert(0, r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")

import agent.agent_service as agent_service
import agent.state_manager as state_manager

print("=== STARTING FIND DOCTOR & WORKFLOW REGRESSION SUITE ===")

session_code = f"WA_919999999999_find_doc_{int(time.time())}"

# 1. Doctors & Services
print("\n--- STEP 1: Patient taps 'Doctors & Services' ---")
r1 = agent_service.process_agent_message(session_code, None, "Doctors & Services", interactive_id="btn_cat_doctors")
print("Response Text:")
print(r1.get("response"))
print("Intent:", r1.get("intent"))
assert r1.get("intent") == "DOCTORS_AND_SERVICES", f"Expected DOCTORS_AND_SERVICES, got {r1.get('intent')}"

# 2. Find a Doctor
print("\n--- STEP 2: Patient taps 'Find a Doctor' ---")
r2 = agent_service.process_agent_message(session_code, None, "Find a Doctor", interactive_id="btn_find_doctor")
print("Response Text:")
print(r2.get("response"))
print("Intent:", r2.get("intent"))
print("Buttons:", [b.get("title") for b in r2.get("interactive_buttons", [])])
assert r2.get("intent") == "FIND_DOCTOR", f"Expected FIND_DOCTOR, got {r2.get('intent')}"

# 3. Select Pediatrics department (ID 19)
print("\n--- STEP 3: Patient selects 'Pediatrics' ---")
r3 = agent_service.process_agent_message(session_code, None, "Pediatrics", interactive_id="btn_dept_19")
print("Response Text:")
print(r3.get("response"))
print("Intent:", r3.get("intent"))

state3 = state_manager.get_conversation_state(session_code)
print("Department in State:", state3.get("selected_department_name"))
assert state3.get("selected_department_name") == "Pediatrics", f"Expected Pediatrics, got {state3.get('selected_department_name')}"
assert "Pediatrics" in r3.get("response"), "Response should mention Pediatrics"
assert "General Medicine" not in r3.get("response"), "Response should NOT change Pediatrics to General Medicine"

# 4. Select Cardiology department (ID 18)
session_cardio = f"WA_919999999999_cardio_{int(time.time())}"
print("\n--- STEP 4: Patient selects 'Cardiology' ---")
agent_service.process_agent_message(session_cardio, None, "Find a Doctor", interactive_id="btn_find_doctor")
r4 = agent_service.process_agent_message(session_cardio, None, "Cardiology", interactive_id="btn_dept_18")
print("Response Text:")
print(r4.get("response"))
state4 = state_manager.get_conversation_state(session_cardio)
assert state4.get("selected_department_name") == "Cardiology", f"Expected Cardiology, got {state4.get('selected_department_name')}"

# 5. Select Orthopedics department (ID 20)
session_ortho = f"WA_919999999999_ortho_{int(time.time())}"
print("\n--- STEP 5: Patient selects 'Orthopedics' ---")
agent_service.process_agent_message(session_ortho, None, "Find a Doctor", interactive_id="btn_find_doctor")
r5 = agent_service.process_agent_message(session_ortho, None, "Orthopedics", interactive_id="btn_dept_20")
print("Response Text:")
print(r5.get("response"))
state5 = state_manager.get_conversation_state(session_ortho)
assert state5.get("selected_department_name") == "Orthopedics", f"Expected Orthopedics, got {state5.get('selected_department_name')}"

# 6. Verify Doctor Availability flow
session_avail = f"WA_919999999999_avail_{int(time.time())}"
print("\n--- STEP 6: Doctor Availability Flow ---")
agent_service.process_agent_message(session_avail, None, "Doctor Availability", interactive_id="btn_doctor_avail")
r6 = agent_service.process_agent_message(session_avail, None, "Pediatrics", interactive_id="btn_dept_19")
print("Response Text:")
print(r6.get("response"))
print("Intent:", r6.get("intent"))
assert r6.get("intent") == "DOCTOR_AVAILABILITY", f"Expected DOCTOR_AVAILABILITY, got {r6.get('intent')}"

# 7. Verify Appointment Booking flow
session_appt = f"WA_919999999999_appt_{int(time.time())}"
print("\n--- STEP 7: Appointment Booking Flow ---")
r7a = agent_service.process_agent_message(session_appt, None, "Book an appointment", interactive_id="btn_book_appt")
r7b = agent_service.process_agent_message(session_appt, None, "I have fever")
print("Response Text:")
print(r7b.get("response"))
state7 = state_manager.get_conversation_state(session_appt)
assert state7.get("selected_department_name") == "General Medicine", f"Expected General Medicine for fever, got {state7.get('selected_department_name')}"

print("\n=== ALL REGRESSION TESTS PASSED 100% ===")
