import requests

base = "http://127.0.0.1:8000"

print("--- 1. /api/finance/bills?search=Novaer ---")
try:
    r = requests.get(f"{base}/api/finance/bills?search=Novaer")
    print(r.status_code, r.json())
except Exception as e:
    print(e)

print("\n--- 2. /api/finance/preauth?search=Novaer ---")
try:
    r = requests.get(f"{base}/api/finance/preauth?search=Novaer")
    print(r.status_code, r.json())
except Exception as e:
    print(e)

print("\n--- 3. /api/finance/insurance-claims?search=Novaer ---")
try:
    r = requests.get(f"{base}/api/finance/insurance-claims?search=Novaer")
    print(r.status_code, r.json())
except Exception as e:
    print(e)

print("\n--- 4. /api/finance/dashboard ---")
try:
    r = requests.get(f"{base}/api/finance/dashboard")
    data = r.json()
    print("Dashboard recent payments count:", len(data.get("recent_payments", [])))
    for p in data.get("recent_payments", []):
        if "Novaer" in str(p.get("patient_name", "")) or "Parthanan" in str(p.get("patient_name", "")):
            print("Found in dashboard:", p)
except Exception as e:
    print(e)
