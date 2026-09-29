import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Search for "S." or "const S" or "let S" or "var S"
matches = list(re.finditer(r'\b(const|let|var)\s+S\s*=', content))
print(f"Found {len(matches)} matches for 'var/let/const S ='")
for m in matches:
    print(f"Match at {m.start()}:")
    st = m.start()
    print(content[st:st+500].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)

# Search for where 'S.agents' is accessed or set
matches2 = list(re.finditer(r'S\.agents', content))
print(f"Found {len(matches2)} matches for 'S.agents'")
for m in matches2:
    print(f"Match at {m.start()}:")
    st = max(0, m.start() - 50)
    print(content[st:st+300].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)
