import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")

import agent.agent_service as agent_service
import agent.state_manager as state_manager

print("--- TESTING AGENT SERVICE PROCESS MESSAGE AND DOCTOR RETRIEVAL ---")
session_code = "WA_919999999999_test"
state = state_manager.get_conversation_state(session_code)

# Test 1: Set stale context (Dr. Priya Ramesh, Cardiology)
state["selected_doctor_id"] = 1006
state["selected_doctor_name"] = "Dr. Priya Ramesh"
state["selected_department_id"] = 14
state["selected_department_name"] = "Cardiology"
state["conversation_state"] = "BOOKING_REASON_REQUIRED"

print("Initial state with stale doctor:", state.get("selected_doctor_id"), state.get("selected_department_name"))

# Process message "I have fever"
resp = agent_service.process_agent_message(
    conversation_code=session_code,
    patient_code=None,
    message_text="I have fever"
)

print("\n--- RESPONSE TEXT ---")
print(resp.get("response", ""))

updated_state = state_manager.get_conversation_state(session_code)
print("\n--- UPDATED STATE ---")
print("Department ID:", updated_state.get("selected_department_id"))
print("Department Name:", updated_state.get("selected_department_name"))
print("Doctor ID:", updated_state.get("selected_doctor_id"))
print("Doctor Name:", updated_state.get("selected_doctor_name"))
