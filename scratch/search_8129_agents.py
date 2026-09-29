import re

filepath = 'scratch/extracted_manifest/8129aa64-6c44-4fa7-8efc-2181b9ff937d.js'
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Search for all occurrences of "agents" in 8129
matches = list(re.finditer(r'\bagents\b', content))
print(f"Total 'agents' occurrences: {len(matches)}")
for m in matches:
    st = max(0, m.start() - 30)
    en = min(len(content), m.end() + 200)
    print(f"At {m.start()}:", repr(content[st:en]))
    print("-"*40)
