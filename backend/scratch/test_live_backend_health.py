import urllib.request
import json
import sys

endpoints = [
    "http://127.0.0.1:8000/",
    "http://127.0.0.1:8000/health",
    "http://127.0.0.1:8000/api/queue/doctor/today?doctor_id=1018",
    "http://127.0.0.1:8000/queue/doctor/today?doctor_id=1018",
    "http://127.0.0.1:8000/api/appointments/today",
    "http://127.0.0.1:8000/docs"
]

print("TESTING LIVE FASTAPI SERVER ENDPOINTS (http://127.0.0.1:8000)")
print("=" * 70)

for url in endpoints:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            body = resp.read()[:200]
            print(f"[OK] {url:60s} -> Status: {status}")
    except urllib.error.HTTPError as e:
        body = e.read()[:200]
        print(f"[HTTP {e.code}] {url:60s} -> Body: {body}")
    except Exception as e:
        print(f"[ERROR] {url:60s} -> Error: {e}")
