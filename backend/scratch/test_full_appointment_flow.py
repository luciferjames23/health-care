import os
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
sys.path.insert(0, r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")

import agent.agent_service as agent_service
import agent.state_manager as state_manager

session_code = f"WA_919999999999_e2e_{int(time.time())}"

print("=== STARTING FULL END-TO-END APPOINTMENT WORKFLOW TEST ===")
print(f"Session Code: {session_code}")

steps = [
    "Book an appointment",
    "I have fever",
    "Dr. Immanuvel S",
    "Tomorrow",
    "10:00 AM"
]

for i, msg in enumerate(steps, 1):
    print(f"\n--- STEP {i}: Patient sends '{msg}' ---")
    resp = agent_service.process_agent_message(
        conversation_code=session_code,
        patient_code=None,
        message_text=msg
    )
    print("BOT RESPONSE:")
    print(resp.get("response", ""))
    
    state = state_manager.get_conversation_state(session_code)
    print(f"STATE AFTER STEP {i}:")
    print(f"  conversation_state : {state.get('conversation_state')}")
    print(f"  clinical_reason    : {state.get('reason') or state.get('entities', {}).get('reason')}")
    print(f"  department_name    : {state.get('selected_department_name') or state.get('department_name')}")
    print(f"  doctor_name        : {state.get('selected_doctor_name') or state.get('doctor_name') or state.get('entities', {}).get('doctor_id')}")
    print(f"  appointment_date   : {state.get('selected_date') or state.get('appointment_date') or state.get('entities', {}).get('appointment_date')}")
    print(f"  appointment_time   : {state.get('selected_time') or state.get('appointment_time') or state.get('entities', {}).get('appointment_time')}")

print("\n=== E2E WORKFLOW TEST COMPLETED ===")
