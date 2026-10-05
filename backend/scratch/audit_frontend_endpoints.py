import re
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app
from db_config import get_db_connection
import psycopg2.extras

client = TestClient(app)

def extract_endpoints_from_frontend():
    frontend_src = Path(__file__).resolve().parent.parent.parent / 'frontend' / 'src'
    endpoint_set = set()
    
    # Regex to capture /api/v1/... or /api/... endpoints in template strings or normal strings
    pattern = re.compile(r'/api/(?:v1/)?[a-zA-Z0-9_\-\/]+')
    
    for root, _, files in os.walk(frontend_src):
        for f in files:
            if f.endswith(('.js', '.jsx', '.ts', '.tsx')):
                path = Path(root) / f
                content = path.read_text(encoding='utf-8', errors='ignore')
                matches = pattern.findall(content)
                for m in matches:
                    # Clean trailing slashes or unwanted endings
                    clean_m = m.rstrip('/')
                    if clean_m.count('/') >= 2:
                        endpoint_set.add((clean_m, f))

    print(f"Found {len(endpoint_set)} distinct API endpoints in frontend code.")
    return sorted(list(endpoint_set))

def test_endpoints():
    endpoints = extract_endpoints_from_frontend()
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    success_count = 0
    fail_count = 0
    failures = []
    
    print("\n" + "="*80)
    print(f"{'STATUS':<10} {'FILE':<25} {'ENDPOINT':<45}")
    print("="*80)
    
    for endpoint, filename in endpoints:
        # Skip websocket or dynamic patterns that shouldn't be GET directly if any
        if 'ws' in endpoint:
            continue
        try:
            res = client.get(endpoint)
            if res.status_code == 200:
                print(f"[OK 200]   {filename:<25} {endpoint:<45}")
                success_count += 1
            else:
                print(f"[FAIL {res.status_code}] {filename:<25} {endpoint:<45} :: {res.text[:80]}")
                fail_count += 1
                failures.append((filename, endpoint, res.status_code, res.text[:120]))
        except Exception as e:
            print(f"[ERROR]    {filename:<25} {endpoint:<45} :: {str(e)[:80]}")
            fail_count += 1
            failures.append((filename, endpoint, 500, str(e)))

    print("\n" + "="*80)
    print(f"RESULTS: {success_count} Passed, {fail_count} Failed out of {len(endpoints)}")
    print("="*80)
    
    if failures:
        print("\n--- FAILURES DETAIL ---")
        for f_name, ep, status, err in failures:
            print(f"File: {f_name} | Endpoint: {ep} | Status: {status}")
            print(f"  Error: {err}\n")

if __name__ == '__main__':
    test_endpoints()
