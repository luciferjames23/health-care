with open('unbundled_prototype.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re

# find bedboard / bed board section in template
bb_match = re.search(r'(\bpage\s*===\s*[\'"]bedboard[\'"][\s\S]*?)(?:page\s*===\s*[\'"][a-zA-Z0-9_\-]+[\'"]|return)', html)
if bb_match:
    print("Found bedboard in HTML template!")
    print("Length:", len(bb_match.group(1)))
    print(bb_match.group(1)[:2500])
else:
    # search for 'bedboard' occurrences
    matches = [m.start() for m in re.finditer(r'bedboard', html)]
    print(f"Found 'bedboard' at positions: {matches}")
    for idx in matches[:5]:
        print(f"\n--- Context at {idx} ---")
        print(html[idx-100:idx+400])
