import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

matches = list(re.finditer(r'__mm2\s*=', content))
print(f"Found {len(matches)} matches for __mm2 =")
for m in matches:
    st = max(0, m.start() - 30)
    en = min(len(content), m.end() + 300)
    print(f"Match at {m.start()}:", content[st:en].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)
