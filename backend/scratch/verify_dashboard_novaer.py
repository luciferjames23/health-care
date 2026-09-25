import requests

r = requests.get("http://127.0.0.1:8000/api/finance/dashboard")
data = r.json()
print("Success:", data.get("success"))
matches = [p for p in data.get("recent_payments", []) if p.get("patient_id") == 87231 or "Novaer" in str(p.get("patient_name"))]
print(f"Occurrences of Novaer Parthalan in recent_payments: {len(matches)}")
for m in matches:
    print(m)
