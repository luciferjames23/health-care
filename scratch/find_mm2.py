import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Search for "__mm2" or "seed" or "agents" in the entire file
matches = list(re.finditer(r'window\.__mm2|__mm2', content))
print(f"__mm2 matches: {len(matches)}")
for m in matches:
    st = max(0, m.start() - 50)
    en = min(len(content), m.end() + 200)
    print(f"Match at {m.start()}:", content[st:en].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)
