import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from routers.discharge_agent import router

print(f"Prefix: {router.prefix}")
for route in router.routes:
    methods = ",".join(route.methods)
    print(f"  [{methods}] {router.prefix}{route.path} -> {route.name}")
