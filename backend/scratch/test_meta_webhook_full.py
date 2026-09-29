import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.whatsapp_routes import get_or_create_whatsapp_session
from agent.agent_service import process_agent_message

def test_full_turn_sequence():
    sender = "15556698871"
    
    # Clean up prior test sessions for this number
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE conversations SET conversation_status = 'COMPLETED' WHERE whatsapp_number LIKE '%5556698871%';")
        conn.commit()
    finally:
        cur.close()
        conn.close()

    session_id = get_or_create_whatsapp_session(sender)
    print(f"\n--- Active Session Started: {session_id} ---")

    # Step 1: User sends 'Hey'
    print("\n--- TURN 1: User sends 'Hey' ---")
    s1 = get_or_create_whatsapp_session(sender)
    res1 = process_agent_message(s1, None, "Hey")
    print(f"Session: {s1}")
    print(f"Bot Response:\n{res1.get('response')}")
    print(f"Buttons: {[b.get('title') if isinstance(b, dict) else b.get('id') if isinstance(b, dict) else b for b in res1.get('interactive_buttons', [])]}")

    # Step 2: User taps 'My Health & Records' (btn_cat_health)
    print("\n--- TURN 2: User taps 'My Health & Records' ---")
    s2 = get_or_create_whatsapp_session(sender)
    res2 = process_agent_message(s2, None, "My Health & Records", interactive_id="btn_cat_health")
    print(f"Session: {s2}")
    print(f"Bot Response:\n{res2.get('response')}")

    # Step 3: User taps 'My Profile' (btn_my_profile)
    print("\n--- TURN 3: User taps 'My Profile' ---")
    s3 = get_or_create_whatsapp_session(sender)
    res3 = process_agent_message(s3, None, "My Profile", interactive_id="btn_my_profile")
    print(f"Session: {s3}")
    print(f"Bot Response:\n{res3.get('response')}")
    print(f"Buttons: {[b.get('title') if isinstance(b, dict) else b.get('id') if isinstance(b, dict) else b for b in res3.get('interactive_buttons', [])]}")

    # Step 4: User selects John David (btn_select_pat_2666)
    print("\n--- TURN 4: User selects John David ---")
    s4 = get_or_create_whatsapp_session(sender)
    res4 = process_agent_message(s4, None, "John David — P2666", interactive_id="btn_select_pat_2666")
    print(f"Session: {s4}")
    print(f"Bot Response:\n{res4.get('response')}")

if __name__ == "__main__":
    test_full_turn_sequence()
