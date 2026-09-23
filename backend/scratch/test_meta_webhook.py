import requests
import json
import time

def send_meta_webhook_interactive(from_number: str, list_id: str, list_title: str):
    url = "http://127.0.0.1:8000/api/whatsapp/webhook"
    wamid = f"wamid.TEST_{int(time.time()*1000)}"
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "2303959047073307",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "15556698871",
                                "phone_number_id": "1332015746651819"
                            },
                            "contacts": [
                                {
                                    "profile": {
                                        "name": "Test User"
                                    },
                                    "wa_id": from_number
                                }
                            ],
                            "messages": [
                                {
                                    "from": from_number,
                                    "id": wamid,
                                    "timestamp": str(int(time.time())),
                                    "type": "interactive",
                                    "interactive": {
                                        "type": "list_reply",
                                        "list_reply": {
                                            "id": list_id,
                                            "title": list_title,
                                            "description": ""
                                        }
                                    }
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }
    
    print(f"\n--- Sending Meta Webhook Payload for list_id='{list_id}', title='{list_title}' ---")
    headers = {"Content-Type": "application/json"}
    r = requests.post(url, json=payload, headers=headers)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text}")

if __name__ == "__main__":
    sender = "15556698871"
    # Step 1: My Health & Records
    send_meta_webhook_interactive(sender, "btn_cat_health", "My Health & Records")
    time.sleep(1)
    # Step 2: My Profile
    send_meta_webhook_interactive(sender, "btn_my_profile", "My Profile")
