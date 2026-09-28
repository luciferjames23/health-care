import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Let's search where S.agents or a list of agents is created
matches = re.finditer(r'agents\s*:\s*\[|\bname:\s*[\x27"][^\x27"]+Agent', content)
for m in matches:
    pos = m.start()
    print(f"Match at {pos}:")
    print(repr(content[pos-100:pos+500]))
    print("="*60)

# Also let's extract the full agents array
pos_agents = content.find('agents: [')
if pos_agents == -1:
    pos_agents = content.find('agents:[')
if pos_agents == -1:
    # search case insensitive
    pos_agents = content.lower().find('agents')
    print("Lower find 'agents':", pos_agents)

# Let's write the JS section around 1800000 to a file so we can view it
with open('scratch/extracted_js.js', 'w', encoding='utf-8') as out:
    out.write(content[1800000:1890000])

print("Wrote scratch/extracted_js.js")
