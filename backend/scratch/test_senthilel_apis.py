import sys
import os
import requests

base = "http://127.0.0.1:8000"

print("--- 1. Testing GET /api/finance/bills?search=Senthilel ---")
r = requests.get(f"{base}/api/finance/bills?search=Senthilel")
if r.status_code == 200:
    data = r.json()
    items = data.get("items", [])
    print(f"Returned {len(items)} bills:")
    for it in items:
        print(f"  Bill: {it.get('bill_number')}, Patient: {it.get('patient_name')}, Net: {it.get('net_amount')}, Ins: {it.get('insurance_amount')}, Pat: {it.get('patient_amount')}, Status: {it.get('bill_status')}")
else:
    print(f"Error {r.status_code}: {r.text}")

print("\n--- 2. Testing GET /api/finance/dashboard?search=Senthilel ---")
r = requests.get(f"{base}/api/finance/dashboard?search=Senthilel")
if r.status_code == 200:
    data = r.json()
    txns = data.get("recent_transactions", [])
    print(f"Returned {len(txns)} transactions:")
    for t in txns:
        print(f"  Ref: {t.get('payment_reference')}, Bill: {t.get('bill_number')}, Amount: {t.get('amount')}, Status: {t.get('payment_status')}")
else:
    print(f"Error {r.status_code}: {r.text}")

print("\n--- 3. Testing GET /api/finance/insurance-claims?search=Senthilel ---")
r = requests.get(f"{base}/api/finance/insurance-claims?search=Senthilel")
if r.status_code == 200:
    data = r.json()
    items = data.get("items", [])
    print(f"Returned {len(items)} claims:")
    for it in items:
        print(f"  Claim: {it.get('claim_number')}, Provider: {it.get('insurance_provider')}, Claimed: {it.get('claimed_amount')}, Approved: {it.get('approved_amount')}, Status: {it.get('claim_status')}")
else:
    print(f"Error {r.status_code}: {r.text}")
