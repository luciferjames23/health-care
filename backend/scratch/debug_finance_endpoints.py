import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("--- Testing /api/finance/bills ---")
res = client.get("/api/finance/bills?page=1&page_size=5")
print("Status:", res.status_code)
if res.status_code != 200:
    print("Error:", res.text)
else:
    print("Bills response keys:", res.json().keys())
    print("Pagination:", res.json().get("pagination"))
    print("Sample bill:", res.json().get("data", [])[0] if res.json().get("data") else "No data")

print("\n--- Testing /api/finance/insurance-claims ---")
res = client.get("/api/finance/insurance-claims?page=1&page_size=5")
print("Status:", res.status_code)
if res.status_code != 200:
    print("Error:", res.text)
else:
    print("Claims response keys:", res.json().keys())
    print("Pagination:", res.json().get("pagination"))

print("\n--- Testing /api/finance/payments ---")
res = client.get("/api/finance/payments?page=1&page_size=5")
print("Status:", res.status_code)
if res.status_code != 200:
    print("Error:", res.text)
else:
    print("Payments response keys:", res.json().keys())
    print("Pagination:", res.json().get("pagination"))
