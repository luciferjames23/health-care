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

with open('prototype_drawers_found.txt', 'w', encoding='utf-8') as out:
    for m in re.finditer(r'Billing Transparency Agent', js):
        start = max(0, m.start() - 300)
        end = min(len(js), m.start() + 2500)
        out.write("\n=== BILL MATCH ===\n")
        out.write(js[start:end])
        out.write("\n")

    for m in re.finditer(r'model preauth-denial', js):
        start = max(0, m.start() - 500)
        end = min(len(js), m.start() + 3000)
        out.write("\n=== PREAUTH MATCH ===\n")
        out.write(js[start:end])
        out.write("\n")

print("Wrote prototype_drawers_found.txt")
