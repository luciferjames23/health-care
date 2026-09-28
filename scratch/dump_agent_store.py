filepath = 'scratch/extracted_manifest/8129aa64-6c44-4fa7-8efc-2181b9ff937d.js'
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

st = 90000
en = 95000
snippet = content[st:en]
with open('scratch/agent_store_code.js', 'w', encoding='utf-8') as out:
    out.write(snippet)

print("Wrote scratch/agent_store_code.js")
