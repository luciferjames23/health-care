import requests
import json

endpoints = [
    "http://127.0.0.1:8000/api/v1/gold/current-admission-llm-inputs?limit=2",
    "http://127.0.0.1:8000/api/v1/gold/generated-discharge-summaries?limit=2",
    "http://127.0.0.1:8000/api/v1/bronze/beds?limit=2",
    "http://127.0.0.1:8000/api/v1/bronze/wards",
    "http://127.0.0.1:8000/api/v1/bronze/rooms",
]

for ep in endpoints:
    print(f"\n========================================\nFETCHING: {ep}")
    try:
        r = requests.get(ep, timeout=15)
        print(f"Status Code: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, dict):
                print(f"Keys: {list(data.keys())}")
                if "data" in data and isinstance(data["data"], list):
                    print(f"Total rows in response: {len(data['data'])}")
                    if data["data"]:
                        print(f"Record columns: {list(data['data'][0].keys())}")
                        print("Sample record:")
                        print(json.dumps(data["data"][0], indent=2))
                else:
                    print("Dict content:")
                    print(json.dumps(data, indent=2)[:500])
            elif isinstance(data, list):
                print(f"List length: {len(data)}")
                if data:
                    print(f"Item columns: {list(data[0].keys())}")
                    print("Sample item:")
                    print(json.dumps(data[0], indent=2))
        else:
            print(f"Error Response: {r.text[:300]}")
    except Exception as e:
        print(f"Exception: {e}")
