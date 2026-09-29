from bs4 import BeautifulSoup
import re

with open('Meridian Prototype V2.1.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Find all script tags using regex
script_tags = re.findall(r'<script([^>]*)>([\s\S]*?)</script>', content)
print(f"Total script tags: {len(script_tags)}")

for i, (attrs, body) in enumerate(script_tags):
    print(f"Script #{i}: attrs={repr(attrs[:100])}, body_len={len(body)}")
    if len(body) > 0:
        print("  Snippet:", repr(body[:150]))
