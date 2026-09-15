with open('prototype_script.js', 'r', encoding='utf-8') as f:
    code = f.read()

# find render() method in Component
render_idx = code.find('render() {')
if render_idx != -1:
    print('Found render() at index', render_idx)
    render_code = code[render_idx:render_idx+5000]
    print(render_code[:2000])

# Check how pages are switched
import re
pages_matches = re.findall(r'(\bif\s*\(\s*p\s*===\s*[\'"][^\'"]+[\'"]|\bcase\s+[\'"][^\'"]+[\'"]|\bpage\s*===\s*[\'"][^\'"]+[\'"])', code)
print('\nPage condition checks in code:')
for m in sorted(list(set(pages_matches)))[:40]:
    print(' ', m)
