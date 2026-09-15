with open('unbundled_prototype.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# find start and end of x-dc
xdc_match = re.search(r'<x-dc>([\s\S]*?)</x-dc>', text)
if xdc_match:
    content = xdc_match.group(1)
    print("Length of x-dc template:", len(content))
    # print first 2000 chars of x-dc
    print("--- x-dc preview ---")
    print(content[:2000])

# Also find scripts with js / logic
scripts = re.findall(r'<script[^>]*>([\s\S]*?)</script>', text)
print(f"\nTotal scripts: {len(scripts)}")
for i, s in enumerate(scripts):
    print(f"Script {i} length: {len(s)}")
