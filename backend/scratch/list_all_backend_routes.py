import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from main import app

def print_all_routes():
    print("================ REGISTERED FASTAPI ROUTES ================")
    routes = []
    for r in app.routes:
        methods = getattr(r, "methods", None)
        path = getattr(r, "path", None)
        name = getattr(r, "name", None)
        if methods and path:
            methods_str = ",".join(methods)
            routes.append((path, methods_str, name))
            
    routes.sort()
    for path, methods_str, name in routes:
        print(f"  {methods_str:<12} {path:<55} ({name})")
    print(f"\nTotal routes: {len(routes)}")

if __name__ == '__main__':
    print_all_routes()
