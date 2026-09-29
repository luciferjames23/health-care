import re
import json

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Let's search for agents data in the HTML
print("File length:", len(content))

# Look for agent related data keys
for pattern in [
    r'agents\s*:\s*\[',
    r'AG-\d+',
    r'agentStudio',
    r'pAgents',
    r'agentList',
    r'registry',
    r'Executive Dashboard.*?Agents',
]:
    matches = list(re.finditer(pattern, content, re.IGNORECASE))
    print(f"Pattern '{pattern}': {len(matches)} matches")
    for m in matches[:3]:
        st = max(0, m.start() - 60)
        en = min(len(content), m.end() + 200)
        print("   Snippet:", repr(content[st:en]))
