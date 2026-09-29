#!/usr/bin/env python3
"""
Comprehensive Validation Suite for Healthcare Workflow & Discharge Orchestration Agent:
1. Validates OP Patients (With and Without Insurance)
2. Validates IP Patients (With and Without Insurance)
3. Validates Ineligible Patients across all 6 blocking gates
4. Validates Discharge Orchestration Agent execution for Eligible Patients
5. Verifies permanent storage in both discharge_summaries and dim_generated_discharge_summaries
6. Verifies retrieval via REST APIs
"""

import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

# Force UTF-8 on Windows terminal
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import db_config

API_BASE = "http://localhost:8000"

def http_get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

def http_post(url, data):
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body_err)
        except Exception:
            return e.code, {"error": body_err}

def run_tests():
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    passed_tests = []
    failed_tests = []

    # Dynamic lookup of latest test patient IDs by name
    def get_latest_pid(fname, lname):
        cur.execute("SELECT id FROM patients WHERE first_name = %s AND last_name = %s ORDER BY id DESC LIMIT 1;", (fname, lname))
        row = cur.fetchone()
        return row[0] if row else None

    pid_ip_ins = get_latest_pid("Rajesh", "Venkataraman")
    pid_ip_self = get_latest_pid("Ananya", "Sundaram")
    pid_inel_bill = get_latest_pid("Suresh", "Ramanathan")
    pid_inel_diag = get_latest_pid("Malini", "Chandran")
    pid_inel_clin = get_latest_pid("Vikramaditya", "Verma")
    pid_inel_vitals_miss = get_latest_pid("Geetha", "Rangarajan")
    pid_inel_vitals_unst = get_latest_pid("Balaji", "Krishnaswamy")
    pid_inel_pending = get_latest_pid("Shalini", "Venugopal")
    pid_op_ins = get_latest_pid("Meenakshi", "Natarajan")
    pid_op_self = get_latest_pid("Karthikeyan", "Subramaniam")

    print(f"Target Patient IDs resolved: IP_INS={pid_ip_ins}, IP_SELF={pid_ip_self}, OP_INS={pid_op_ins}, OP_SELF={pid_op_self}")

    print("\n" + "=" * 80)
    print("STEP 1: VALIDATE OUTPATIENT (OP) FLOWS")
    print("=" * 80)

    # Check OP Insured
    cur.execute("SELECT id, first_name, last_name FROM patients WHERE id = %s;", (pid_op_ins,))
    p_op_ins = cur.fetchone()
    cur.execute("SELECT visit_id, visit_type, visit_status FROM patient_visits WHERE patient_id = %s;", (pid_op_ins,))
    v_op_ins = cur.fetchone()
    cur.execute("SELECT COUNT(*) FROM admissions WHERE patient_id = %s;", (pid_op_ins,))
    adm_op_ins_cnt = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM dim_admission_inputs WHERE patient_id = %s;", (pid_op_ins,))
    dim_op_ins_cnt = cur.fetchone()[0]
    cur.execute("SELECT insurance_provider, policy_number FROM patient_insurance WHERE patient_id = %s;", (pid_op_ins,))
    ins_op_ins = cur.fetchone()
    cur.execute("SELECT bill_id, net_amount, insurance_amount, patient_amount, bill_status FROM bills WHERE patient_id = %s;", (pid_op_ins,))
    bill_op_ins = cur.fetchone()
    cur.execute("SELECT claim_number, claimed_amount, approved_amount, claim_status FROM insurance_claims WHERE patient_id = %s;", (pid_op_ins,))
    claim_op_ins = cur.fetchone()

    if (p_op_ins and v_op_ins and v_op_ins[1] == 'OPD' and adm_op_ins_cnt == 0 and dim_op_ins_cnt == 0
        and ins_op_ins and bill_op_ins and claim_op_ins and claim_op_ins[3] == 'Approved'):
        passed_tests.append("OP Insured Patient: Full OPD flow with Insurance claim verified, not treated as inpatient.")
        print("  [PASS] OP Insured: Visit OPD, Insurance linked, Bill split, Claim approved, Not admitted.")
    else:
        failed_tests.append(f"OP Insured Patient flow incomplete: adm_cnt={adm_op_ins_cnt}, bill={bill_op_ins}")
        print("  [FAIL] OP Insured Patient flow failed.")

    # Check OP Uninsured
    cur.execute("SELECT id, first_name, last_name FROM patients WHERE id = %s;", (pid_op_self,))
    p_op_self = cur.fetchone()
    cur.execute("SELECT visit_id, visit_type, visit_status FROM patient_visits WHERE patient_id = %s;", (pid_op_self,))
    v_op_self = cur.fetchone()
    cur.execute("SELECT COUNT(*) FROM admissions WHERE patient_id = %s;", (pid_op_self,))
    adm_op_self_cnt = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM patient_insurance WHERE patient_id = %s;", (pid_op_self,))
    ins_op_self_cnt = cur.fetchone()[0]
    cur.execute("SELECT bill_id, net_amount, insurance_amount, patient_amount, bill_status FROM bills WHERE patient_id = %s;", (pid_op_self,))
    bill_op_self = cur.fetchone()
    cur.execute("SELECT COUNT(*) FROM insurance_claims WHERE patient_id = %s;", (pid_op_self,))
    claim_op_self_cnt = cur.fetchone()[0]

    if (p_op_self and v_op_self and v_op_self[1] == 'OPD' and adm_op_self_cnt == 0 and ins_op_self_cnt == 0
        and bill_op_self and bill_op_self[2] == 0 and bill_op_self[3] == bill_op_self[1] and claim_op_self_cnt == 0):
        passed_tests.append("OP Uninsured Patient: Full OPD flow without Insurance verified, 100% self-pay, not admitted.")
        print("  [PASS] OP Uninsured: Visit OPD, No insurance record, 100% patient pay, Not admitted.")
    else:
        failed_tests.append(f"OP Uninsured Patient flow incomplete: ins_cnt={ins_op_self_cnt}, bill={bill_op_self}")
        print("  [FAIL] OP Uninsured Patient flow failed.")

    print("\n" + "=" * 80)
    print("STEP 2: VALIDATE INPATIENT (IP) INSURANCE SCENARIOS")
    print("=" * 80)

    # IP Insured
    cur.execute("SELECT COUNT(*) FROM patient_insurance WHERE patient_id = %s AND status = 'Active';", (pid_ip_ins,))
    ip_ins_cnt = cur.fetchone()[0]
    cur.execute("SELECT claim_number, claimed_amount, approved_amount, claim_status FROM insurance_claims WHERE patient_id = %s;", (pid_ip_ins,))
    ip_claim = cur.fetchone()
    cur.execute("SELECT bill_status, bill_net_amount, outstanding_balance FROM dim_admission_inputs WHERE patient_id = %s;", (pid_ip_ins,))
    ip_dim_row = cur.fetchone()

    if ip_ins_cnt == 1 and ip_claim and ip_claim[3] == 'Approved' and ip_dim_row and ip_dim_row[2] == 0:
        passed_tests.append("IP Insured: Patient -> Admission -> Insurance -> Bills -> Claims -> Discharge ready.")
        print(f"  [PASS] IP Insured: Claim {ip_claim[0]} approved for Rs.{ip_claim[2]:,.2f}, Bill settled.")
    else:
        failed_tests.append("IP Insured flow validation failed.")
        print("  [FAIL] IP Insured flow failed.")

    # IP Uninsured
    cur.execute("SELECT COUNT(*) FROM patient_insurance WHERE patient_id = %s;", (pid_ip_self,))
    ip_unins_cnt = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM insurance_claims WHERE patient_id = %s;", (pid_ip_self,))
    ip_unins_claim_cnt = cur.fetchone()[0]
    cur.execute("SELECT bill_status, bill_clearance_status, outstanding_balance FROM dim_admission_inputs WHERE patient_id = %s;", (pid_ip_self,))
    ip_unins_dim = cur.fetchone()

    if ip_unins_cnt == 0 and ip_unins_claim_cnt == 0 and ip_unins_dim and ip_unins_dim[0] == 'Settled' and ip_unins_dim[2] == 0:
        passed_tests.append("IP Uninsured: Full Inpatient flow without insurance completed, no false insurance requirement.")
        print(f"  [PASS] IP Uninsured: No insurance records, bill settled directly via self-pay, Ready for discharge.")
    else:
        failed_tests.append("IP Uninsured flow validation failed.")
        print("  [FAIL] IP Uninsured flow failed.")

    print("\n" + "=" * 80)
    print("STEP 3: VALIDATE DISCHARGE ORCHESTRATION AGENT - INELIGIBLE PATIENTS")
    print("=" * 80)

    ineligible_test_cases = [
        (str(pid_inel_bill), "IP_INEL_BILL", "Bill clearance pending"),
        (str(pid_inel_diag), "IP_INEL_DIAG", "Diagnosis information missing"),
        (str(pid_inel_clin), "IP_INEL_CLIN", "Clinical information incomplete"),
        (str(pid_inel_vitals_miss), "IP_INEL_VITALS_MISS", "Vital signs not stable"),
        (str(pid_inel_vitals_unst), "IP_INEL_VITALS_UNST", "Vital signs not stable"),
        (str(pid_inel_pending), "IP_INEL_PENDING", "Clinical information incomplete")
    ]

    for pid, key, expected_fail_kw in ineligible_test_cases:
        status, val_res = http_post(f"{API_BASE}/api/v1/discharge-agent/validate", {"patient_id": pid})
        is_eligible = val_res.get("is_eligible")
        pending_reqs = val_res.get("pending_requirements", [])
        pending_str = " | ".join(pending_reqs)

        if not is_eligible and any(expected_fail_kw.lower() in p.lower() for p in pending_reqs):
            passed_tests.append(f"Ineligible Patient [{key}] #{pid}: Correctly identified NOT ELIGIBLE ({expected_fail_kw}).")
            print(f"  [PASS] [{key}] Patient #{pid}: Blocked correctly. Reasons: {pending_reqs}")
        else:
            failed_tests.append(f"Ineligible Patient [{key}] #{pid}: Unexpectedly marked eligible or wrong reason! Result: {val_res}")
            print(f"  [FAIL] [{key}] Patient #{pid}: is_eligible={is_eligible}, reqs={pending_reqs}")

        # Also verify that /orchestrate BLOCKS generation for ineligible patients
        orch_status, orch_res = http_post(f"{API_BASE}/api/v1/discharge-agent/orchestrate", {"patient_id": pid})
        if orch_res.get("status") == "blocked" or not orch_res.get("success"):
            passed_tests.append(f"Ineligible Patient [{key}] #{pid}: Orchestration blocked summary generation.")
            print(f"  [PASS] [{key}] Orchestration correctly blocked summary generation.")
        else:
            failed_tests.append(f"Ineligible Patient [{key}] #{pid}: Orchestration failed to block summary generation!")
            print(f"  [FAIL] [{key}] Orchestration allowed generation: {orch_res}")

    print("\n" + "=" * 80)
    print("STEP 4: VALIDATE DISCHARGE ORCHESTRATION AGENT - ELIGIBLE PATIENTS")
    print("=" * 80)

    eligible_pids = [str(pid_ip_ins), str(pid_ip_self)]
    for pid in eligible_pids:
        status, val_res = http_post(f"{API_BASE}/api/v1/discharge-agent/validate", {"patient_id": pid})
        is_eligible = val_res.get("is_eligible")
        gates = val_res.get("gates", {})
        all_gates_passed = all(g.get("passed") for g in gates.values())

        if is_eligible and all_gates_passed:
            passed_tests.append(f"Eligible Patient #{pid}: Passed all 4 mandatory discharge gates.")
            print(f"  [PASS] Patient #{pid}: Validated 100% ELIGIBLE! All 4 gates PASSED.")
        else:
            failed_tests.append(f"Eligible Patient #{pid}: Failed validation: {val_res}")
            print(f"  [FAIL] Patient #{pid}: Failed validation! {val_res}")

    print("\n" + "=" * 80)
    print("STEP 5: EXECUTE AUTOMATED ORCHESTRATION & NOTEBOOK WORKFLOW")
    print("=" * 80)

    # Execute automated flow via /run-flow or /orchestrate
    comma_pids = ",".join(eligible_pids)
    print(f"Triggering Orchestration workflow for eligible patients: {comma_pids}...")
    orch_status, orch_res = http_post(f"{API_BASE}/api/v1/discharge-agent/orchestrate", {
        "patient_id": comma_pids,
        "model_name": "local-clinical-engine"
    })

    if orch_res.get("success") and orch_res.get("total_processed") == 2:
        passed_tests.append(f"Discharge Orchestration Agent: Successfully processed {comma_pids} in automated workflow.")
        print(f"  [PASS] Orchestration success! Total processed: {orch_res.get('total_processed')}")
    else:
        failed_tests.append(f"Discharge Orchestration Agent failed: {orch_res}")
        print(f"  [FAIL] Orchestration error: {orch_res}")

    print("\n" + "=" * 80)
    print("STEP 6: VERIFY PERMANENT STORAGE & RETRIEVAL OF DISCHARGE SUMMARIES")
    print("=" * 80)

    for pid in eligible_pids:
        # Check dim_generated_discharge_summaries
        cur.execute("SELECT summary_id, patient_id, admission_id, diagnoses, investigations, treatment, primary_consultant, discharge_advice FROM dim_generated_discharge_summaries WHERE patient_id = %s;", (int(pid),))
        gold_summary = cur.fetchone()

        # Check discharge_summaries table
        cur.execute("SELECT summary_id, patient_id, admission_id, diagnoses, investigations, treatment, primary_consultant, discharge_advice FROM discharge_summaries WHERE patient_id = %s;", (int(pid),))
        base_summary = cur.fetchone()

        if gold_summary and base_summary:
            passed_tests.append(f"Discharge Summary for Patient #{pid}: Permanently stored in BOTH `dim_generated_discharge_summaries` AND `discharge_summaries`.")
            print(f"  [PASS] Patient #{pid} Summary stored in both tables:")
            print(f"         Summary ID: {gold_summary[0]}")
            print(f"         Diagnosis: {gold_summary[3]}")
            print(f"         Consultant: {gold_summary[6]}")
            print(f"         Treatment: {gold_summary[5][:60]}...")
        else:
            failed_tests.append(f"Discharge Summary for Patient #{pid} missing from tables: gold={bool(gold_summary)}, base={bool(base_summary)}")
            print(f"  [FAIL] Patient #{pid} summary persistence check failed.")

        # Test API retrieval via GET /api/v1/gold/generated-discharge-summaries
        api_status, api_data = http_get(f"{API_BASE}/api/v1/gold/generated-discharge-summaries?patient_id={pid}")
        records = api_data.get("data", [])
        if api_status == 200 and len(records) > 0 and str(records[0].get("patient_id")) == str(pid):
            passed_tests.append(f"API Retrieval: Summary for Patient #{pid} successfully retrieved via REST API.")
            print(f"  [PASS] API Retrieval for Patient #{pid}: Status {api_status}, returned {len(records)} record(s).")
        else:
            failed_tests.append(f"API Retrieval for Patient #{pid} failed: status={api_status}, data={api_data}")
            print(f"  [FAIL] API Retrieval for Patient #{pid} failed.")

    print("\n" + "=" * 80)
    print("STEP 7: TEST 3-STEP FLOW STATUS (/flow-status)")
    print("=" * 80)
    fs_status, fs_data = http_get(f"{API_BASE}/api/v1/discharge-agent/flow-status")
    if fs_status == 200 and fs_data.get("status") == "success":
        step_1 = fs_data.get("step_1_bills_summary", {})
        step_2 = fs_data.get("step_2_vitals_summary", {})
        passed_tests.append("3-Step Discharge Funnel: /flow-status evaluated all admitted patients correctly.")
        print(f"  [PASS] Flow status: Bills Paid Count={step_1.get('paid_or_completed_count')}, Normal Vitals={step_2.get('normal_vitals_count')}, Unstable Vitals={step_2.get('unstable_vitals_count')}")
    else:
        failed_tests.append(f"Flow status endpoint failed: {fs_data}")
        print("  [FAIL] Flow status endpoint failed.")

    print("\n" + "=" * 80)
    print("TEST EXECUTION SUMMARY")
    print("=" * 80)
    print(f"TOTAL PASSED: {len(passed_tests)}")
    print(f"TOTAL FAILED: {len(failed_tests)}")
    for p in passed_tests:
        print(f" [PASS] {p}")
    for f in failed_tests:
        print(f" [FAIL] {f}")

    conn.close()
    return len(failed_tests) == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
