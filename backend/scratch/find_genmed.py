with open(r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\agent\agent_service.py", "r", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if "General Medicine" in line or "17" in line:
            print(f"Line {i+1}: {line.strip()[:100]}")
