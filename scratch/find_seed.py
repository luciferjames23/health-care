import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Search for "this.S =" or "api.S =" or where S is initialized with agents
matches = list(re.finditer(r'this\.S\s*=|const seed\s*=|function makeState|function seedState|initialState\s*=', content))
print("Found seed matches:", len(matches))
for m in matches:
    print("Match at:", m.start())
    st = m.start()
    print(content[st:st+500].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("="*60)

# Let's search for "AG-01" in the entire file
pos = 0
matches_ag = list(re.finditer(r'[\x27\"]AG-\d+[\x27\"]', content))
print(f"Total AG-XX string literals: {len(matches_ag)}")
for m in matches_ag:
    st = max(0, m.start() - 30)
    en = min(len(content), m.end() + 150)
    print(f"AG match at {m.start()}:", content[st:en].encode('ascii', errors='backslashreplace').decode('ascii'))
    print("-"*40)
