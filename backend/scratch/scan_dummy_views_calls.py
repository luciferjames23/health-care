import re
from pathlib import Path

path = Path('frontend/src/components/DummyDomainViews.jsx')
content = path.read_text(encoding='utf-8', errors='ignore')

calls = sorted(list(set(re.findall(r'apiService\.([a-zA-Z0-9_]+)\(', content))))
print(f"Total apiService methods called in DummyDomainViews.jsx: {len(calls)}")
for c in calls:
    print(f" - {c}")
