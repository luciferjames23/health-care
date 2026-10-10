"""
Seed Script: Add realistic billing variance for 10 random patients (5 IP + 5 OP)
=================================================================================
Strategy:
  - IP Patients (Inpatient): Update dim_admission_inputs.llm_input_json to include
    billing.initial_estimate = (net_amount * random_factor between 0.78-0.88)
    This creates a realistic 12-22% variance that the BillingTransparencyAgent will detect.
    
  - OP Patients (Outpatient): Bills are linked via visit_id. We update the bill's gross_amount
    to reflect the "original estimate" and also store initial_estimate in the bills table
    via a new pre_admission_estimate column OR use dim_admission_inputs for those with admissions.
    For pure OP (visit only), we update llm_input_json-equivalent data in the bills table.

  Both types get:
    - Realistic variance % (8% to 22% above estimate)  
    - Named variance drivers matching actual bill_items
    - Insurance and payment adjustments where applicable
"""

import sys, os, json, random, datetime
from decimal import Decimal

sys.path.insert(0, r'e:\Bosco-projects\POC\Health-care\code\health-care\backend')
os.chdir(r'e:\Bosco-projects\POC\Health-care\code\health-care\backend')
from db.postgres_connector import PostgresConnector

random.seed(42)  # reproducible

# ── Variance scenario templates ───────────────────────────────────────────────
IP_VARIANCE_SCENARIOS = [
    {
        "variance_pct": 18.5,
        "reason": "Extended CCU monitoring beyond planned 2-day stay due to hemodynamic instability",
        "driver_en": "Additional 2 days CCU bed + continuous hemodynamic monitoring ordered by cardiologist",
        "driver_ta": "திட்டமிட்ட காலத்திற்கு அப்பால் 2 நாள் கூடுதல் ICU கண்காணிப்பு"
    },
    {
        "variance_pct": 14.2,
        "reason": "Intraoperative finding required additional surgical implant (NC balloon + stent upgrade)",
        "driver_en": "Unplanned NC balloon catheter and coronary stent deployment during procedure",
        "driver_ta": "அறுவை சிகிச்சையின்போது கூடுதல் ஸ்டென்ட் பொருத்தல் அவசியமானது"
    },
    {
        "variance_pct": 21.3,
        "reason": "Post-op fever requiring IV antibiotics and extended isolation ward stay",
        "driver_en": "Post-operative infection management: IV Meropenem 5 days + isolation room upgrade",
        "driver_ta": "அறுவைக்குப் பின் காய்ச்சல் சிகிச்சை: IV நுண்ணுயிர் எதிர்ப்பிகள் மற்றும் தனி அறை"
    },
    {
        "variance_pct": 11.8,
        "reason": "Emergency blood transfusion (2 units PRBC) required during surgery",
        "driver_en": "Intraoperative blood transfusion - 2 units Packed RBC clinically indicated",
        "driver_ta": "அறுவை சிகிச்சையின்போது அவசர இரத்தமாற்றம் (2 யூனிட்) தேவைப்பட்டது"
    },
    {
        "variance_pct": 16.7,
        "reason": "Specialist multi-department consultation (Nephrology + Neurology) post-admission",
        "driver_en": "Urgent Nephrology and Neurology specialist consultations added post-admission",
        "driver_ta": "சேர்க்கைக்குப் பின் சிறுநீரகவியல் மற்றும் நரம்பியல் நிபுணர் ஆலோசனை"
    },
    {
        "variance_pct": 19.4,
        "reason": "Advanced imaging (MRI Brain + CT Angio) required due to acute neurological symptoms",
        "driver_en": "Emergency MRI Brain and CT Angiography ordered for acute neurological workup",
        "driver_ta": "நரம்பியல் அறிகுறிகளுக்கு அவசர MRI மூளை + CT ஆஞ்சியோகிராஃபி"
    },
    {
        "variance_pct": 13.1,
        "reason": "High-alert anticoagulation therapy (Enoxaparin) extended for 5 additional days",
        "driver_en": "Enoxaparin anticoagulation therapy extended beyond planned duration due to DVT risk",
        "driver_ta": "DVT ஆபத்தால் Enoxaparin இரத்த மெலிவு சிகிச்சை கூடுதல் நாட்கள் தேவைப்பட்டது"
    },
    {
        "variance_pct": 22.6,
        "reason": "Cardiac pacemaker implant added due to intraoperative complete heart block",
        "driver_en": "Emergency pacemaker implantation due to complete AV block detected intraoperatively",
        "driver_ta": "அறுவை சிகிச்சையின்போது கண்டறியப்பட்ட AV block காரணமாக pacemaker பொருத்தல்"
    },
]

OP_VARIANCE_SCENARIOS = [
    {
        "variance_pct": 12.5,
        "reason": "Additional investigation panel (HbA1c + Lipid + Kidney function) beyond initial consultation plan",
        "driver_en": "Extended diagnostic panel ordered: HbA1c, Full Lipid Profile, eGFR Kidney Function",
        "driver_ta": "ஆரம்ப திட்டத்தை விட கூடுதல் சோதனை: HbA1c, கொழுப்பு, சிறுநீரக செயல்பாடு"
    },
    {
        "variance_pct": 9.8,
        "reason": "Specialist ophthalmology review added during OPD visit for diabetic retinopathy screening",
        "driver_en": "On-the-day diabetic retinopathy screening with fundus photography added",
        "driver_ta": "சர்க்கரை நோய் கண் பரிசோதனை (fundus photography) அன்று கூட்டப்பட்டது"
    },
    {
        "variance_pct": 15.3,
        "reason": "ECG + Echocardiogram added during cardiology OPD due to newly detected arrhythmia",
        "driver_en": "Emergency ECG and 2D Echocardiogram during OPD due to palpitations and arrhythmia",
        "driver_ta": "இதயத் துடிப்பு அசாதாரணத்தால் அவசர ECG மற்றும் Echo சோதனை கூட்டப்பட்டது"
    },
    {
        "variance_pct": 8.4,
        "reason": "Repeat blood culture + sensitivity test required for antibiotic optimization",
        "driver_en": "Repeat culture and sensitivity added for antibiotic de-escalation protocol",
        "driver_ta": "நுண்ணுயிர் சிகிச்சை சரிசெய்ய மீண்டும் culture சோதனை தேவைப்பட்டது"
    },
    {
        "variance_pct": 17.2,
        "reason": "Pulmonary function test (Spirometry) + chest X-ray added during respiratory OPD visit",
        "driver_en": "Spirometry PFT and digital chest X-ray added for COPD severity assessment",
        "driver_ta": "COPD தீவிரத்தை மதிப்பிட Spirometry மற்றும் மார்பு X-ray கூட்டப்பட்டது"
    },
]

def make_ip_llm_json(net_amount, scenario, doctor, ward, diagnosis, patient_name, insurance_provider, insurance_portion):
    """Build the billing section of llm_input_json for an IP patient with variance."""
    estimate = round(net_amount / (1 + scenario['variance_pct'] / 100), 2)
    variance_amount = round(net_amount - estimate, 2)
    
    return {
        "billing": {
            "initial_estimate": estimate,
            "pre_admission_estimate": estimate,
            "estimate_note": f"Pre-admission estimate given to patient on admission day",
            "actual_net": net_amount,
            "variance_amount": variance_amount,
            "variance_pct": scenario['variance_pct'],
            "variance_reason": scenario['reason'],
            "variance_driver_en": scenario['driver_en'],
            "variance_driver_ta": scenario['driver_ta'],
            "insurance_provider": insurance_provider,
            "bill_insurance_portion": insurance_portion,
            "patient_type": "IP",
        },
        "clinical": {
            "attending_doctor": doctor,
            "ward": ward,
            "primary_diagnosis": diagnosis,
            "variance_clinically_approved": True,
            "approval_note": f"Variance approved by attending physician - {doctor}"
        }
    }

def make_op_billing_note(net_amount, scenario):
    """Build billing estimate note for OP patients (stored in bills or visits)."""
    estimate = round(net_amount / (1 + scenario['variance_pct'] / 100), 2)
    return estimate, round(net_amount - estimate, 2)

# ──────────────────────────────────────────────────────────────────────────────
db = PostgresConnector()
conn = db.get_connection()
cur = db.get_dict_cursor(conn)

print("=" * 70)
print("BILLING VARIANCE SEED SCRIPT")
print("Seeding 10 patients (5 IP + 5 OP) with realistic billing variance")
print("=" * 70)

# ── STEP 1: Pick 5 IP patients (from dim_admission_inputs, higher bill amounts) ──
cur.execute("""
    SELECT 
        dai.admission_id, dai.patient_id, dai.patient_number,
        dai.first_name, dai.last_name,
        dai.admission_type, dai.ward_name, dai.attending_doctor,
        dai.primary_diagnosis, dai.reason_for_admission,
        dai.bill_number, dai.bill_net_amount, dai.bill_status,
        dai.outstanding_balance,
        b.bill_id, b.insurance_amount, b.patient_amount,
        ic.insurance_provider
    FROM dim_admission_inputs dai
    LEFT JOIN bills b ON dai.bill_number = b.bill_number
    LEFT JOIN insurance_claims ic ON b.bill_id = ic.bill_id
    WHERE dai.bill_net_amount IS NOT NULL 
      AND dai.bill_net_amount >= 15000
      AND (dai.llm_input_json IS NULL OR (dai.llm_input_json::text = '{}') OR (dai.llm_input_json::jsonb->>'billing' IS NULL) OR (dai.llm_input_json::jsonb->'billing'->>'initial_estimate' IS NULL))
    ORDER BY RANDOM()
    LIMIT 5;
""")
ip_patients = cur.fetchall()
print(f"\n✅ Selected {len(ip_patients)} IP patients for variance seeding:\n")

ip_seeded = []
for i, pat in enumerate(ip_patients):
    scenario = IP_VARIANCE_SCENARIOS[i % len(IP_VARIANCE_SCENARIOS)]
    name = f"{pat['first_name'] or ''} {pat['last_name'] or ''}".strip()
    net = float(pat['bill_net_amount'] or 0)
    estimate = round(net / (1 + scenario['variance_pct'] / 100), 2)
    variance = round(net - estimate, 2)
    insurance_portion = float(pat['insurance_amount'] or 0)
    insurance_provider = pat['insurance_provider'] or "Self-Pay"
    doctor = pat['attending_doctor'] or "Attending Physician"
    ward = pat['ward_name'] or "Inpatient Ward"
    diagnosis = pat['primary_diagnosis'] or pat['reason_for_admission'] or "Inpatient Care"
    
    llm_json = make_ip_llm_json(
        net, scenario, doctor, ward, diagnosis, name, insurance_provider, insurance_portion
    )
    
    print(f"  [{i+1}] IP | {name:30s} | Net: Rs.{net:>10,.0f} | Estimate: Rs.{estimate:>10,.0f} | Variance: Rs.{variance:>8,.0f} ({scenario['variance_pct']}%)")
    print(f"       Scenario: {scenario['reason'][:70]}")
    
    # Update dim_admission_inputs
    cur.execute("""
        UPDATE dim_admission_inputs
        SET llm_input_json = %s
        WHERE admission_id = %s;
    """, (json.dumps(llm_json), pat['admission_id']))
    
    # Also update bills.gross_amount to = net + variance (pre-discount gross = estimate)
    if pat['bill_id']:
        cur.execute("""
            UPDATE bills
            SET gross_amount = %s
            WHERE bill_id = %s;
        """, (estimate, pat['bill_id']))
    
    ip_seeded.append({
        "type": "IP",
        "name": name,
        "uhid": pat['patient_number'],
        "admission_id": pat['admission_id'],
        "bill_number": pat['bill_number'],
        "net_amount": net,
        "initial_estimate": estimate,
        "variance_amount": variance,
        "variance_pct": scenario['variance_pct'],
        "scenario": scenario['reason']
    })
    print()

# ── STEP 2: Pick 5 OP patients (from patient_visits with bills) ──
cur.execute("""
    SELECT 
        pv.visit_id, pv.patient_id, pv.visit_date, pv.visit_type, pv.chief_complaint,
        p.first_name, p.last_name, p.patient_code,
        b.bill_id, b.bill_number, b.gross_amount, b.net_amount, b.bill_status,
        b.insurance_amount, b.patient_amount,
        d.display_name as doctor_name,
        dept.department_name
    FROM patient_visits pv
    JOIN patients p ON pv.patient_id = p.id
    LEFT JOIN bills b ON pv.visit_id = b.visit_id
    LEFT JOIN doctors d ON pv.doctor_id = d.id
    LEFT JOIN departments dept ON pv.department_id = dept.id
    WHERE b.bill_id IS NOT NULL 
      AND b.net_amount >= 2500
      AND b.gross_amount = b.net_amount
    ORDER BY RANDOM()
    LIMIT 5;
""")
op_patients = cur.fetchall()
print(f"\n✅ Selected {len(op_patients)} OP patients for variance seeding:\n")

op_seeded = []
for i, pat in enumerate(op_patients):
    scenario = OP_VARIANCE_SCENARIOS[i % len(OP_VARIANCE_SCENARIOS)]
    name = f"{pat['first_name'] or ''} {pat['last_name'] or ''}".strip()
    net = float(pat['net_amount'] or 0)
    estimate, variance = make_op_billing_note(net, scenario)
    doctor = pat['doctor_name'] or "Outpatient Consultant"
    dept = pat['department_name'] or "OPD"

    print(f"  [{i+1}] OP | {name:30s} | Net: Rs.{net:>8,.0f} | Estimate: Rs.{estimate:>8,.0f} | Variance: Rs.{variance:>6,.0f} ({scenario['variance_pct']}%)")
    print(f"       Scenario: {scenario['reason'][:70]}")

    # For OP: Set gross_amount = estimate on the bill (so gross < net, showing pre-visit estimate)
    # net_amount stays as actual charged amount
    cur.execute("""
        UPDATE bills
        SET gross_amount = %s
        WHERE bill_id = %s;
    """, (estimate, pat['bill_id']))
    
    # Insert/Update dim_admission_inputs for OP patient (create a record if not exists)
    # First check if there's a dim_admission_inputs entry for this patient via patient_id
    cur.execute("""
        SELECT admission_id FROM dim_admission_inputs 
        WHERE patient_id = %s 
        ORDER BY admission_id DESC LIMIT 1;
    """, (pat['patient_id'],))
    dai_row = cur.fetchone()
    
    if dai_row:
        op_llm = {
            "billing": {
                "initial_estimate": estimate,
                "pre_admission_estimate": estimate,
                "actual_net": net,
                "variance_amount": variance,
                "variance_pct": scenario['variance_pct'],
                "variance_reason": scenario['reason'],
                "variance_driver_en": scenario['driver_en'],
                "variance_driver_ta": scenario['driver_ta'],
                "patient_type": "OP",
            }
        }
        cur.execute("""
            UPDATE dim_admission_inputs
            SET llm_input_json = %s
            WHERE admission_id = %s;
        """, (json.dumps(op_llm), dai_row['admission_id']))
    
    op_seeded.append({
        "type": "OP",
        "name": name,
        "uhid": pat['patient_code'],
        "visit_id": pat['visit_id'],
        "bill_id": pat['bill_id'],
        "bill_number": pat['bill_number'],
        "net_amount": net,
        "initial_estimate": estimate,
        "variance_amount": variance,
        "variance_pct": scenario['variance_pct'],
        "scenario": scenario['reason']
    })
    print()

conn.commit()
cur.close()
conn.close()

# ── Summary ─────────────────────────────────────────────────────────────────
all_seeded = ip_seeded + op_seeded
print("\n" + "=" * 70)
print("SEEDING COMPLETE — SUMMARY")
print("=" * 70)
print(f"\n{'No':<4} {'Type':<4} {'Patient Name':<30} {'Net Bill':>12} {'Estimate':>12} {'Variance':>10} {'Var%':>6}")
print("-" * 82)
for i, s in enumerate(all_seeded, 1):
    print(f"{i:<4} {s['type']:<4} {s['name']:<30} Rs.{s['net_amount']:>9,.0f} Rs.{s['initial_estimate']:>9,.0f} Rs.{s['variance_amount']:>7,.0f} {s['variance_pct']:>5.1f}%")

print(f"\n✅ {len(ip_seeded)} IP patients updated in dim_admission_inputs (llm_input_json.billing)")
print(f"✅ {len(op_seeded)} OP patients updated in bills (gross_amount = estimate) + dim_admission_inputs")
print(f"\nThe Billing Transparency Agent will now dynamically detect and explain these variances.")
print(f"Test by opening any of the seeded patients in the Billing Desk Agent Studio view.\n")
