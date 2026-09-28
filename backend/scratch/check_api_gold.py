import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import requests

base = "http://127.0.0.1:8000"

r1 = requests.get(f"{base}/api/gold/dim-admission-inputs?limit=500")
data1 = r1.json().get("data", [])
print(f"dim-admission-inputs total: {len(data1)}")
status_counts = {}
for d in data1:
    st = d.get("discharge_status")
    status_counts[st] = status_counts.get(st, 0) + 1
print("dim-admission-inputs status counts:", status_counts)

r2 = requests.get(f"{base}/api/gold/generated-discharge-summaries?limit=500")
data2 = r2.json().get("data", [])
print(f"\ngenerated-discharge-summaries total: {len(data2)}")
approval_counts = {}
for d in data2:
    st = d.get("approval_status")
    approval_counts[st] = approval_counts.get(st, 0) + 1
print("generated-discharge-summaries approval counts:", approval_counts)
