with open('prototype_script.js', 'r', encoding='utf-8') as f:
    code = f.read()

import re

# find data structures defined before Component class
class_idx = code.find('class Component')
pre_class = code[:class_idx]
print('Length before Component class:', len(pre_class))

# find consts / objects before class
const_matches = re.findall(r'(?:const|let|var)\s+([A-Z0-9_]+)\s*=', pre_class)
print('Constants defined:', const_matches)

for c in const_matches:
    c_idx = pre_class.find(c)
    snippet = pre_class[c_idx:c_idx+300]
    print(f'\n--- {c} ---')
    print(snippet[:200])
