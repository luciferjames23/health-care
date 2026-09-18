import json, gzip, base64, re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8') as f:
    raw = f.read()

from bs4 import BeautifulSoup
soup = BeautifulSoup(raw, 'html.parser')
manifest = json.loads(soup.find('script', {'type': '__bundler/manifest'}).string)

js_data = base64.b64decode(manifest['8129aa64-6c44-4fa7-8efc-2181b9ff937d']['data'])
if manifest['8129aa64-6c44-4fa7-8efc-2181b9ff937d'].get('compressed'):
    js_data = gzip.decompress(js_data)

js = js_data.decode('utf-8', errors='ignore')

# Search for the exact text in Image 1 and Image 2
# In Image 1: "Charges follow Tariff FY26-27 v1.3" or "Billing Transparency Agent"
for m in re.finditer(r'Billing Transparency Agent', js):
    start = max(0, m.start() - 300)
    end = min(len(js), m.start() + 1500)
    print("--- BILL DRAWER IN JS ---")
    print(js[start:end])

# In Image 2: "model preauth-denial v0.9" or "Denial risk"
for m in re.finditer(r'model preauth-denial', js):
    start = max(0, m.start() - 500)
    end = min(len(js), m.start() + 1500)
    print("\n--- PREAUTH / INSURANCE DRAWER IN JS ---")
    print(js[start:end])
