import sys
import os
import requests

BASE_URL = "http://127.0.0.1:8000"

def test_source_filters():
    print("==================================================")
    print("Testing Doctor Portal / Dashboard Source Filters")
    print("==================================================")
    
    sources = ["WHATSAPP", "WEB_PORTAL", "PHONE", "WALK_IN", "ADMIN", "DOCTOR", ""]
    
    for src in sources:
        params = {}
        if src:
            params["booking_source"] = src
            
        url = f"{BASE_URL}/api/dashboard/appointments"
        try:
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                total = data.get("total", len(data.get("appointments", [])))
                appts = data.get("appointments", [])
                
                # Check actual sources returned in appts sample
                sample_sources = set(a.get("booking_source") for a in appts[:20])
                print(f"[SUCCESS] Filter '{src or 'ALL'}': Total = {total}, Sample sources returned: {sample_sources}")
            else:
                print(f"[FAILED] Filter '{src}': HTTP {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"[ERROR] Filter '{src}': Exception {e}")

if __name__ == "__main__":
    test_source_filters()
