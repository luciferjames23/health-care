import json, gzip, base64

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8') as f:
    raw = f.read()

from bs4 import BeautifulSoup
soup = BeautifulSoup(raw, 'html.parser')
manifest = json.loads(soup.find('script', {'type': '__bundler/manifest'}).string)

js_data = base64.b64decode(manifest['8129aa64-6c44-4fa7-8efc-2181b9ff937d']['data'])
if manifest['8129aa64-6c44-4fa7-8efc-2181b9ff937d'].get('compressed'):
    js_data = gzip.decompress(js_data)

js = js_data.decode('utf-8', errors='ignore')

idx = js.find("title: 'AI GENERATED · plain-language explanation · Billing Transparency Agent'")
snippet = js[idx-2000:idx+3500]

with open('exact_bill_preauth_drawer.js', 'w', encoding='utf-8') as out:
    out.write(snippet)

print('Wrote exact_bill_preauth_drawer.js, length:', len(snippet))
