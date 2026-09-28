import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Search for where S.agents or "agents = " is initialized
pos = 0
matches = list(re.finditer(r'agents\s*:\s*\[|\.agents\s*=\s*\[|const agents\s*=\s*\[|let agents\s*=\s*\[', content))
print(f"Found {len(matches)} direct assignments to agents array")
for m in matches:
    print("Match at:", m.start())
    st = m.start()
    print(content[st:st+1500].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)

# If not found directly, search for 'S = {' or 'initialState'
matches2 = list(re.finditer(r'agents\s*:\s*\{|agents\s*:\s*map|agents\s*:\s*\(', content))
print(f"Found {len(matches2)} other patterns")
for m in matches2:
    print("Match2 at:", m.start())
    st = m.start()
    print(content[st:st+1000].encode('ascii', errors='backslashreplace').decode('ascii'))
