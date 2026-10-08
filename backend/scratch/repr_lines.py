with open(r"c:\Users\Bsoft137\OneDrive\Documents\health-care\backend\agent\entity_extractor.py", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i in range(417, 462):
        print(f"Line {i+1}: {ascii(lines[i])}")
