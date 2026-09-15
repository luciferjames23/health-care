with open('prototype_script.js', 'r', encoding='utf-8') as f:
    code = f.read()

import re

# Find all properties and methods of Component
lines = code.split('\n')
for i, line in enumerate(lines[:100]):
    print(f"{i+1}: {line[:120]}")

# Find where data lists (patients, admissions, beds, etc.) are stored
data_matches = re.findall(r'(\b[a-zA-Z0-9_]+\s*:\s*\[[\s\S]*?\])', code[:20000])
print("\n--- DATA ARRAYS FOUND IN FIRST 20KB ---")
for dm in data_matches[:10]:
    name = dm.split(':')[0].strip()
    print(f"Array '{name}': {dm[:150]}...\n")
