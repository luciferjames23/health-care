import re
import os
from pathlib import Path

frontend_dir = Path(__file__).resolve().parent.parent.parent / 'frontend' / 'src'
api_js = frontend_dir / 'services' / 'api.js'

# Extract all methods defined in api.js
api_content = api_js.read_text(encoding='utf-8', errors='ignore')
defined_methods = set(re.findall(r'async\s+([a-zA-Z0-9_]+)\s*\(', api_content))
defined_methods.update(re.findall(r'([a-zA-Z0-9_]+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>', api_content))
defined_methods.update(re.findall(r'([a-zA-Z0-9_]+)\s*\(.*?\)\s*\{', api_content))

print(f"Total methods defined in api.js: {len(defined_methods)}")

# Scan all frontend files for apiService.methodName()
called_methods = {}
pattern = re.compile(r'apiService\.([a-zA-Z0-9_]+)\(')

for root, _, files in os.walk(frontend_dir):
    for f in files:
        if f.endswith(('.jsx', '.js', '.tsx', '.ts')):
            path = Path(root) / f
            if path == api_js:
                continue
            content = path.read_text(encoding='utf-8', errors='ignore')
            matches = pattern.findall(content)
            for m in matches:
                called_methods.setdefault(m, []).append(f)

print(f"Total unique apiService methods called across components: {len(called_methods)}\n")

missing = []
for method, callers in sorted(called_methods.items()):
    if method not in defined_methods:
        missing.append((method, set(callers)))
        print(f"[MISSING] apiService.{method}() called in: {', '.join(set(callers))}")
    else:
        # print(f"[OK]      apiService.{method}()")
        pass

print(f"\nSummary: {len(missing)} missing methods found on apiService!")
