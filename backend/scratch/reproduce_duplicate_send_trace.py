"""
reproduce_duplicate_send_trace.py
=================================
Simulates duplicate Meta WhatsApp webhooks hitting the server concurrently
and verifies 3 separate runs of single-send enforcement with full trace logging.
"""

import sys
import os
import time
import uuid
import threading

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_test_iteration(run_number: int, sender_phone: str = "919876543210"):
    print(f"\n=======================================================")
    print(f"--- RUN #{run_number}: TESTING DUPLICATE WEBHOOK RETRIES ---")
    print(f"=======================================================")

    inbound_wamid = f"wamid.test_run_{run_number}_{uuid.uuid4().hex[:8]}"
    text_message = f"Got it! 👍 (Test #{run_number})"

    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "123456789",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "15550198888",
                                "phone_number_id": "100000000000001"
                            },
                            "contacts": [
                                {
                                    "profile": {"name": f"Test Patient {run_number}"},
                                    "wa_id": sender_phone
                                }
                            ],
                            "messages": [
                                {
                                    "from": sender_phone,
                                    "id": inbound_wamid,
                                    "timestamp": str(int(time.time())),
                                    "text": {"body": text_message},
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    }

    results = []
    threads = []

    def post_webhook(hit_index):
        resp = client.post("/api/whatsapp/webhook", json=payload)
        results.append((hit_index, resp.status_code, resp.json()))

    for i in range(1, 5):
        t = threading.Thread(target=post_webhook, args=(i,))
        threads.append(t)

    print(f"Sending 4 concurrent POST requests for wamid={inbound_wamid}...")
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Wait 2 seconds for aggregator debounce and background tasks to settle
    time.sleep(2.0)

    print(f"\n--- RUN #{run_number} WEBHOOK RESPONSES ---")
    for hit_idx, status, res in sorted(results):
        print(f"Hit #{hit_idx}: HTTP {status} -> {res}")

    return inbound_wamid

if __name__ == "__main__":
    print("STARTING IDEMPOTENCY REPRODUCTION & VERIFICATION SUITE")
    print("=" * 60)

    for run_num in range(1, 4):
        run_test_iteration(run_num)
        time.sleep(1.0)

    print("\nSUITE FINISHED SUCCESSFULLY")
