import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Let's find all page names or routes or navigation items
nav_matches = re.findall(r'navTo\([^)]+\)|page:\s*[\x27"][^\x27"]+[\x27"]|p[A-Z][a-zA-Z0-9]+', content)
print("Navigation items count:", len(nav_matches))
print("Sample nav items:", sorted(list(set(nav_matches)))[:30])

# Search for the state object initialization or data models
state_match = re.findall(r'const S = \{[\s\S]*?\};|function initial\(\)\s*\{[\s\S]*?\}|var initialState = \{[\s\S]*?\};', content)
print("Found state initializations:", len(state_match))
for s in state_match:
    print("State snippet:", repr(s[:300]))

# Search for all agent occurrences and nearby context
for m in re.finditer(r'AG-\d+|Agent\b', content):
    st = max(0, m.start() - 40)
    en = min(len(content), m.end() + 100)
    print(f"Match [{m.group(0)}] at {m.start()}: {repr(content[st:en])}")
