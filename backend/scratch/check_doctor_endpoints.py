import urllib.request
import json

urls = [
    'http://127.0.0.1:8000/api/dashboard/doctors',
    'http://127.0.0.1:8000/api/dashboard/departments',
    'http://127.0.0.1:8000/api/dashboard/summary',
    'http://127.0.0.1:8000/api/dashboard/schedules',
    'http://127.0.0.1:8000/api/v1/clinical-ops/sbar'
]

for u in urls:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
            print(f"200 OK: {u}")
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {u}")
    except Exception as e:
        print(f"ERROR: {u} -> {e}")
