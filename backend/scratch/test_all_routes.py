import urllib.request
import sys
import os

backend_dir = r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend"
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from main import app

print("DUMPING ALL APP ROUTES AND TESTING GET ENDPOINTS:")
print("=" * 70)

for route in app.routes:
    path = getattr(route, "path", None)
    methods = getattr(route, "methods", None)
    if path and "GET" in (methods or []):
        if "{" in path:
            continue
        url = f"http://127.0.0.1:8000{path}"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as resp:
                print(f"[200 OK] {path}")
        except urllib.error.HTTPError as e:
            print(f"[{e.code}] {path}")
        except Exception as e:
            print(f"[ERR] {path} -> {e}")
