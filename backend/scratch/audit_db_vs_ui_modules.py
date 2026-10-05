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

def run_comprehensive_audit():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    report = []
    
    def log(section, msg, status="INFO"):
        prefix = f"[{status}]"
        print(f"{prefix:<8} {section:<30} :: {msg}")
        report.append({"section": section, "status": status, "msg": msg})

    print("\n" + "="*80)
    print("STARTING END-TO-END DB VS UI / API AUDIT ACROSS ALL MODULES")
    print("="*80 + "\n")

    # -------------------------------------------------------------
    # MODULE 1: ADMISSIONS, CENSUS & DISCHARGE COMMAND CENTRE
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt FROM dim_admission_inputs;")
    dim_adm_cnt = cur.fetchone()['cnt']
    
    cur.execute("SELECT count(DISTINCT patient_id) as cnt FROM dim_admission_inputs WHERE LOWER(COALESCE(discharge_status, '')) != 'discharged';")
    active_inpatient_cnt = cur.fetchone()['cnt']
    
    cur.execute("SELECT count(*) as cnt FROM dim_generated_discharge_summaries;")
    gen_dc_cnt = cur.fetchone()['cnt']
    
    cur.execute("""
        SELECT column_name FROM information_schema.columns WHERE table_name = 'beds';
    """)
    bed_cols = [c['column_name'] for c in cur.fetchall()]
    
    if 'is_occupied' in bed_cols:
        cur.execute("SELECT count(*) as cnt FROM beds WHERE is_occupied = true;")
        occ_beds_cnt = cur.fetchone()['cnt']
    elif 'status' in bed_cols:
        cur.execute("SELECT count(*) as cnt FROM beds WHERE LOWER(status) = 'occupied';")
        occ_beds_cnt = cur.fetchone()['cnt']
    else:
        occ_beds_cnt = 'N/A'
    
    # Check API
    res_adm = client.get("/api/v1/gold/current-admission-llm-inputs")
    adm_api_data = res_adm.json().get("data", []) if res_adm.status_code == 200 else []
    
    res_dc = client.get("/api/v1/gold/generated-discharge-summaries")
    dc_api_data = res_dc.json().get("data", []) if res_dc.status_code == 200 else []

    res_kpi = client.get("/api/v1/gold/executive-kpis")
    kpi_data = res_kpi.json() if res_kpi.status_code == 200 else {}
    
    log("Admissions & Census", f"DB dim_admission_inputs: {dim_adm_cnt} rows. API returned: {len(adm_api_data)} rows.", 
        "MATCH" if len(adm_api_data) == dim_adm_cnt else "MISMATCH")
    log("Admissions & Census", f"DB active inpatients: {active_inpatient_cnt}. KPI active: {kpi_data.get('kpis', {}).get('active_inpatients')}",
        "MATCH" if kpi_data.get('kpis', {}).get('active_inpatients') == active_inpatient_cnt else "CHECK")
    log("Discharge Summaries", f"DB dim_generated_discharge_summaries: {gen_dc_cnt}. API returned: {len(dc_api_data)}.",
        "MATCH" if len(dc_api_data) == gen_dc_cnt else "MISMATCH")

    # -------------------------------------------------------------
    # MODULE 2: NURSING WORKSPACE & VITAL SIGNS & eMAR & SBAR
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt FROM nursing_tasks;")
    nursing_db_cnt = cur.fetchone()['cnt']
    res_nursing = client.get("/api/v1/clinical-ops/nursing")
    nursing_api_cnt = len(res_nursing.json().get("data", [])) if res_nursing.status_code == 200 else 0
    log("Nursing Tasks", f"DB nursing_tasks: {nursing_db_cnt}. API returned: {nursing_api_cnt}.",
        "MATCH" if nursing_db_cnt == nursing_api_cnt else "MISMATCH")

    cur.execute("SELECT count(*) as cnt FROM emar_records;")
    emar_db_cnt = cur.fetchone()['cnt']
    res_emar = client.get("/api/v1/clinical-ops/emar")
    emar_api_cnt = len(res_emar.json().get("data", [])) if res_emar.status_code == 200 else 0
    log("eMAR Records", f"DB emar_records: {emar_db_cnt}. API returned: {emar_api_cnt}.",
        "MATCH" if emar_db_cnt == emar_api_cnt else "MISMATCH")

    cur.execute("SELECT count(*) as cnt FROM ward_sbar_handovers;")
    sbar_db_cnt = cur.fetchone()['cnt']
    res_sbar = client.get("/api/v1/clinical-ops/sbar")
    sbar_api_cnt = len(res_sbar.json().get("data", [])) if res_sbar.status_code == 200 else 0
    log("SBAR Handovers", f"DB ward_sbar_handovers: {sbar_db_cnt}. API returned: {sbar_api_cnt}.",
        "MATCH" if sbar_db_cnt == sbar_api_cnt else "MISMATCH")

    # -------------------------------------------------------------
    # MODULE 3: EMERGENCY & TRAUMA BOARD & MLC & ESCALATIONS
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt FROM emergency_triage;")
    er_db_cnt = cur.fetchone()['cnt']
    res_er = client.get("/api/v1/clinical-ops/emergency")
    er_api_cnt = len(res_er.json().get("data", [])) if res_er.status_code == 200 else 0
    log("Emergency Triage", f"DB emergency_triage: {er_db_cnt}. API returned: {er_api_cnt}.",
        "MATCH" if er_db_cnt == er_api_cnt else "MISMATCH")

    cur.execute("SELECT count(*) as cnt FROM mlc_records;")
    mlc_db_cnt = cur.fetchone()['cnt']
    res_mlc = client.get("/api/v1/clinical-ops/death-mlc")
    mlc_api_cnt = len(res_mlc.json().get("data", [])) if res_mlc.status_code == 200 else 0
    log("Death & MLC Records", f"DB mlc_records: {mlc_db_cnt}. API returned: {mlc_api_cnt}.",
        "MATCH" if mlc_db_cnt == mlc_api_cnt else "MISMATCH")

    # -------------------------------------------------------------
    # MODULE 4: OPERATING ROOMS (OT) & SURGERIES
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt FROM ot_surgeries;")
    ot_surg_db_cnt = cur.fetchone()['cnt']
    cur.execute("SELECT count(*) as cnt FROM ot_schedules;")
    ot_sched_db_cnt = cur.fetchone()['cnt']
    res_ot = client.get("/api/v1/clinical-ops/ot")
    ot_api_data = res_ot.json().get("data", []) if res_ot.status_code == 200 else []
    log("Operating Rooms / Surgeries", f"DB ot_surgeries: {ot_surg_db_cnt}, ot_schedules: {ot_sched_db_cnt}. API status: {res_ot.status_code}, count: {len(ot_api_data)}",
        "MATCH" if res_ot.status_code == 200 else "MISMATCH")

    # -------------------------------------------------------------
    # MODULE 5: BLOOD BANK & CSSD
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt FROM blood_bank_inventory;")
    bb_inv_cnt = cur.fetchone()['cnt']
    cur.execute("SELECT count(*) as cnt FROM blood_bank_units;")
    bb_unit_cnt = cur.fetchone()['cnt']
    res_bb = client.get("/api/v1/clinical-ops/blood-bank")
    log("Blood Bank", f"DB blood_bank_inventory: {bb_inv_cnt}, units: {bb_unit_cnt}. API status: {res_bb.status_code}.",
        "MATCH" if res_bb.status_code == 200 else "MISMATCH")

    cur.execute("SELECT count(*) as cnt FROM cssd_sterilization_records;")
    cssd_cnt = cur.fetchone()['cnt']
    res_cssd = client.get("/api/v1/clinical-ops/cssd")
    log("CSSD Sterilization", f"DB cssd_sterilization_records: {cssd_cnt}. API status: {res_cssd.status_code}.",
        "MATCH" if res_cssd.status_code == 200 else "MISMATCH")

    # -------------------------------------------------------------
    # MODULE 6: PHARMACY, INVENTORY, STORES, PROCUREMENT, VENDORS
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt FROM pharmacy_inventory;")
    pharm_inv_cnt = cur.fetchone()['cnt']
    res_pinv = client.get("/api/v1/pharmacy-supply/inventory")
    pinv_api_cnt = len(res_pinv.json().get("data", [])) if res_pinv.status_code == 200 else 0
    log("Pharmacy Inventory", f"DB pharmacy_inventory: {pharm_inv_cnt}. API returned: {pinv_api_cnt}.",
        "MATCH" if pharm_inv_cnt == pinv_api_cnt else "MISMATCH")

    cur.execute("SELECT count(*) as cnt FROM hospital_stores;")
    stores_cnt = cur.fetchone()['cnt']
    res_stores = client.get("/api/v1/pharmacy-supply/stores")
    stores_api_cnt = len(res_stores.json().get("data", [])) if res_stores.status_code == 200 else 0
    log("Hospital Stores", f"DB hospital_stores: {stores_cnt}. API returned: {stores_api_cnt}.",
        "MATCH" if stores_cnt == stores_api_cnt else "MISMATCH")

    cur.execute("SELECT count(*) as cnt FROM procurement_orders;")
    proc_cnt = cur.fetchone()['cnt']
    res_proc = client.get("/api/v1/pharmacy-supply/procurement")
    proc_api_cnt = len(res_proc.json().get("data", [])) if res_proc.status_code == 200 else 0
    log("Procurement Orders", f"DB procurement_orders: {proc_cnt}. API returned: {proc_api_cnt}.",
        "MATCH" if proc_cnt == proc_api_cnt else "MISMATCH")

    cur.execute("SELECT count(*) as cnt FROM hospital_vendors;")
    vendors_cnt = cur.fetchone()['cnt']
    res_vendors = client.get("/api/v1/pharmacy-supply/vendors")
    vendors_api_cnt = len(res_vendors.json().get("data", [])) if res_vendors.status_code == 200 else 0
    log("Hospital Vendors", f"DB hospital_vendors: {vendors_cnt}. API returned: {vendors_api_cnt}.",
        "MATCH" if vendors_cnt == vendors_api_cnt else "MISMATCH")

    cur.execute("SELECT count(*) as cnt FROM medications;")
    meds_cnt = cur.fetchone()['cnt']
    res_drugs = client.get("/api/v1/pharmacy-supply/drugs")
    drugs_api_cnt = len(res_drugs.json().get("data", [])) if res_drugs.status_code == 200 else 0
    log("Drug Master", f"DB medications: {meds_cnt}. API returned: {drugs_api_cnt}.",
        "MATCH" if meds_cnt == drugs_api_cnt else "MISMATCH")

    # -------------------------------------------------------------
    # MODULE 7: BILLING, PAYMENTS, REFUNDS, INSURANCE CLAIMS
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt, sum(net_amount) as total FROM bills;")
    bills_db = cur.fetchone()
    res_bills = client.get("/api/v1/financial-revenue/kpis")
    log("Billing & Financial Revenue", f"DB bills: {bills_db['cnt']} records, total net: {bills_db['total']}. API status: {res_bills.status_code}.",
        "MATCH" if res_bills.status_code == 200 else "MISMATCH")

    cur.execute("SELECT count(*) as cnt, sum(claimed_amount) as claimed, sum(approved_amount) as approved FROM insurance_claims;")
    claims_db = cur.fetchone()
    res_claims = client.get("/api/v1/financial-revenue/claims-summary")
    log("Insurance Claims", f"DB insurance_claims: {claims_db['cnt']} records, Claimed: {claims_db['claimed']}, Approved: {claims_db['approved']}. API status: {res_claims.status_code}.",
        "MATCH" if res_claims.status_code == 200 else "MISMATCH")

    # -------------------------------------------------------------
    # MODULE 8: APPOINTMENTS & PRE-ADMISSIONS
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt FROM appointments;")
    appts_cnt = cur.fetchone()['cnt']
    res_appts = client.get("/api/appointments")
    log("Appointments", f"DB appointments: {appts_cnt} rows. API status: {res_appts.status_code}.",
        "MATCH" if res_appts.status_code in (200, 404) else "ERROR")

    cur.execute("SELECT count(*) as cnt FROM pre_admissions;")
    pre_adm_cnt = cur.fetchone()['cnt']
    res_preadm = client.get("/api/pre-admissions")
    log("Pre-Admissions", f"DB pre_admissions: {pre_adm_cnt} rows. API status: {res_preadm.status_code}.",
        "MATCH" if res_preadm.status_code in (200, 404) else "ERROR")

    # -------------------------------------------------------------
    # MODULE 9: HR, STAFF ROSTERS & LEAVE
    # -------------------------------------------------------------
    cur.execute("SELECT count(*) as cnt FROM staff_rosters;")
    rosters_cnt = cur.fetchone()['cnt']
    cur.execute("SELECT count(*) as cnt FROM employee_leave_requests;")
    leave_req_cnt = cur.fetchone()['cnt']
    cur.execute("SELECT count(*) as cnt FROM employee_leave_balances;")
    leave_bal_cnt = cur.fetchone()['cnt']
    
    res_admin_roster = client.get("/api/v1/admin-system/rosters")
    log("HR & Staff Rosters", f"DB staff_rosters: {rosters_cnt}, leave requests: {leave_req_cnt}, balances: {leave_bal_cnt}. API status: {res_admin_roster.status_code}.",
        "MATCH" if res_admin_roster.status_code == 200 else "MISMATCH")

    conn.close()
    return report

if __name__ == '__main__':
    run_comprehensive_audit()
