from bs4 import BeautifulSoup
import re

with open('unbundled_prototype.html', 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

print("Title:", soup.title)
styles = soup.find_all('style')
print("Styles count:", len(styles))

# Check for custom tags or templates
custom_tags = set([tag.name for tag in soup.find_all() if '-' in tag.name or tag.name.startswith('x-')])
print("Custom tags:", custom_tags)

# Find all data stores or JSON blobs in the HTML
script_tags = soup.find_all('script')
for idx, s in enumerate(script_tags):
    stype = s.get('type')
    src = s.get('src')
    content = s.string or ''
    print(f"Script {idx}: type={stype}, src={src}, len={len(content)}")
    if stype:
        print(f"   preview: {content[:100]}")
