import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import agent.agent_service as agent_service
import voice.whatsapp_client as whatsapp_client

def main():
    phone = "918072851813"
    print("Testing process_agent_message for WhatsApp flow...")
    res = agent_service.process_agent_message(
        conversation_code=f"WA_{phone}_test",
        patient_code=None,
        message_text="Hi, I want to book an appointment",
        interactive_id=None
    )
    print("Agent Response Keys:", res.keys())
    print("Intent:", res.get("intent"))
    print("Response Text:", res.get("response"))
    print("Interactive Buttons:", res.get("interactive_buttons"))

    print("\nTesting send_text_message with clean_whatsapp_number...")
    client_res = whatsapp_client.send_text_message(phone, "Test message from Meridian backend validation.")
    print("WhatsApp Client Result:", client_res)

if __name__ == "__main__":
    main()
