import urllib.request
import json

endpoints = [
    '/api/v1/clinical-ops/surgery',
    '/api/v1/clinical-ops/bloodbank/units',
    '/api/v1/clinical-ops/death-registry',
    '/api/v1/clinical-ops/mlc',
    '/api/v1/discharge-agent/patients',
    '/api/v1/pharmacy-supply/drugs',
    '/api/v1/pharmacy-supply/procurement',
    '/api/v1/pharmacy-supply/vendors',
    '/api/v1/pharmacy-supply/cssd'
]

for ep in endpoints:
    url = f"http://127.0.0.1:8000{ep}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            cnt = len(data.get("data", data)) if isinstance(data, dict) else len(data)
            print(f"SUCCESS [200]: {ep} -> count: {cnt}")
    except urllib.error.HTTPError as e:
        print(f"FAILED [{e.code}]: {ep}")
    except Exception as e:
        print(f"ERROR: {ep} -> {e}")
