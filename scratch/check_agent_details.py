import re

filepath = 'scratch/extracted_manifest/8129aa64-6c44-4fa7-8efc-2181b9ff937d.js'
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Search for agent config, config: { ... } or instructions, tools, knowledge
pos = content.find('const agents = [')
snippet = content[pos:pos+6000]
print(snippet.encode('ascii', errors='backslashreplace').decode('ascii'))

# Let's see how agents are processed in this file
pos_fn = content.find('agents.map(')
if pos_fn != -1:
    print("=== agents.map ===")
    print(content[pos_fn-50:pos_fn+3000].encode('ascii', errors='backslashreplace').decode('ascii'))
