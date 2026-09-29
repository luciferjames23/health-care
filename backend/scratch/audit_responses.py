import os
import re
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")

print("=== AUDITING WHATSAPP BUTTON TITLES & RESPONSES ===")

# 1. Search for interactive buttons across backend
for root, dirs, files in os.walk(BACKEND_DIR):
    for file in files:
        if file.endswith(".py"):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                
            # Find button dicts
            btn_matches = re.findall(r'\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([^"]+)"\s*\}', content)
            if btn_matches:
                rel_path = os.path.relpath(filepath, BACKEND_DIR)
                print(f"\n--- {rel_path} ({len(btn_matches)} buttons) ---")
                for btn_id, btn_title in btn_matches:
                    # Check length (>20 chars will truncate in WhatsApp)
                    status = "OK"
                    if len(btn_title) > 20:
                        status = f"WARNING (TRUNCATED >20 chars: {len(btn_title)})"
                    print(f"  [{status}] ID: {btn_id:<30} Title: '{btn_title}'")
