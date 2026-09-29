import os
import re

dirpath = 'scratch/extracted_manifest'
for filename in os.listdir(dirpath):
    filepath = os.path.join(dirpath, filename)
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # search for AG- or agents definition
    matches = list(re.finditer(r'AG-\d+|agents\s*:\s*\[|id:\s*[\x27\"]AG-', content))
    if matches:
        print(f"File {filename}: {len(matches)} matches")
        for m in matches[:5]:
            st = max(0, m.start() - 40)
            en = min(len(content), m.end() + 200)
            print("  Snippet:", repr(content[st:en]))
