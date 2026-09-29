import os
import re
import sys
import glob
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend")

print("============================================================")
print("COMPREHENSIVE WHATSAPP PATIENT DESK RESPONSE QUALITY AUDIT")
print("============================================================")

issues_found = []

# 1. Audit button title lengths and labels across all Python files
print("\n[1] AUDITING ALL INTERACTIVE BUTTON DEFINITIONS...")
for root, dirs, files in os.walk(BACKEND_DIR):
    for file in files:
        if file.endswith(".py") and "scratch" not in root and "tests" not in root:
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            for line_idx, line in enumerate(lines, start=1):
                # Match {"id": "...", "title": "..."}
                matches = re.findall(r'\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([^"]+)"\s*\}', line)
                for btn_id, btn_title in matches:
                    if len(btn_title) > 20:
                        issues_found.append({
                            "file": os.path.relpath(filepath, BACKEND_DIR),
                            "line": line_idx,
                            "type": "BUTTON_TITLE_TRUNCATED",
                            "detail": f"ID: {btn_id} | Title: '{btn_title}' ({len(btn_title)} chars > 20 max limit)"
                        })
                    if btn_title.lower() in ["select option", "select an option", "option 1", "click here"]:
                        issues_found.append({
                            "file": os.path.relpath(filepath, BACKEND_DIR),
                            "line": line_idx,
                            "type": "GENERIC_BUTTON_TITLE",
                            "detail": f"ID: {btn_id} | Title: '{btn_title}' should be specific"
                        })

# 2. Check for typos & grammar issues in text literals
print("\n[2] CHECKING FOR TYPOS AND GRAMMAR IN RESPONSE STRINGS...")
typos_to_check = [
    (r"\bmetho\b", "metho -> method"),
    (r"select payment metho", "Select Payment Metho -> Select Payment Method"),
    (r"\bchoose a time\b", "vague 'choose a time' -> 'Choose a Time Slot' or 'Available Time Slots'"),
    (r"\bnull\b", "raw null displayed"),
    (r"\bundefined\b", "raw undefined displayed"),
    (r"\bnone\b", "check for raw 'None' in formatted string templates"),
]

for root, dirs, files in os.walk(BACKEND_DIR):
    for file in files:
        if file.endswith(".py") and "scratch" not in root and "tests" not in root:
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            for line_idx, line in enumerate(lines, start=1):
                # Skip comments
                if line.strip().startswith("#"):
                    continue
                for pattern, msg in typos_to_check:
                    if re.search(pattern, line, re.IGNORECASE):
                        issues_found.append({
                            "file": os.path.relpath(filepath, BACKEND_DIR),
                            "line": line_idx,
                            "type": "TEXT_TYPO_OR_LABEL_ISSUE",
                            "detail": f"{msg} | Line snippet: {line.strip()[:100]}"
                        })

print(f"\nAudit complete. Total issues flagged: {len(issues_found)}")
for i in issues_found[:30]:
    print(f"[{i['type']}] {i['file']}:{i['line']} -> {i['detail']}")
