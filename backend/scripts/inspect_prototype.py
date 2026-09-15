import re
import json

with open('prototype_script.js', 'r', encoding='utf-8') as f:
    text = f.read()

pages = re.findall(r'case\s+[\'"]([a-zA-Z0-9_-]+)[\'"]\s*:', text)
print('Page cases in switch:', sorted(list(set(pages))))

renders = re.findall(r'(render[A-Z][a-zA-Z0-9_]*)\s*\(', text)
print('Render functions:', sorted(list(set(renders))))

# Check the main render() method and pages structure
print("\n--- STATE & DATA STRUCTURE ---")
state_match = re.search(r'state\s*=\s*\{([^}]+)\}', text)
if state_match:
    print("Initial State:", state_match.group(0)[:500])

# Check what methods exist on Component class
methods = re.findall(r'\n\s{2}([a-zA-Z0-9_]+)\s*\([^)]*\)\s*\{', text)
print("\nMethods on Component:", methods)
