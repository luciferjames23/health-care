import ast

with open(r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\agent\agent_service.py", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if line.lstrip().startswith("def "):
            print(f"Line {i+1}: {line.strip()}")
