import re
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with open(r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\agent\agent_service.py", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, l in enumerate(lines, 1):
    if "Dr." in l and not l.strip().startswith("#"):
        if '"Dr.' in l or "'Dr." in l:
            print(f"Line {i}: {l.strip()[:100]}")
