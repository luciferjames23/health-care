import os
import sys
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from main import app
from db_config import get_db_connection
import psycopg2.extras

client = TestClient(app)

def test_all_endpoints():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    print("================ TESTING ALL API ENDPOINTS & COMPARING WITH DB ================")
    
    endpoints = [
        # 1. Admissions & Census
        ("/api/v1/gold/dim_admission_inputs", "Admissions Inputs"),
        ("/api/v1/gold/admissions", "Gold Admissions"),
        ("/api/v1/gold/patients", "Gold Patients"),
        ("/api/v1/gold/beds", "Gold Beds"),
        ("/api/v1/gold/wards", "Gold Wards"),
        ("/api/v1/gold/discharge_summaries", "Gold Discharge Summaries"),
        ("/api/v1/gold/dim_generated_discharge_summaries", "AI Generated Summaries"),
        
        # 2. Clinical Operations
        ("/api/v1/clinical-ops/nursing", "Nursing Tasks"),
        ("/api/v1/clinical-ops/sbar", "SBAR Handovers"),
        ("/api/v1/clinical-ops/emar", "eMAR Medication Admin"),
        ("/api/v1/clinical-ops/emergency", "Emergency Triage"),
        ("/api/v1/clinical-ops/ot", "Operating Rooms & Surgeries"),
        ("/api/v1/clinical-ops/blood-bank", "Blood Bank Inventory"),
        ("/api/v1/clinical-ops/cssd", "CSSD Sterilization Records"),
        ("/api/v1/clinical-ops/death-mlc", "Death & MLC Records"),
        
        # 3. Pharmacy & Supply Chain
        ("/api/v1/pharmacy-supply/pharmacy-dispense", "Pharmacy Dispense & Sales"),
        ("/api/v1/pharmacy-supply/inventory", "Pharmacy Inventory Stock"),
        ("/api/v1/pharmacy-supply/stores", "Hospital Stores"),
        ("/api/v1/pharmacy-supply/procurement", "Procurement Purchase Orders"),
        ("/api/v1/pharmacy-supply/vendors", "Hospital Vendors"),
        
        # 4. Finance & Billing & Claims
        ("/api/v1/finance/bills", "Billing & Invoices"),
        ("/api/v1/finance/payments", "Payment Transactions"),
        ("/api/v1/finance/refunds", "Refunds Ledger"),
        ("/api/v1/finance/claims", "Insurance Claims"),
        
        # 5. HR & Administration
        ("/api/v1/hr-admin/rosters", "Staff Shift Rosters"),
        ("/api/v1/hr-admin/leave-requests", "Employee Leave Requests"),
        ("/api/v1/hr-admin/leave-balances", "Employee Leave Balances"),
        ("/api/v1/hr-admin/audit-logs", "System Audit Logs"),
        ("/api/v1/hr-admin/notifications", "System Notifications"),
        
        # 6. Appointments & Pre-admissions
        ("/api/v1/appointments", "Appointments"),
        ("/api/v1/pre-admissions", "Pre-Admissions"),
    ]
    
    results = []
    for url, desc in endpoints:
        try:
            res = client.get(url)
            status = res.status_code
            if status == 200:
                data = res.json()
                count = None
                if isinstance(data, dict):
                    if "count" in data:
                        count = data["count"]
                    elif "data" in data and isinstance(data["data"], list):
                        count = len(data["data"])
                    elif "total" in data:
                        count = data["total"]
                elif isinstance(data, list):
                    count = len(data)
                
                print(f"[SUCCESS {status}] {desc:<35} -> {url:<45} (returned {count} items)")
                results.append({"desc": desc, "url": url, "status": status, "count": count, "error": None})
            else:
                print(f"[FAIL {status}]    {desc:<35} -> {url:<45} :: {res.text[:100]}")
                results.append({"desc": desc, "url": url, "status": status, "count": 0, "error": res.text})
        except Exception as e:
            print(f"[ERROR]         {desc:<35} -> {url:<45} :: {str(e)}")
            results.append({"desc": desc, "url": url, "status": 500, "count": 0, "error": str(e)})

    conn.close()
    return results

if __name__ == '__main__':
    test_all_endpoints()
