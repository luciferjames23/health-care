import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

res1 = client.get("/api/v1/clinical/discharge-summaries")
print("res1 status:", res1.status_code)
if res1.status_code == 200:
    data1 = res1.json().get("data", [])
    print("res1 count:", len(data1))
    print("res1 approval_status breakdown:")
    from collections import Counter
    print(Counter(d.get("approval_status") for d in data1))
else:
    print("res1 error:", res1.text[:200])

res2 = client.get("/api/v1/admissions?discharge_status=all")
print("\nres2 status:", res2.status_code)
if res2.status_code == 200:
    data2 = res2.json().get("data", [])
    print("res2 count:", len(data2))
    print("res2 discharge_status breakdown:")
    print(Counter(d.get("discharge_status") for d in data2))
else:
    print("res2 error:", res2.text[:200])
