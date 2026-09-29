import sys
import os
import requests

base = "http://127.0.0.1:8000"

print("--- Testing GET /api/v1/admin/notifications ---")
r = requests.get(f"{base}/api/v1/admin/notifications?limit=5")
if r.status_code == 200:
    data = r.json()
    print(f"Success! Total: {data.get('total')}, Unread: {data.get('unread_count')}, Critical: {data.get('critical_count')}")
    for item in data.get("data", []):
        print(f"  [{item.get('pri')}] {item.get('id')} ({item.get('time')}) - {item.get('title')} [{item.get('src')}] - {item.get('state')}")
else:
    print(f"Error {r.status_code}: {r.text}")

print("\n--- Testing GET /api/v1/admin/notifications/count ---")
r = requests.get(f"{base}/api/v1/admin/notifications/count")
if r.status_code == 200:
    print(r.json())
else:
    print(f"Error {r.status_code}: {r.text}")
