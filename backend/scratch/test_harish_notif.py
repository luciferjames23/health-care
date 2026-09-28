import sys
import os
import requests

base = "http://127.0.0.1:8000"

print("--- Testing GET /api/v1/admin/notifications?search=Harish ---")
r = requests.get(f"{base}/api/v1/admin/notifications?search=Harish")
if r.status_code == 200:
    data = r.json()
    print(f"Total: {data.get('total')}")
    for item in data.get("data", [])[:5]:
        print(f"  [{item.get('pri')}] {item.get('id')} - {item.get('title')}: {item.get('detail')}")
else:
    print(f"Error {r.status_code}: {r.text}")
