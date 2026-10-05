import urllib.request
import re
import sys

with open('../frontend/src/services/api.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all endpoints with ${API_BASE_URL}
matches = re.findall(r'(\$\{API_BASE_URL\}[^`"\'\s?]+)', content)
endpoints = set()
for m in matches:
    clean = m.replace('${API_BASE_URL}', '')
    # replace dynamic params like ${...} with dummy values
    clean = re.sub(r'\$\{[^}]+\}', '1', clean)
    endpoints.add(clean)

print(f"Total endpoints found in api.js: {len(endpoints)}")

errors = []
found = []
other = []
for ep in sorted(endpoints):
    url = f"http://127.0.0.1:8000{ep}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            found.append(ep)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            errors.append((ep, e.code))
        else:
            other.append((ep, e.code))
    except Exception as e:
        pass

print(f"\n--- 404 ENDPOINTS ({len(errors)}) ---")
for ep, code in errors:
    print(f"404: {ep}")
