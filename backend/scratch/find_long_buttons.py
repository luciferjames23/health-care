import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")

for root, dirs, files in os.walk(BACKEND_DIR):
    for file in files:
        if file.endswith(".py") and "scratch" not in root and "tests" not in root:
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            for i, line in enumerate(lines, 1):
                matches = re.findall(r'\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([^"]+)"\s*\}', line)
                for btn_id, btn_title in matches:
                    if len(btn_title) > 20:
                        rel = os.path.relpath(filepath, BACKEND_DIR)
                        print(f"{rel}:{i} ID={btn_id} Title='{btn_title}' (len={len(btn_title)})")
