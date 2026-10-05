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

def run_all_module_verifications():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    results = []

    def verify(module, subfeature, db_val, api_val, details=""):
        # Match if values match or if lengths match
        is_match = (db_val == api_val)
        status = "PASS" if is_match else "FAIL"
        results.append({
            "module": module,
            "subfeature": subfeature,
            "status": status,
            "db_value": db_val,
            "api_value": api_val,
            "details": details
        })
        print(f"[{status}] {module:<28} | {subfeature:<30} | DB: {str(db_val):<8} | API: {str(api_val):<8} | {details}")

    print("\n" + "="*100)
    print("RUNNING COMPLETE MULTI-MODULE DB VS API/UI AUDIT")
    print("="*100 + "\n")

    # 1. ADMISSIONS & CENSUS
    cur.execute("SELECT count(*) as cnt FROM dim_admission_inputs;")
    db_dim_adm = cur.fetchone()['cnt']
    res = client.get("/api/v1/gold/current-admission-llm-inputs?limit=1000")
    api_adm = len(res.json().get("data", [])) if res.status_code == 200 else -1
    verify("Admissions & Census", "Total Inpatient Records", db_dim_adm, api_adm, "/api/v1/gold/current-admission-llm-inputs")

    cur.execute("SELECT count(DISTINCT patient_id) as cnt FROM dim_admission_inputs WHERE LOWER(COALESCE(discharge_status, '')) != 'discharged';")
    db_active_inpatients = cur.fetchone()['cnt']
    res_kpi = client.get("/api/v1/gold/executive-kpis")
    kpi_json = res_kpi.json() if res_kpi.status_code == 200 else {}
    api_active_inpatients = kpi_json.get("kpis", {}).get("active_inpatients")
    verify("Admissions & Census", "Active Inpatients Count", db_active_inpatients, api_active_inpatients, "/api/v1/gold/executive-kpis")

    cur.execute("SELECT count(*) as cnt FROM dim_generated_discharge_summaries;")
    db_gen_dc = cur.fetchone()['cnt']
    res_dc = client.get("/api/v1/gold/generated-discharge-summaries?limit=1000")
    api_gen_dc = len(res_dc.json().get("data", [])) if res_dc.status_code == 200 else -1
    verify("Discharge Summaries", "Generated Summaries Count", db_gen_dc, api_gen_dc, "/api/v1/gold/generated-discharge-summaries")

    # 2. NURSING WORKSPACE & CLINICAL OPS
    cur.execute("SELECT count(*) as cnt FROM nursing_tasks;")
    db_nursing = cur.fetchone()['cnt']
    res_nursing = client.get("/api/v1/clinical-ops/nursing")
    api_nursing = len(res_nursing.json().get("data", [])) if res_nursing.status_code == 200 else -1
    verify("Nursing Workspace", "Total Nursing Tasks", db_nursing, api_nursing, "/api/v1/clinical-ops/nursing")

    cur.execute("SELECT count(*) as cnt FROM emar_records;")
    db_emar = cur.fetchone()['cnt']
    res_emar = client.get("/api/v1/clinical-ops/emar")
    api_emar = len(res_emar.json().get("data", [])) if res_emar.status_code == 200 else -1
    verify("Medication Admin (eMAR)", "eMAR Admin Records", db_emar, api_emar, "/api/v1/clinical-ops/emar")

    cur.execute("SELECT count(*) as cnt FROM ward_sbar_handovers;")
    db_sbar = cur.fetchone()['cnt']
    res_sbar = client.get("/api/v1/clinical-ops/sbar")
    api_sbar = len(res_sbar.json().get("data", [])) if res_sbar.status_code == 200 else -1
    verify("Nursing Handover (SBAR)", "SBAR Shift Records", db_sbar, api_sbar, "/api/v1/clinical-ops/sbar")

    # 3. EMERGENCY & TRAUMA & MLC
    cur.execute("SELECT count(*) as cnt FROM emergency_triage;")
    db_er = cur.fetchone()['cnt']
    res_er = client.get("/api/v1/clinical-ops/emergency")
    api_er = len(res_er.json().get("data", [])) if res_er.status_code == 200 else -1
    verify("Emergency / ED", "Emergency Triage Cases", db_er, api_er, "/api/v1/clinical-ops/emergency")

    cur.execute("SELECT count(*) as cnt FROM mlc_records;")
    db_mlc = cur.fetchone()['cnt']
    res_mlc = client.get("/api/v1/clinical-ops/death-mlc")
    api_mlc = len(res_mlc.json().get("data", [])) if res_mlc.status_code == 200 else -1
    verify("Death & MLC", "MLC / Death Records", db_mlc, api_mlc, "/api/v1/clinical-ops/death-mlc")

    # 4. OPERATING ROOMS (OT) & SURGERIES
    cur.execute("SELECT count(*) as cnt FROM ot_surgeries;")
    db_surgeries = cur.fetchone()['cnt']
    res_surgeries = client.get("/api/v1/clinical-ops/surgery")
    api_surgeries = len(res_surgeries.json().get("data", [])) if res_surgeries.status_code == 200 else -1
    verify("Operating Rooms / Surgery", "OT Surgeries Scheduled", db_surgeries, api_surgeries, "/api/v1/clinical-ops/surgery")

    # 5. BLOOD BANK & CSSD
    cur.execute("SELECT count(*) as cnt FROM blood_bank_units;")
    db_bb_units = cur.fetchone()['cnt']
    res_bb = client.get("/api/v1/clinical-ops/bloodbank/units")
    api_bb_units = len(res_bb.json().get("data", [])) if res_bb.status_code == 200 else -1
    verify("Blood Bank", "Blood Component Units", db_bb_units, api_bb_units, "/api/v1/clinical-ops/bloodbank/units")

    cur.execute("SELECT count(*) as cnt FROM cssd_sterilization_records;")
    db_cssd = cur.fetchone()['cnt']
    res_cssd = client.get("/api/v1/pharmacy-supply/cssd")
    api_cssd = len(res_cssd.json().get("data", [])) if res_cssd.status_code == 200 else -1
    verify("CSSD Sterilization", "Sterilization Load Records", db_cssd, api_cssd, "/api/v1/pharmacy-supply/cssd")

    # 6. PHARMACY & SUPPLY CHAIN
    cur.execute("SELECT count(*) as cnt FROM pharmacy_inventory;")
    db_pharm_inv = cur.fetchone()['cnt']
    res_pinv = client.get("/api/v1/pharmacy-supply/inventory")
    api_pharm_inv = len(res_pinv.json().get("data", [])) if res_pinv.status_code == 200 else -1
    verify("Pharmacy & Inventory", "Inventory Drug Batches", db_pharm_inv, api_pharm_inv, "/api/v1/pharmacy-supply/inventory")

    cur.execute("SELECT count(*) as cnt FROM hospital_stores;")
    db_stores = cur.fetchone()['cnt']
    res_stores = client.get("/api/v1/pharmacy-supply/stores")
    api_stores = len(res_stores.json().get("data", [])) if res_stores.status_code == 200 else -1
    verify("Hospital Stores", "Central & Ward Stores", db_stores, api_stores, "/api/v1/pharmacy-supply/stores")

    cur.execute("SELECT count(*) as cnt FROM procurement_orders;")
    db_proc = cur.fetchone()['cnt']
    res_proc = client.get("/api/v1/pharmacy-supply/procurement")
    api_proc = len(res_proc.json().get("data", [])) if res_proc.status_code == 200 else -1
    verify("Procurement", "Purchase Orders", db_proc, api_proc, "/api/v1/pharmacy-supply/procurement")

    cur.execute("SELECT count(*) as cnt FROM hospital_vendors;")
    db_vendors = cur.fetchone()['cnt']
    res_vendors = client.get("/api/v1/pharmacy-supply/vendors")
    api_vendors = len(res_vendors.json().get("data", [])) if res_vendors.status_code == 200 else -1
    verify("Hospital Vendors", "Authorized Vendors", db_vendors, api_vendors, "/api/v1/pharmacy-supply/vendors")

    cur.execute("SELECT count(*) as cnt FROM medications;")
    db_drugs = cur.fetchone()['cnt']
    res_drugs = client.get("/api/v1/pharmacy-supply/drugs")
    api_drugs = len(res_drugs.json().get("data", [])) if res_drugs.status_code == 200 else -1
    verify("Drug Master", "Formulary Drugs", db_drugs, api_drugs, "/api/v1/pharmacy-supply/drugs")

    # 7. BILLING, PAYMENTS & INSURANCE CLAIMS
    cur.execute("SELECT count(*) as cnt FROM bills;")
    db_bills = cur.fetchone()['cnt']
    res_bills = client.get("/api/finance/bills?page_size=1")
    api_bills = res_bills.json().get("pagination", {}).get("total", -1) if res_bills.status_code == 200 else -1
    verify("Billing & Invoices", "Total Bills Count", db_bills, api_bills, "/api/finance/bills")

    cur.execute("SELECT count(*) as cnt FROM insurance_claims;")
    db_claims = cur.fetchone()['cnt']
    res_claims = client.get("/api/finance/insurance-claims?page_size=1")
    api_claims = res_claims.json().get("pagination", {}).get("total", -1) if res_claims.status_code == 200 else -1
    verify("Insurance Claims", "Total Claims Count", db_claims, api_claims, "/api/finance/insurance-claims")

    cur.execute("SELECT count(*) as cnt FROM payments;")
    db_payments = cur.fetchone()['cnt']
    res_pay = client.get("/api/finance/payments?page_size=1")
    api_payments = res_pay.json().get("pagination", {}).get("total", -1) if res_pay.status_code == 200 else -1
    verify("Payments", "Total Payments Count", db_payments, api_payments, "/api/finance/payments")

    # 8. HR & ADMINISTRATION
    cur.execute("SELECT count(*) as cnt FROM staff_rosters;")
    db_rosters = cur.fetchone()['cnt']
    res_rosters = client.get("/api/v1/admin/rosters")
    api_rosters = len(res_rosters.json().get("data", [])) if res_rosters.status_code == 200 else -1
    verify("HR & Staff Rosters", "Staff Duty Rosters", db_rosters, api_rosters, "/api/v1/admin/rosters")

    cur.execute("SELECT count(*) as cnt FROM employee_leave_requests;")
    db_leave = cur.fetchone()['cnt']
    res_leave = client.get("/api/v1/admin/leave-requests")
    api_leave = len(res_leave.json().get("data", [])) if res_leave.status_code == 200 else -1
    verify("HR & Leave", "Leave Requests", db_leave, api_leave, "/api/v1/admin/leave-requests")

    cur.execute("SELECT count(*) as cnt FROM employee_leave_balances;")
    db_leave_bal = cur.fetchone()['cnt']
    res_leave_bal = client.get("/api/v1/admin/leave-balances")
    api_leave_bal = len(res_leave_bal.json().get("data", [])) if res_leave_bal.status_code == 200 else -1
    verify("HR & Leave", "Leave Balances", db_leave_bal, api_leave_bal, "/api/v1/admin/leave-balances")

    # 9. APPOINTMENTS & PRE-ADMISSIONS
    cur.execute("SELECT count(*) as cnt FROM pre_admissions;")
    db_preadm = cur.fetchone()['cnt']
    res_preadm = client.get("/api/v1/pre-admissions")
    api_preadm = len(res_preadm.json().get("data", [])) if res_preadm.status_code == 200 else -1
    verify("Pre-Admissions", "Pre-Admissions Count", db_preadm, api_preadm, "/api/v1/pre-admissions")

    conn.close()

    total_passed = sum(1 for r in results if r["status"] == "PASS")
    total_failed = sum(1 for r in results if r["status"] == "FAIL")
    print("\n" + "="*100)
    print(f"AUDIT SUMMARY: {total_passed} PASSED, {total_failed} FAILED / MISMATCHED")
    print("="*100 + "\n")

    return results

if __name__ == '__main__':
    run_all_module_verifications()
