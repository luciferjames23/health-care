import re

filepath = 'scratch/extracted_manifest/8129aa64-6c44-4fa7-8efc-2181b9ff937d.js'
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# search for where agents array is transformed or where config is assigned
matches = list(re.finditer(r'agents\.forEach|agents\s*=\s*agents\.map|\.config\s*=|configFor', content))
print(f"Matches for config assignment: {len(matches)}")
for m in matches:
    st = max(0, m.start() - 50)
    en = min(len(content), m.end() + 1500)
    print("Match at:", m.start())
    print(content[st:en].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)

# If not in 8129, check all other extracted files
if not matches:
    import os
    for fn in sorted(os.listdir('scratch/extracted_manifest')):
        fp = os.path.join('scratch/extracted_manifest', fn)
        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
            c2 = f.read()
        m2 = list(re.finditer(r'agents\.forEach|agents\s*=\s*agents\.map|\.config\s*=|configFor', c2))
        if m2:
            print(f"Found in {fn}: {len(m2)} matches")
            for mm in m2:
                st = max(0, mm.start() - 50)
                en = min(len(c2), mm.end() + 1500)
                print(c2[st:en].encode('ascii', errors='backslashreplace').decode('ascii'))
                print("="*60)
