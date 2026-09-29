import sys
import os
import requests

base = "http://127.0.0.1:8000"

print("--- Testing GET /api/finance/bills?search=Senthilel+Parthalan ---")
r = requests.get(f"{base}/api/finance/bills?search=Senthilel+Parthalan")
if r.status_code == 200:
    data = r.json()
    items = data.get("items", [])
    print(f"Returned {len(items)} bills:")
    for it in items:
        print(f"  Bill: {it.get('bill_number')}, Patient: {it.get('patient_name')}, Net: {it.get('net_amount')}, Status: {it.get('status') or it.get('bill_status')}")
else:
    print(f"Error {r.status_code}: {r.text}")

print("\n--- Testing GET /api/finance/dashboard?search=Senthilel+Parthalan ---")
r = requests.get(f"{base}/api/finance/dashboard?search=Senthilel+Parthalan")
if r.status_code == 200:
    data = r.json()
    txns = data.get("recent_transactions", [])
    print(f"Returned {len(txns)} transactions:")
    for t in txns:
        print(f"  Ref: {t.get('payment_reference')}, Bill: {t.get('bill_number')}, Amount: {t.get('amount')}, Status: {t.get('payment_status')}")
else:
    print(f"Error {r.status_code}: {r.text}")
