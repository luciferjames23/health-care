import requests
import json

def test_api():
    url = "http://127.0.0.1:8000/api/agent/chat"
    payload = {
        "conversation_id": "WA_15556698871",
        "message": "Hey",
        "language": "ENGLISH"
    }
    try:
        r = requests.post(url, json=payload, timeout=15)
        print(f"Status Code: {r.status_code}")
        print("Response JSON:")
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        print(f"API request error: {e}")

if __name__ == "__main__":
    test_api()
