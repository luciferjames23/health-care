import json, gzip, base64, re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8') as f:
    raw = f.read()

from bs4 import BeautifulSoup
soup = BeautifulSoup(raw, 'html.parser')
template_script = soup.find('script', {'type': '__bundler/template'})
tpl = json.loads(template_script.string)

with open('drawer_tpl_output.txt', 'w', encoding='utf-8') as out:
    # search for drawer in tpl
    matches = list(re.finditer(r'drawer', tpl, re.I))
    out.write(f"Matches for drawer: {len(matches)}\n")
    for m in matches[:20]:
        start = max(0, m.start() - 100)
        end = min(len(tpl), m.start() + 300)
        out.write(tpl[start:end].replace('\n', ' ') + "\n---\n")

print("Wrote drawer_tpl_output.txt successfully")
