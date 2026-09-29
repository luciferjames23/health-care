filepath = 'scratch/extracted_manifest/8129aa64-6c44-4fa7-8efc-2181b9ff937d.js'
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Search for AGENT_EXTRA, TYPE_OF, TOOLS
for kw in ['AGENT_EXTRA', 'TYPE_OF', 'TOOLS']:
    pos = 0
    while True:
        idx = content.find(kw, pos)
        if idx == -1:
            break
        print(f"=== {kw} at {idx} ===")
        st = max(0, idx - 50)
        en = min(len(content), idx + 300)
        print(content[st:en].encode('ascii', errors='backslashreplace').decode('ascii'))
        pos = idx + len(kw) + 1
