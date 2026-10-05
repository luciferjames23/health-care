import re
import urllib.request
import json
import urllib.error

with open('../frontend/src/services/api.js', 'r', encoding='utf-8') as f:
    api_content = f.read()

# Match template string endpoints ${API_BASE_URL}/...
matches = re.findall(r'`\$\{API_BASE_URL\}(/[^`?]+)', api_content)

tested = set()
results_404 = []
results_500 = []
results_200 = []

for m in matches:
    # Replace template expressions like ${id} or ${doctorId} with '1' or dummy
    clean = re.sub(r'\$\{[^}]+\}', '1', m)
    if clean in tested:
        continue
    tested.add(clean)

    url = f"http://127.0.0.1:8000{clean}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            results_200.append(clean)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            results_404.append((clean, m))
        elif e.code == 405: # Method Not Allowed (likely a POST/PATCH/DELETE route)
            pass
        elif e.code >= 500:
            results_500.append((clean, e.code))
        else:
            pass
    except Exception as e:
        pass

print(f"Tested {len(tested)} unique endpoints.")
print(f"\n=== 404 NOT FOUND ENDPOINTS ({len(results_404)}) ===")
for clean, raw in results_404:
    print(f"404: {clean} (raw: {raw})")

print(f"\n=== 500 ERROR ENDPOINTS ({len(results_500)}) ===")
for clean, code in results_500:
    print(f"{code}: {clean}")
