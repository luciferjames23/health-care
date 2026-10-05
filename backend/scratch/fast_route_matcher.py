import sys
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app

# 1. Build FastAPI route map: {method: [regex_pattern]}
route_patterns = []
for r in app.routes:
    path = getattr(r, 'path', None)
    methods = getattr(r, 'methods', None)
    if path:
        # Convert FastAPI path /api/v1/users/{id} to regex ^/api/v1/users/[^/]+$
        pattern = re.sub(r'\{[^}]+\}', r'[^/]+', path)
        regex = re.compile(f"^{pattern}/?$")
        route_patterns.append((list(methods) if methods else ['GET'], regex, path))

print(f"Total registered backend route patterns: {len(route_patterns)}")

# 2. Extract all API calls from frontend/src/services/api.js
with open('../frontend/src/services/api.js', 'r', encoding='utf-8') as f:
    api_content = f.read()

# Match all method calls like fetchCachedJson(`${API_BASE_URL}/...`), fetchWithTimeout(`${API_BASE_URL}/...`, { method: 'POST' })
# Let's find function blocks or direct occurrences
lines = api_content.split('\n')

unmatched = []
for i, line in enumerate(lines, 1):
    if '${API_BASE_URL}' in line:
        m = re.search(r'`\$\{API_BASE_URL\}(/[^`?]+)', line)
        if m:
            raw_path = m.group(1)
            # detect method from surrounding lines or line itself
            method = 'GET'
            for check_line in lines[max(0, i-5):min(len(lines), i+8)]:
                if "method: 'POST'" in check_line or 'method: "POST"' in check_line:
                    method = 'POST'
                    break
                elif "method: 'PATCH'" in check_line or 'method: "PATCH"' in check_line:
                    method = 'PATCH'
                    break
                elif "method: 'PUT'" in check_line or 'method: "PUT"' in check_line:
                    method = 'PUT'
                    break
                elif "method: 'DELETE'" in check_line or 'method: "DELETE"' in check_line:
                    method = 'DELETE'
                    break
            
            # replace template JS vars with sample string 'test_123'
            test_path = re.sub(r'\$\{[^}]+\}', 'sample_val', raw_path)
            
            # test against route_patterns
            match_found = False
            for methods, regex, original_route in route_patterns:
                if regex.match(test_path):
                    match_found = True
                    break
            
            if not match_found:
                unmatched.append((i, method, raw_path, test_path))

print(f"\nFound {len(unmatched)} potentially unmatched API calls in api.js:")
for line_no, method, raw, test in unmatched:
    print(f"Line {line_no} [{method}]: {raw}  --> test: {test}")
