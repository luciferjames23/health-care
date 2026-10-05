import re
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app

# 1. Get all FastAPI routes
fastapi_routes = set()
for route in app.routes:
    path = getattr(route, 'path', None)
    if path:
        # normalize path: replace {param} with {*}
        norm = re.sub(r'\{[^}]+\}', '{*}', path)
        fastapi_routes.add(norm)
        fastapi_routes.add(path)

print(f"Total backend routes loaded: {len(fastapi_routes)}")

# 2. Extract all API calls from frontend/src/services/api.js
with open('../frontend/src/services/api.js', 'r', encoding='utf-8') as f:
    api_content = f.read()

# Match template string endpoints ${API_BASE_URL}/...
matches = re.findall(r'`\$\{API_BASE_URL\}(/[^`?]+)', api_content)

missing = []
for m in matches:
    # normalize ${...} in frontend url to {*}
    norm_frontend = re.sub(r'\$\{[^}]+\}', '{*}', m)
    # also remove trailing slash if any
    norm_frontend_clean = norm_frontend.rstrip('/')
    
    # check if matched in any backend route
    matched = False
    for r in fastapi_routes:
        if r == norm_frontend or r == norm_frontend_clean or r == m:
            matched = True
            break
        # also match /api/v1/pharmacy-supply/... style
    if not matched:
        missing.append((m, norm_frontend))

print(f"\nPotential Unmatched Endpoints in api.js ({len(missing)}):")
for raw, norm in set(missing):
    print(f"RAW: {raw}  |  NORM: {norm}")
