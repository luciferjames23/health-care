import json

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8') as f:
    raw = f.read()

from bs4 import BeautifulSoup
soup = BeautifulSoup(raw, 'html.parser')
template_script = soup.find('script', {'type': '__bundler/template'})
tpl = json.loads(template_script.string)

idx = tpl.find('{{ hasDrawer }}')
snippet = tpl[idx-50:idx+4500]

with open('full_drawer_template.html', 'w', encoding='utf-8') as out:
    out.write(snippet)

print('Wrote full_drawer_template.html, length:', len(snippet))
