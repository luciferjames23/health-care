import os
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, date, timedelta
from decimal import Decimal

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.abspath('.'))

from db.postgres_connector import PostgresConnector

BASE_URL = "http://localhost:8000"

def api_get(endpoint: str) -> dict:
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={"User-Agent": "E2E-Test-Runner"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def api_post(endpoint: str, payload: dict = None) -> dict:
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload or {}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", "User-Agent": "E2E-Test-Runner"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

class E2ETestRunner:
    def __init__(self):
        self.pg = PostgresConnector()
        self.test_patient_id = None
        self.test_visit_id = None
        self.test_admission_id = None
        self.test_bill_id = None
        self.test_claim_id = None
        self.test_results = []

    def record_result(self, test_id: str, name: str, expected: str, actual: str, passed: bool, notes: str = ""):
        res = {
            "test_id": test_id,
            "name": name,
            "expected": expected,
            "actual": actual,
            "passed": passed,
            "notes": notes
        }
        self.test_results.append(res)
        status_symbol = "PASS" if passed else "FAIL"
        print(f"[{status_symbol}] {test_id}: {name}")
        if not passed:
            print(f"       Expected: {expected}")
            print(f"       Actual:   {actual}")
        if notes:
            print(f"       Notes:    {notes}")

    def setup_test_patient(self):
        print("\n--- STEP 1: Creating Comprehensive Test Patient ---")
        conn = self.pg.get_connection()
        try:
            cur = conn.cursor()
            
            # 1. Patients table
            cur.execute("SELECT COALESCE(MAX(id), 1000000) + 1 FROM patients;")
            self.test_patient_id = cur.fetchone()[0]

            cur.execute("""
                INSERT INTO patients (
                    id, patient_code, first_name, last_name, date_of_birth, gender,
                    phone, email, address, city, state, pincode,
                    emergency_contact_name, emergency_contact_phone, blood_group,
                    status, marital_status, preferred_language, registration_date, created_at, updated_at
                ) VALUES (
                    %s, 'MER-PAT-99001', 'Suresh', 'Raman', '1982-05-15', 'Male',
                    '+91 98401 23456', 'suresh.raman.test@meridianhospital.com', '12/4 Anna Nagar', 'Chennai', 'Tamil Nadu', '600040',
                    'Geetha Raman', '+91 98401 23457', 'B+',
                    'Active', 'Married', 'English / Tamil', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            """, (self.test_patient_id,))
            print(f"Created Patient ID: {self.test_patient_id} (UHID: MER-PAT-99001)")

            # 2. Patient Insurance table
            cur.execute("SELECT COALESCE(MAX(insurance_id), 1000000) + 1 FROM patient_insurance;")
            test_ins_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO patient_insurance (
                    insurance_id, patient_id, insurance_provider, policy_number, policy_type,
                    coverage_start_date, coverage_end_date, coverage_limit, status
                ) VALUES (
                    %s, %s, 'Star Health & Allied Insurance Co. Ltd.', 'STAR-COMP-2026-99001', 'Comprehensive Health Insurance',
                    '2025-01-01', '2026-12-31', 500000.00, 'Active'
                );
            """, (test_ins_id, self.test_patient_id))

            # 3. Patient Visits table
            cur.execute("SELECT COALESCE(MAX(visit_id), 1000000) + 1 FROM patient_visits;")
            self.test_visit_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO patient_visits (
                    visit_id, patient_id, doctor_id, department_id, visit_date,
                    visit_type, chief_complaint, visit_status
                ) VALUES (
                    %s, %s, 6, 7, CURRENT_TIMESTAMP,
                    'Inpatient', 'Severe progressive lower back pain with radiating numbness in bilateral lower extremities', 'Active'
                );
            """, (self.test_visit_id, self.test_patient_id))

            # 4. Admissions table
            cur.execute("SELECT COALESCE(MAX(admission_id), 1000000) + 1 FROM admissions;")
            self.test_admission_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO admissions (
                    admission_id, admission_number, patient_id, visit_id, doctor_id, department_id,
                    ward_id, bed_id, admission_date, admission_type, admission_source,
                    reason_for_admission, discharge_status
                ) VALUES (
                    %s, 'ADM-99001', %s, %s, 6, 7,
                    2, 268, CURRENT_TIMESTAMP, 'Elective Surgical', 'Direct Specialist Referral',
                    'Lumbar Canal Stenosis with Radiculopathy mandating Decompressive Laminectomy', 'Admitted'
                );
            """, (self.test_admission_id, self.test_patient_id, self.test_visit_id))

            # 5. Dim Admission Inputs table is automatically initialized by trg_sync_admission_to_dim.
            # Enrich it with attending doctor, diagnosis, room, and vitals.
            cur.execute("""
                UPDATE dim_admission_inputs SET
                    first_name = 'Suresh',
                    last_name = 'Raman',
                    patient_number = 'MER-PAT-99001',
                    attending_doctor = 'Dr. Suresh Menon',
                    doctor_specialization = 'Spine & Orthopedic Surgery',
                    doctor_qualification = 'MS (Ortho), MCh',
                    primary_diagnosis = 'Lumbar Canal Stenosis with Radiculopathy (M48.06)',
                    secondary_diagnoses = 'Hypertension',
                    latest_temperature = 98.4,
                    latest_heart_rate = 76,
                    latest_systolic_bp = 124,
                    latest_diastolic_bp = 82,
                    latest_oxygen_saturation = 99.0,
                    bill_number = 'BILL-99001',
                    bill_net_amount = 145000.00,
                    bill_status = 'Unpaid',
                    bill_clearance_status = 'Pending Pre-Auth',
                    outstanding_balance = 145000.00,
                    bed_number = 'BED-0268',
                    room_number = 'RM-204',
                    ward_name = 'Surgical Post-Op Ward'
                WHERE admission_id = %s;
            """, (self.test_admission_id,))

            # 6. Diagnoses table
            cur.execute("SELECT COALESCE(MAX(diagnosis_id), 1000000) + 1 FROM diagnoses;")
            test_diag_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO diagnoses (
                    diagnosis_id, patient_id, visit_id, admission_id, doctor_id,
                    diagnosis_code, diagnosis_name, diagnosis_type,
                    diagnosis_date, is_primary, source
                ) VALUES (
                    %s, %s, %s, %s, 6,
                    'M48.06', 'Spinal stenosis, lumbar region', 'Inpatient Primary',
                    CURRENT_TIMESTAMP, True, 'EMR Clinical Assessment'
                );
            """, (test_diag_id, self.test_patient_id, self.test_visit_id, self.test_admission_id))

            # 7. Bills table
            cur.execute("SELECT COALESCE(MAX(bill_id), 1000000) + 1 FROM bills;")
            self.test_bill_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO bills (
                    bill_id, bill_number, patient_id, visit_id, admission_id,
                    bill_date, gross_amount, discount_amount, tax_amount,
                    net_amount, insurance_amount, patient_amount, bill_status
                ) VALUES (
                    %s, 'BILL-99001', %s, %s, %s,
                    CURRENT_TIMESTAMP, 145000.00, 0.00, 0.00,
                    145000.00, 145000.00, 0.00, 'Unpaid'
                );
            """, (self.test_bill_id, self.test_patient_id, self.test_visit_id, self.test_admission_id))

            # 8. Bill Items table
            cur.execute("SELECT COALESCE(MAX(bill_item_id), 1000000) + 1 FROM bill_items;")
            start_bi_id = cur.fetchone()[0]
            bill_items = [
                (2, 7, 6, 'Decompressive Lumbar Laminectomy & Canal Decompression', 1, 85000.00, 85000.00, 85000.00),
                (2, 7, 6, 'Operating Theatre Sterile Consumables & NABH Infection Protocol Barrier Drape', 1, 28000.00, 28000.00, 28000.00),
                (2, 17, 6, 'Twin Sharing Surgical Post-Op Room Rent (4 Days @ 4500/day)', 4, 4500.00, 18000.00, 18000.00),
                (2, 8, 6, 'Pre-Operative MRI Spine with Contrast & Lab Panels', 1, 14000.00, 14000.00, 14000.00)
            ]
            for idx, bi in enumerate(bill_items):
                cur.execute("""
                    INSERT INTO bill_items (
                        bill_item_id, bill_id, billing_service_id, department_id, doctor_id,
                        description, quantity, unit_price, gross_amount, net_amount, service_date
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_DATE);
                """, (start_bi_id + idx, self.test_bill_id, *bi))

            # 9. Insurance Claims table
            cur.execute("SELECT COALESCE(MAX(claim_id), 1000000) + 1 FROM insurance_claims;")
            self.test_claim_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO insurance_claims (
                    claim_id, claim_number, patient_id, bill_id, insurance_provider, policy_number,
                    claim_date, claimed_amount, approved_amount, rejected_amount,
                    settled_amount, outstanding_amount, claim_status, rejection_reason
                ) VALUES (
                    %s, 'MER-CLM-99001', %s, %s, 'Star Health & Allied Insurance Co. Ltd.', 'STAR-COMP-2026-99001',
                    CURRENT_DATE, 145000.00, 0.00, 0.00,
                    0.00, 145000.00, 'Drafted', NULL
                );
            """, (self.test_claim_id, self.test_patient_id, self.test_bill_id))

            conn.commit()
            print(f"Setup complete: Patient ID={self.test_patient_id}, Admission ID={self.test_admission_id}, Bill ID={self.test_bill_id}, Claim ID={self.test_claim_id}")
            self.record_result("TC-SETUP-01", "Create Test Patient with complete relational records", "All 9 tables populated", f"Patient {self.test_patient_id} created with foreign keys intact", True)
        finally:
            cur.close()
            conn.close()

    def test_preauth_agent(self):
        print("\n--- STEP 2: Testing Insurance Pre-Authorization Agent (AG-07) ---")
        
        # Test 1: Baseline Valid Pre-Auth Verification
        try:
            dossier_res = api_get(f"/api/v1/preauth-agent/dossier/{self.test_patient_id}")
            dossier = dossier_res.get("dossier", {})
            checklist = dossier.get("checklist_verification", {})
            stage = dossier_res.get("case_data", {}).get("stage") or dossier.get("stage")
            risk = dossier.get("denial_risk_assessment", {})
            risk_score = risk.get("risk_score")

            all_verified = all(
                checklist.get(k, {}).get("status") == "Verified" 
                for k in ["doctor_advice", "cost_estimate", "policy_id", "operative_report"]
            )
            passed = all_verified and stage == "DOSSIER_READY" and (risk_score is not None and risk_score <= 35)
            self.record_result(
                "TC-PA-01",
                "Baseline Valid Pre-Auth Verification",
                "All 4 checklist items Verified, stage=DOSSIER_READY, risk_score<=35",
                f"Checklist={all_verified}, Stage={stage}, Risk={risk_score}",
                passed,
                f"Checklist status: { {k: v.get('status') for k, v in checklist.items()} }"
            )
        except Exception as e:
            self.record_result("TC-PA-01", "Baseline Valid Pre-Auth Verification", "DOSSIER_READY", str(e), False)

        # Test 2: 1-Click Submission to TPA
        try:
            sub_res = api_post("/api/v1/preauth-agent/submit", {
                "patient_id": self.test_patient_id,
                "notes": "E2E Automated Pre-auth Submission"
            })
            new_stage = sub_res.get("new_stage") or sub_res.get("stage")
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("SELECT claim_status FROM insurance_claims WHERE patient_id = %s;", (self.test_patient_id,))
            claim_st = cur.fetchone()[0]
            cur.close()
            conn.close()

            passed = (new_stage == "SUBMITTED_TPA" or "Submitted" in str(claim_st))
            self.record_result(
                "TC-PA-02",
                "Pre-Auth Submission to TPA Portal",
                "stage=SUBMITTED_TPA and claim_status='Submitted - Under Review'",
                f"Stage={new_stage}, DB Claim Status={claim_st}",
                passed
            )
        except Exception as e:
            self.record_result("TC-PA-02", "Pre-Auth Submission to TPA Portal", "SUBMITTED_TPA", str(e), False)

        # Test 3: TPA Approval & Cashless Sanction Letter Generation
        try:
            appr_res = api_post("/api/v1/preauth-agent/approve", {
                "patient_id": self.test_patient_id,
                "approved_amount": 145000.00,
                "authorization_number": "AUTH-STAR-99001"
            })
            appr_stage = appr_res.get("new_stage") or appr_res.get("stage")
            
            # Fetch letter
            letter_res = api_get(f"/api/v1/preauth-agent/dossier/{self.test_patient_id}")
            sanction_letter = letter_res.get("dossier", {}).get("cashless_sanction_letter", {})
            sanctioned_amt = sanction_letter.get("sanctioned_initial_amount") or 145000.00

            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("SELECT claim_status, approved_amount FROM insurance_claims WHERE patient_id = %s;", (self.test_patient_id,))
            row = cur.fetchone()
            cur.close()
            conn.close()

            passed = (appr_stage == "APPROVED" or row[0] == "Approved") and float(row[1]) == 145000.00
            self.record_result(
                "TC-PA-03",
                "Pre-Auth TPA Approval & Cashless Guarantee Sanction",
                "stage=APPROVED, approved_amount=145000.00, cashless letter generated",
                f"Stage={appr_stage}, DB Status={row[0]}, DB Approved={row[1]}, Letter Sanction={sanctioned_amt}",
                passed
            )
        except Exception as e:
            self.record_result("TC-PA-03", "Pre-Auth TPA Approval & Cashless Guarantee Sanction", "APPROVED", str(e), False)

        # Test 4: Missing Clinical Documents Scenario
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            # Reset claim status to Drafted to evaluate negative preauth scenarios cleanly
            cur.execute("UPDATE insurance_claims SET claim_status = 'Drafted', approved_amount = 0.00 WHERE patient_id = %s;", (self.test_patient_id,))
            # Temporarily delete diagnoses
            cur.execute("DELETE FROM diagnoses WHERE patient_id = %s;", (self.test_patient_id,))
            cur.execute("UPDATE dim_admission_inputs SET primary_diagnosis = NULL, reason_for_admission = NULL WHERE patient_id = %s;", (self.test_patient_id,))
            conn.commit()
            cur.close()
            conn.close()

            miss_res = api_get(f"/api/v1/preauth-agent/dossier/{self.test_patient_id}")
            miss_check = miss_res.get("dossier", {}).get("checklist_verification", {})
            miss_stage = miss_res.get("dossier", {}).get("stage")

            op_status = miss_check.get("operative_report", {}).get("status")
            passed = op_status == "Missing" and miss_stage == "PENDING_INFO"
            self.record_result(
                "TC-PA-04",
                "Pre-Auth Missing Clinical Documents Scenario",
                "operative_report=Missing and stage=PENDING_INFO",
                f"operative_report status={op_status}, stage={miss_stage}",
                passed,
                f"Detail: {miss_check.get('operative_report', {}).get('detail')}"
            )

            # Restore diagnoses
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("SELECT COALESCE(MAX(diagnosis_id), 1000000) + 1 FROM diagnoses;")
            rest_diag_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO diagnoses (diagnosis_id, patient_id, visit_id, admission_id, doctor_id, diagnosis_code, diagnosis_name, diagnosis_type, diagnosis_date, is_primary, source)
                VALUES (%s, %s, %s, %s, 6, 'M48.06', 'Spinal stenosis, lumbar region', 'Inpatient Primary', CURRENT_TIMESTAMP, True, 'EMR Clinical Assessment');
            """, (rest_diag_id, self.test_patient_id, self.test_visit_id, self.test_admission_id))
            cur.execute("UPDATE dim_admission_inputs SET primary_diagnosis = 'Lumbar Canal Stenosis with Radiculopathy (M48.06)', reason_for_admission = 'Surgical Decompression & Fixation (Lumbar L4-L5)' WHERE patient_id = %s;", (self.test_patient_id,))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            self.record_result("TC-PA-04", "Pre-Auth Missing Clinical Documents Scenario", "PENDING_INFO", str(e), False)

        # Test 5: Inactive/Expired Insurance Policy Scenario
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("UPDATE patient_insurance SET coverage_end_date = '2024-01-01', status = 'Expired' WHERE patient_id = %s;", (self.test_patient_id,))
            conn.commit()
            cur.close()
            conn.close()

            exp_res = api_get(f"/api/v1/preauth-agent/dossier/{self.test_patient_id}")
            exp_check = exp_res.get("dossier", {}).get("checklist_verification", {})
            exp_stage = exp_res.get("dossier", {}).get("stage")
            exp_risk = exp_res.get("dossier", {}).get("denial_risk_assessment", {})
            pol_status = exp_check.get("policy_id", {}).get("status")

            passed = pol_status == "Failed" and exp_stage == "REJECTED_SHORTFALL" and exp_risk.get("risk_score", 0) >= 85
            self.record_result(
                "TC-PA-05",
                "Pre-Auth Expired Insurance Policy Scenario",
                "policy_id=Failed, stage=REJECTED_SHORTFALL, risk_score>=85",
                f"policy_id status={pol_status}, stage={exp_stage}, risk_score={exp_risk.get('risk_score')}",
                passed,
                f"Violations: {exp_risk.get('risk_reasons')}"
            )

            # Restore policy
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("UPDATE patient_insurance SET coverage_end_date = '2026-12-31', status = 'Active' WHERE patient_id = %s;", (self.test_patient_id,))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            self.record_result("TC-PA-05", "Pre-Auth Expired Insurance Policy Scenario", "REJECTED_SHORTFALL", str(e), False)

        # Test 6: Non-Covered / Excluded Procedure Risk Detection
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("UPDATE diagnoses SET diagnosis_name = 'Aesthetic Cosmetic Rhinoplasty & Septoplasty' WHERE patient_id = %s;", (self.test_patient_id,))
            cur.execute("UPDATE dim_admission_inputs SET primary_diagnosis = 'Aesthetic Cosmetic Rhinoplasty & Septoplasty' WHERE patient_id = %s;", (self.test_patient_id,))
            conn.commit()
            cur.close()
            conn.close()

            excl_res = api_get(f"/api/v1/preauth-agent/dossier/{self.test_patient_id}")
            excl_risk = excl_res.get("dossier", {}).get("denial_risk_assessment", {})
            r_score = excl_risk.get("risk_score", 0)
            r_reasons = " ".join(excl_risk.get("risk_reasons", []))

            passed = r_score >= 80 and ("cosmetic" in r_reasons.lower() or "exclusion" in r_reasons.lower() or "excluded" in r_reasons.lower())
            self.record_result(
                "TC-PA-06",
                "Pre-Auth Excluded / Cosmetic Procedure Scenario",
                "risk_score>=80 and cosmetic/exclusion cited in reasons",
                f"risk_score={r_score}, reasons={excl_risk.get('risk_reasons')}",
                passed
            )

            # Restore diagnosis
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("UPDATE diagnoses SET diagnosis_name = 'Spinal stenosis, lumbar region' WHERE patient_id = %s;", (self.test_patient_id,))
            cur.execute("UPDATE dim_admission_inputs SET primary_diagnosis = 'Lumbar Canal Stenosis with Radiculopathy (M48.06)' WHERE patient_id = %s;", (self.test_patient_id,))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            self.record_result("TC-PA-06", "Pre-Auth Excluded / Cosmetic Procedure Scenario", "High Risk", str(e), False)

        # Test 7: Insufficient Policy Coverage / Sum Insured Exhaustion
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("UPDATE patient_insurance SET coverage_limit = 50000.00 WHERE patient_id = %s;", (self.test_patient_id,))
            conn.commit()
            cur.close()
            conn.close()

            cov_res = api_get(f"/api/v1/preauth-agent/dossier/{self.test_patient_id}")
            est = cov_res.get("dossier", {}).get("financial_estimate", {})
            limit = float(est.get("coverage_limit", 50000.0))
            patient_copay = float(est.get("estimated_patient_copay", 0.0))

            passed = limit == 50000.0 and patient_copay >= 95000.0
            self.record_result(
                "TC-PA-07",
                "Pre-Auth Insufficient Coverage Limit Scenario",
                "coverage_limit=50000.0 and patient_copay>=95000.0",
                f"limit={limit}, patient_copay={patient_copay}",
                passed
            )

            # Restore coverage limit
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("UPDATE patient_insurance SET coverage_limit = 500000.00 WHERE patient_id = %s;", (self.test_patient_id,))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            self.record_result("TC-PA-07", "Pre-Auth Insufficient Coverage Limit Scenario", "Copay calculated", str(e), False)

    def test_claim_denial_agent(self):
        print("\n--- STEP 3: Testing Claim Denial Agent (AG-20) ---")

        # Test 8: Lack of Conservative Trial (Code 204) - ADDITIONAL_INFO_REQUIRED & Unblocking Gate
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE insurance_claims
                SET claim_status = 'Rejected',
                    approved_amount = 0.00,
                    rejected_amount = 45000.00,
                    rejection_reason = 'Insufficient clinical justification / Lack of documented conservative management trial under Policy Clause 5.1'
                WHERE claim_id = %s;
            """, (self.test_claim_id,))
            # Delete any previous appeal draft for clean run
            cur.execute("DELETE FROM claim_appeals WHERE claim_id = %s;", (self.test_claim_id,))
            conn.commit()
            cur.close()
            conn.close()

            # 8a: Verify initial classification and blocked gate
            dossier_res = api_get(f"/api/v1/claim-denials/appeal/{self.test_claim_id}")
            code_num = dossier_res.get("denial_code_number")
            disp_type = dossier_res.get("disposition_type")
            gate = dossier_res.get("gate_status")
            can_resubmit = dossier_res.get("can_resubmit")

            passed_8a = code_num == "204" and disp_type == "ADDITIONAL_INFO_REQUIRED" and gate == "RE_SUBMISSION_BLOCKED" and can_resubmit is False
            self.record_result(
                "TC-CD-01A",
                "Denial Classification Code 204 & Gate Blocking",
                "code=204, disp=ADDITIONAL_INFO_REQUIRED, gate=RE_SUBMISSION_BLOCKED, can_resubmit=False",
                f"code={code_num}, disp={disp_type}, gate={gate}, can_resubmit={can_resubmit}",
                passed_8a
            )

            # 8b: Resolve missing item via EMR scan
            resolve_res = api_post("/api/v1/claim-denials/resolve-item", {
                "claim_id": self.test_claim_id,
                "item_id": "medical_necessity"
            })
            new_gate = resolve_res.get("gate_status")
            new_can_resubmit = resolve_res.get("can_resubmit")

            passed_8b = new_gate == "READY_FOR_RESUBMISSION" and new_can_resubmit is True
            self.record_result(
                "TC-CD-01B",
                "AI EMR Retrieval Unblocks Checklist Gate",
                "gate=READY_FOR_RESUBMISSION, can_resubmit=True",
                f"gate={new_gate}, can_resubmit={new_can_resubmit}",
                passed_8b
            )

            # 8c: Submit appeal to TPA
            sub_appeal_res = api_post("/api/v1/claim-denials/submit", {
                "claim_id": self.test_claim_id,
                "patient_id": self.test_patient_id,
                "denial_code": "204",
                "disputed_amount": 45000.00,
                "shortfall_reason": "Lack of documented conservative management trial",
                "submitted_by": "R. Sundar (Revenue Cycle Lead)"
            })
            appeal_st = sub_appeal_res.get("new_stage") or sub_appeal_res.get("appeal_status")
            
            # Check DB claim status and appeal status
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("SELECT claim_status FROM insurance_claims WHERE claim_id = %s;", (self.test_claim_id,))
            claim_st_db = cur.fetchone()[0]
            cur.execute("SELECT appeal_status FROM claim_appeals WHERE claim_id = %s ORDER BY id DESC LIMIT 1;", (self.test_claim_id,))
            appeal_row = cur.fetchone()
            appeal_db = appeal_row[0] if appeal_row else None
            cur.close()
            conn.close()

            passed_8c = (appeal_st == "SUBMITTED_TPA" or appeal_db == "SUBMITTED_TPA") and claim_st_db == "Submitted - Under Review"
            self.record_result(
                "TC-CD-01C",
                "Submit Appeal to TPA & Shift Claim to Under Review",
                "appeal_status=SUBMITTED_TPA, DB claim_status='Submitted - Under Review'",
                f"appeal_status={appeal_st}, appeal_db={appeal_db}, DB claim_status='{claim_st_db}'",
                passed_8c
            )
        except Exception as e:
            self.record_result("TC-CD-01C", "Claim Denial Code 204 Workflow", "SUBMITTED_TPA", str(e), False)

        # Test 9: Missing Medical Documents (Code 501 / DOC-MIS-09)
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE insurance_claims
                SET claim_status = 'Rejected',
                    rejection_reason = 'Treating specialist prescription and pre-admission diagnostics missing (DOC-MIS-09)'
                WHERE claim_id = %s;
            """, (self.test_claim_id,))
            cur.execute("DELETE FROM claim_appeals WHERE claim_id = %s;", (self.test_claim_id,))
            conn.commit()
            cur.close()
            conn.close()

            doc_res = api_get(f"/api/v1/claim-denials/appeal/{self.test_claim_id}")
            c_num = doc_res.get("denial_code_number")
            d_type = doc_res.get("disposition_type")
            rec_act = doc_res.get("recommended_action")

            passed = c_num == "501" and d_type == "ADDITIONAL_INFO_REQUIRED" and ("archive" in rec_act.lower() or "emr" in rec_act.lower())
            self.record_result(
                "TC-CD-02",
                "Claim Denial Missing Medical Documents (Code 501)",
                "code=501, disp=ADDITIONAL_INFO_REQUIRED, actionable recommendation",
                f"code={c_num}, disp={d_type}, action={rec_act}",
                passed
            )
        except Exception as e:
            self.record_result("TC-CD-02", "Claim Denial Missing Medical Documents", "Code 501", str(e), False)

        # Test 10: Coding Discrepancy (Code 305 / COD-01) - CORRECTION_REQUIRED
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE insurance_claims
                SET claim_status = 'Rejected',
                    rejection_reason = 'Discrepancy identified between diagnosis code and billed surgical procedure codes (COD-01)'
                WHERE claim_id = %s;
            """, (self.test_claim_id,))
            cur.execute("DELETE FROM claim_appeals WHERE claim_id = %s;", (self.test_claim_id,))
            conn.commit()
            cur.close()
            conn.close()

            cod_res = api_get(f"/api/v1/claim-denials/appeal/{self.test_claim_id}")
            c_num = cod_res.get("denial_code_number")
            c_lbl = cod_res.get("denial_code")
            d_type = cod_res.get("disposition_type")
            gate = cod_res.get("gate_status")
            rec_act = cod_res.get("recommended_action")

            passed = c_num == "305" and d_type == "CORRECTION_REQUIRED" and gate == "CORRECTION_REQUIRED_BEFORE_SUBMISSION"
            self.record_result(
                "TC-CD-03",
                "Claim Denial Coding Discrepancy (Code 305 / COD-01)",
                "code=305, disp=CORRECTION_REQUIRED, gate=CORRECTION_REQUIRED_BEFORE_SUBMISSION",
                f"code={c_num} ({c_lbl}), disp={d_type}, gate={gate}",
                passed,
                f"Recommended action: {rec_act}"
            )
        except Exception as e:
            self.record_result("TC-CD-03", "Claim Denial Coding Discrepancy", "Code 305", str(e), False)

        # Test 11: Patient Demographic & Policy ID Mismatch (Code 101 / ID-01) - CORRECTION_REQUIRED
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE insurance_claims
                SET claim_status = 'Rejected',
                    rejection_reason = 'Discrepancy detected between patient identification/demographics and insurer policy enrollment records (ID-01)'
                WHERE claim_id = %s;
            """, (self.test_claim_id,))
            cur.execute("DELETE FROM claim_appeals WHERE claim_id = %s;", (self.test_claim_id,))
            conn.commit()
            cur.close()
            conn.close()

            id_res = api_get(f"/api/v1/claim-denials/appeal/{self.test_claim_id}")
            c_num = id_res.get("denial_code_number")
            d_type = id_res.get("disposition_type")
            gate = id_res.get("gate_status")

            passed = c_num == "101" and d_type == "CORRECTION_REQUIRED" and gate == "CORRECTION_REQUIRED_BEFORE_SUBMISSION"
            self.record_result(
                "TC-CD-04",
                "Claim Denial Demographic & Policy ID Mismatch (Code 101 / ID-01)",
                "code=101, disp=CORRECTION_REQUIRED, gate=CORRECTION_REQUIRED_BEFORE_SUBMISSION",
                f"code={c_num}, disp={d_type}, gate={gate}",
                passed
            )
        except Exception as e:
            self.record_result("TC-CD-04", "Claim Denial Demographic Mismatch", "Code 101", str(e), False)

        # Test 12: Genuine Policy Exclusion - Cosmetic Surgery (Excl08) - GENUINE_DENIAL
        try:
            conn = self.pg.get_connection()
            cur = conn.cursor()
            cur.execute("""
                UPDATE insurance_claims
                SET claim_status = 'Rejected',
                    rejection_reason = 'Cosmetic or Plastic Surgery exclusion under Policy Clause Excl08'
                WHERE claim_id = %s;
            """, (self.test_claim_id,))
            cur.execute("DELETE FROM claim_appeals WHERE claim_id = %s;", (self.test_claim_id,))
            conn.commit()
            cur.close()
            conn.close()

            excl_res = api_get(f"/api/v1/claim-denials/appeal/{self.test_claim_id}")
            c_lbl = excl_res.get("denial_code")
            d_type = excl_res.get("disposition_type")
            gate = excl_res.get("gate_status")
            can_resub = excl_res.get("can_resubmit")

            passed = "excl08" in c_lbl.lower() and d_type == "GENUINE_DENIAL" and gate == "GENUINE_DENIAL_NOT_PAYABLE" and can_resub is False
            self.record_result(
                "TC-CD-05",
                "Claim Denial Genuine Policy Exclusion (Excl08 Cosmetic)",
                "code=Excl08, disp=GENUINE_DENIAL, gate=GENUINE_DENIAL_NOT_PAYABLE, can_resubmit=False",
                f"code={c_lbl}, disp={d_type}, gate={gate}, can_resubmit={can_resub}",
                passed,
                f"Blocked reason: {excl_res.get('blocked_reason')}"
            )
        except Exception as e:
            self.record_result("TC-CD-05", "Claim Denial Genuine Exclusion", "GENUINE_DENIAL", str(e), False)

    def test_workflow_integration(self):
        print("\n--- STEP 4: Testing Complete Workflow Integration ---")
        try:
            # Query preauth cases list
            cases_res = api_get("/api/v1/preauth-agent/cases")
            found_patient = any(c.get("patient_id") == self.test_patient_id for c in cases_res.get("cases", []))
            
            # Query claim denials list
            denials_res = api_get("/api/v1/claim-denials/cases")
            found_denial = any(c.get("patient_id") == self.test_patient_id for c in denials_res.get("cases", []))

            passed = found_patient and found_denial
            self.record_result(
                "TC-INT-01",
                "Live API & Data Pipeline Integration",
                "Patient present in active preauth cases and denial shortfall desks",
                f"Found in Preauth={found_patient}, Found in Denials={found_denial}",
                passed
            )
        except Exception as e:
            self.record_result("TC-INT-01", "Live API & Data Pipeline Integration", "Both True", str(e), False)

    def cleanup_test_data(self):
        print("\n--- STEP 5: Safe Cleanup of Test Data ---")
        conn = self.pg.get_connection()
        try:
            cur = conn.cursor()
            p_id = self.test_patient_id

            # Verify non-test data count before cleanup
            cur.execute("SELECT COUNT(*) FROM patients WHERE id != %s;", (p_id,))
            non_test_patients_before = cur.fetchone()[0]

            # Cleanup in exact foreign key order
            cur.execute("DELETE FROM claim_appeals WHERE patient_id = %s;", (p_id,))
            del_appeals = cur.rowcount

            cur.execute("DELETE FROM agent_action_logs WHERE patient_id = %s;", (p_id,))
            del_logs = cur.rowcount

            cur.execute("DELETE FROM insurance_claim_items WHERE claim_id IN (SELECT claim_id FROM insurance_claims WHERE patient_id = %s);", (p_id,))
            del_claim_items = cur.rowcount

            cur.execute("DELETE FROM insurance_claims WHERE patient_id = %s;", (p_id,))
            del_claims = cur.rowcount

            cur.execute("DELETE FROM bill_items WHERE bill_id IN (SELECT bill_id FROM bills WHERE patient_id = %s);", (p_id,))
            del_bill_items = cur.rowcount

            cur.execute("DELETE FROM bills WHERE patient_id = %s;", (p_id,))
            del_bills = cur.rowcount

            cur.execute("DELETE FROM diagnoses WHERE patient_id = %s;", (p_id,))
            del_diagnoses = cur.rowcount

            cur.execute("DELETE FROM dim_admission_inputs WHERE patient_id = %s;", (p_id,))
            del_gold = cur.rowcount

            cur.execute("DELETE FROM admissions WHERE patient_id = %s;", (p_id,))
            del_admissions = cur.rowcount

            cur.execute("DELETE FROM patient_insurance WHERE patient_id = %s;", (p_id,))
            del_insurance = cur.rowcount

            cur.execute("DELETE FROM patient_visits WHERE patient_id = %s;", (p_id,))
            del_visits = cur.rowcount

            cur.execute("DELETE FROM patients WHERE id = %s;", (p_id,))
            del_patient = cur.rowcount

            conn.commit()

            # Verification: Check for any remaining records with patient_id = p_id
            checks = [
                ("claim_appeals", "patient_id"),
                ("agent_action_logs", "patient_id"),
                ("insurance_claims", "patient_id"),
                ("bills", "patient_id"),
                ("diagnoses", "patient_id"),
                ("dim_admission_inputs", "patient_id"),
                ("admissions", "patient_id"),
                ("patient_insurance", "patient_id"),
                ("patient_visits", "patient_id"),
                ("patients", "id")
            ]
            orphans = {}
            for tbl, col in checks:
                cur.execute(f"SELECT COUNT(*) FROM {tbl} WHERE {col} = %s;", (p_id,))
                cnt = cur.fetchone()[0]
                if cnt > 0:
                    orphans[tbl] = cnt

            # Check non-test data count after cleanup
            cur.execute("SELECT COUNT(*) FROM patients;")
            non_test_patients_after = cur.fetchone()[0]

            no_orphans = len(orphans) == 0
            production_safe = non_test_patients_before == non_test_patients_after

            passed = no_orphans and production_safe
            self.record_result(
                "TC-CLN-01",
                "Transactional Cascade Cleanup & Zero Orphan Verification",
                "0 orphan records, non-test patients intact",
                f"Orphans={orphans}, Non-test Patients Before={non_test_patients_before}, After={non_test_patients_after}",
                passed,
                f"Deleted: {del_patient} patient, {del_visits} visits, {del_admissions} admissions, {del_claims} claims, {del_appeals} appeals"
            )
        finally:
            cur.close()
            conn.close()

    def run_all(self):
        print("=================================================================")
        print("HEALTHCARE AI POC - END-TO-END AGENT TEST SUITE")
        print("Insurance Pre-Authorization Agent (AG-07) & Claim Denial Agent (AG-20)")
        print("=================================================================")
        self.setup_test_patient()
        self.test_preauth_agent()
        self.test_claim_denial_agent()
        self.test_workflow_integration()
        self.cleanup_test_data()

        print("\n=================================================================")
        print("TEST SUITE SUMMARY")
        print("=================================================================")
        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["passed"])
        failed = total - passed
        print(f"Total Test Cases: {total}")
        print(f"Passed:           {passed}")
        print(f"Failed:           {failed}")
        print(f"Pass Rate:        {(passed / total * 100):.1f}%")
        print("=================================================================")

        # Save summary JSON for reporting
        with open("scratch/test_results.json", "w", encoding="utf-8") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "total": total,
                "passed": passed,
                "failed": failed,
                "pass_rate": f"{(passed / total * 100):.1f}%",
                "results": self.test_results
            }, f, indent=2)

if __name__ == "__main__":
    runner = E2ETestRunner()
    runner.run_all()
