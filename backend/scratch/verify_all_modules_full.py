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

def run_verified_suite():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    test_cases = [
        # 1. Admissions & Census
        {
            "module": "1. Admissions & Census",
            "feature": "Active & Total Inpatient Census",
            "db_query": "SELECT count(*) as total, count(CASE WHEN LOWER(COALESCE(discharge_status,'')) != 'discharged' THEN 1 END) as active FROM dim_admission_inputs;",
            "api_url": "/api/v1/gold/current-admission-llm-inputs?limit=1000",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Total: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 2. Executive KPIs
        {
            "module": "1. Admissions & Census",
            "feature": "Executive KPIs Active Inpatients",
            "db_query": "SELECT count(CASE WHEN LOWER(COALESCE(discharge_status,'')) != 'discharged' THEN 1 END) as active FROM dim_admission_inputs;",
            "api_url": "/api/v1/gold/executive-kpis",
            "check_fn": lambda db, api: (db["active"] == api.get("active_admissions"), f"DB Active: {db['active']}, API active_admissions: {api.get('active_admissions')}")
        },
        # 3. Discharge Summaries
        {
            "module": "2. Discharge Command Centre",
            "feature": "Approved & Generated Summaries",
            "db_query": "SELECT count(*) as total FROM dim_generated_discharge_summaries;",
            "api_url": "/api/v1/gold/generated-discharge-summaries?limit=1000",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Summaries: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 4. Nursing Tasks
        {
            "module": "3. Nursing Workspace",
            "feature": "Inpatient Nursing Tasks & Vitals",
            "db_query": "SELECT count(*) as total FROM nursing_tasks;",
            "api_url": "/api/v1/clinical-ops/nursing",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Tasks: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 5. eMAR Medication Admin
        {
            "module": "3. Nursing Workspace",
            "feature": "eMAR Medication Admin Schedules",
            "db_query": "SELECT count(*) as total FROM emar_records;",
            "api_url": "/api/v1/clinical-ops/emar",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB eMAR: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 6. SBAR Handovers Historic & Active Beds
        {
            "module": "3. Nursing Workspace",
            "feature": "Ward SBAR Handover Records",
            "db_query": "SELECT count(*) as total FROM ward_sbar_handovers;",
            "api_url": "/api/v1/clinical-ops/sbar",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB SBAR: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        {
            "module": "3. Nursing Workspace",
            "feature": "SBAR Inpatient Beds (AG-18 Live Census)",
            "db_query": "SELECT count(*) as total FROM nursing_tasks;",
            "api_url": "/api/v1/nursing-handover-agent/beds?limit=300",
            "check_fn": lambda db, api: (db["total"] == api.get("total") and len(api.get("data", [])) == db["total"], f"DB Active Beds: {db['total']}, API Total: {api.get('total')}, Count: {len(api.get('data', []))}")
        },
        # 7. Emergency & Trauma
        {
            "module": "4. Emergency / ED",
            "feature": "Emergency Triage Active Cases",
            "db_query": "SELECT count(*) as total FROM emergency_triage;",
            "api_url": "/api/v1/clinical-ops/emergency",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Triage: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 8. Medico-Legal Cases
        {
            "module": "4. Emergency / ED",
            "feature": "MLC Register Records",
            "db_query": "SELECT count(*) as total FROM mlc_records;",
            "api_url": "/api/v1/clinical-ops/mlc",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB MLC: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 9. Death Registry
        {
            "module": "4. Emergency / ED",
            "feature": "Death & MCCD Form 4 Register",
            "db_query": "SELECT count(*) as total FROM death_registry;",
            "api_url": "/api/v1/clinical-ops/death-registry",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Death Records: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 10. Operating Rooms
        {
            "module": "5. Operating Rooms & Surgeries",
            "feature": "OT Active & Scheduled Surgeries",
            "db_query": "SELECT count(*) as total FROM ot_surgeries;",
            "api_url": "/api/v1/clinical-ops/surgery",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Surgeries: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 11. Blood Bank Units
        {
            "module": "6. Blood Bank & CSSD",
            "feature": "Blood Bank Units & Cross-Match",
            "db_query": "SELECT count(*) as total FROM blood_bank_units;",
            "api_url": "/api/v1/clinical-ops/bloodbank/units",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Blood Units: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 12. CSSD Sterilization
        {
            "module": "6. Blood Bank & CSSD",
            "feature": "CSSD Autoclave Sterilization Cycles",
            "db_query": "SELECT count(*) as total FROM cssd_sterilization_records;",
            "api_url": "/api/v1/pharmacy-supply/cssd",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB CSSD: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 13. Pharmacy Inventory
        {
            "module": "7. Pharmacy & Supply Chain",
            "feature": "Live Drug Inventory Stock",
            "db_query": "SELECT count(*) as total FROM pharmacy_inventory;",
            "api_url": "/api/v1/pharmacy-supply/inventory",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Inventory Batches: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 14. Hospital Stores
        {
            "module": "7. Pharmacy & Supply Chain",
            "feature": "Central & Ward Stores",
            "db_query": "SELECT count(*) as total FROM hospital_stores;",
            "api_url": "/api/v1/pharmacy-supply/stores",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Stores: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 15. Procurement
        {
            "module": "7. Pharmacy & Supply Chain",
            "feature": "Purchase Orders & PO Fulfillment",
            "db_query": "SELECT count(*) as total FROM procurement_orders;",
            "api_url": "/api/v1/pharmacy-supply/procurement",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Purchase Orders: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 16. Vendors
        {
            "module": "7. Pharmacy & Supply Chain",
            "feature": "Hospital Registered Vendors",
            "db_query": "SELECT count(*) as total FROM hospital_vendors;",
            "api_url": "/api/v1/pharmacy-supply/vendors",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Vendors: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 17. Drug Master
        {
            "module": "7. Pharmacy & Supply Chain",
            "feature": "Formulary Drug Master",
            "db_query": "SELECT count(*) as total FROM medications;",
            "api_url": "/api/v1/pharmacy-supply/drugs",
            "check_fn": lambda db, api: (db["total"] == len(api.get("data", [])), f"DB Medications: {db['total']}, API Count: {len(api.get('data', []))}")
        },
        # 18. Billing & Invoices
        {
            "module": "8. Billing, Finance & Claims",
            "feature": "Patient Bills & Revenue",
            "db_query": "SELECT count(*) as total FROM bills;",
            "api_url": "/api/finance/bills?page=1&page_size=1",
            "check_fn": lambda db, api: (db["total"] == api.get("total"), f"DB Bills: {db['total']}, API total: {api.get('total')}")
        },
        # 19. Insurance Claims
        {
            "module": "8. Billing, Finance & Claims",
            "feature": "Insurance Claims Tracker",
            "db_query": "SELECT count(*) as total FROM insurance_claims;",
            "api_url": "/api/finance/insurance-claims?page=1&page_size=1",
            "check_fn": lambda db, api: (db["total"] == api.get("total"), f"DB Claims: {db['total']}, API total: {api.get('total')}")
        },
        # 20. Finance Overview
        {
            "module": "8. Billing, Finance & Claims",
            "feature": "Financial Overview Aggregates",
            "db_query": "SELECT count(*) as total_bills, sum(net_amount) as total_net FROM bills;",
            "api_url": "/api/finance/overview",
            "check_fn": lambda db, api: (db["total_bills"] == api.get("bills", {}).get("total_bills"), f"DB Bills: {db['total_bills']}, API: {api.get('bills', {}).get('total_bills')}")
        },
        # 21. HR Staff Roster
        {
            "module": "9. HR & Administration",
            "feature": "Staff Duty Rosters",
            "db_query": "SELECT count(*) as total FROM users;",
            "api_url": "/api/v1/admin/hr-dashboard",
            "check_fn": lambda db, api: (db["total"] == api.get("total"), f"DB Staff Users: {db['total']}, API Total: {api.get('total')}")
        },
        # 22. Pre-Admissions
        {
            "module": "10. Pre-Admissions & Appointments",
            "feature": "Elective Surgical Pre-Admissions",
            "db_query": "SELECT count(*) as total FROM pre_admissions;",
            "api_url": "/api/dashboard/pre-admissions",
            "check_fn": lambda db, api: (db["total"] == len(api.get("pre_admissions", [])), f"DB Pre-Admissions: {db['total']}, API Count: {len(api.get('pre_admissions', []))}")
        },
        # 23. Appointments
        {
            "module": "10. Pre-Admissions & Appointments",
            "feature": "OPD Bookings & Appointments",
            "db_query": "SELECT count(*) as total FROM appointments;",
            "api_url": "/api/dashboard/appointments?page=1&per_page=1",
            "check_fn": lambda db, api: (db["total"] == api.get("total"), f"DB Appointments: {db['total']}, API total: {api.get('total')}")
        },
        # 24. Doctors Roster
        {
            "module": "10. Pre-Admissions & Appointments",
            "feature": "Doctors Directory & Specializations",
            "db_query": "SELECT count(*) as total FROM doctors;",
            "api_url": "/api/dashboard/doctors",
            "check_fn": lambda db, api: (db["total"] == len(api.get("doctors", [])), f"DB Doctors: {db['total']}, API Count: {len(api.get('doctors', []))}")
        },
        # 25. Departments
        {
            "module": "10. Pre-Admissions & Appointments",
            "feature": "Clinical Departments Master",
            "db_query": "SELECT count(*) as total FROM departments;",
            "api_url": "/api/dashboard/departments",
            "check_fn": lambda db, api: (db["total"] == len(api.get("departments", [])), f"DB Departments: {db['total']}, API Count: {len(api.get('departments', []))}")
        }
    ]

    print("\n" + "="*110)
    print(f"{'STATUS':<8} {'MODULE':<32} {'FEATURE':<38} {'DETAILS'}")
    print("="*110)

    pass_cnt = 0
    fail_cnt = 0

    for tc in test_cases:
        cur.execute(tc["db_query"])
        db_res = cur.fetchone()
        
        headers = {"Authorization": "Bearer demo-session-token"}
        api_res = client.get(tc["api_url"], headers=headers)
        
        if api_res.status_code != 200:
            status = "FAIL"
            detail = f"HTTP {api_res.status_code}: {api_res.text[:80]}"
            fail_cnt += 1
        else:
            api_data = api_res.json()
            is_pass, detail = tc["check_fn"](db_res, api_data)
            if is_pass:
                status = "PASS"
                pass_cnt += 1
            else:
                status = "FAIL"
                fail_cnt += 1

        print(f"[{status}] {tc['module']:<32} | {tc['feature']:<38} | {detail}")

    conn.close()

    print("\n" + "="*110)
    print(f"FINAL AUDIT RESULT: {pass_cnt} PASSED / MATCHED, {fail_cnt} FAILED out of {len(test_cases)} test cases.")
    print("="*110 + "\n")

if __name__ == '__main__':
    run_verified_suite()
