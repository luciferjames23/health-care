with open('unbundled_prototype.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re

bb_match = re.search(r'(\bpage\s*===\s*[\'"]bedboard[\'"][\s\S]*?)(?:page\s*===\s*[\'"][a-zA-Z0-9_\-]+[\'"]|return)', html)
if bb_match:
    content = bb_match.group(1)
    with open('bedboard_template.txt', 'w', encoding='utf-8') as out:
        out.write(content)
    print("Wrote bedboard_template.txt, length:", len(content))

# Also search prototype_script.js for bedboard helper methods
with open('prototype_script.js', 'r', encoding='utf-8') as f:
    js = f.read()

js_matches = re.findall(r'(?:bedboard|beds|wards)[\s\S]{0,300}', js[:30000])
print(f"JS matches count: {len(js_matches)}")
