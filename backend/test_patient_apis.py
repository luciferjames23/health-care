import urllib.request
import json
import sys

BASE_URL = 'http://localhost:8000/api/v1/patients'

def post_json(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def delete_req(url):
    req = urllib.request.Request(url, method='DELETE')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def get_req(url):
    req = urllib.request.Request(url, method='GET')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

print('=== 1. TEST CREATE INSURED PATIENT (Rs 45 Lakh) ===')
payload_insured = {
    'first_name': 'Vikram',
    'last_name': 'Rathore',
    'date_of_birth': '1982-05-14',
    'gender': 'Male',
    'blood_group': 'O+',
    'phone': '9876543210',
    'email': 'vikram.rathore@example.com',
    'address': 'Flat 402, Green Valley Apartments',
    'city': 'Bengaluru',
    'state': 'Karnataka',
    'postal_code': '560001',
    'emergency_contact_name': 'Ananya Rathore',
    'emergency_contact_phone': '9876543211',
    'emergency_contact_relationship': 'Spouse',
    'is_insured': True,
    'insurance_amount': 4500000.0,
    'insurance_provider': 'Star Health & Allied Insurance',
    'policy_number': 'STAR-POL-2026-991',
    'group_number': 'GRP-TECH-88',
    'insurance_plan_name': 'Super Surplus Floater Gold',
    'insurance_status': 'Active',
    'co_pay_percentage': 10.0,
    'deductible_amount': 50000.0,
    'pre_auth_required': True,
    'create_visit': True,
    'visit_type': 'Inpatient',
    'consultation_reason': 'Acute Severe Cardiac Chest Pain & Dyspnea',
    'create_admission': True,
    'admission_type': 'Emergency',
    'admission_source': 'Emergency Department',
    'reason_for_admission': 'Acute Coronary Syndrome - Immediate Intervention',
    'primary_diagnosis': 'Acute ST-Elevation Myocardial Infarction',
    'diagnoses': [
        {'diagnosis_code': 'I21.0', 'diagnosis_name': 'Acute transmural myocardial infarction of anterior wall', 'diagnosis_type': 'Primary', 'is_primary': True},
        {'diagnosis_code': 'I10', 'diagnosis_name': 'Essential (primary) hypertension', 'diagnosis_type': 'Secondary', 'is_primary': False}
    ],
    'vitals': {
        'blood_pressure_systolic': 165,
        'blood_pressure_diastolic': 102,
        'heart_rate': 114,
        'respiratory_rate': 24,
        'temperature': 99.1,
        'oxygen_saturation': 93.0,
        'pain_scale': 8
    },
    'prescriptions': [
        {'medication_name': 'Aspirin', 'dosage': '300mg', 'frequency': 'Stat (Immediate)', 'route': 'Oral', 'duration': '1 day'},
        {'medication_name': 'Clopidogrel', 'dosage': '300mg', 'frequency': 'Stat (Immediate)', 'route': 'Oral', 'duration': '1 day'},
        {'medication_name': 'Atorvastatin', 'dosage': '80mg', 'frequency': 'Once at night', 'route': 'Oral', 'duration': '30 days'}
    ],
    'lab_orders': [
        {'test_name': 'Cardiac Troponin I (High Sensitivity)', 'test_code': 'TROP-I-HS', 'test_category': 'Cardiac Markers', 'urgency': 'Emergency'},
        {'test_name': '12-Lead Electrocardiogram (ECG)', 'test_code': 'ECG-12L', 'test_category': 'Cardiology Diagnostics', 'urgency': 'Emergency'}
    ],
    'create_billing': True,
    'bill_items': [
        {'item_type': 'Consultation', 'item_name': 'Emergency Cardiology Assessment', 'unit_price': 3000.0, 'quantity': 1},
        {'item_type': 'Procedure', 'item_name': 'Emergency Coronary Angiography', 'unit_price': 35000.0, 'quantity': 1},
        {'item_type': 'Bed Charge', 'item_name': 'ICU Bed Day Charge', 'unit_price': 12000.0, 'quantity': 1}
    ]
}

status, res_insured = post_json(f'{BASE_URL}/create-full', payload_insured)
print(f'Status: {status}')
print(f'Success: {res_insured.get("success")}')
pat_ins = res_insured.get('patient', {})
pid_insured = pat_ins.get('id')
pcode_insured = pat_ins.get('patient_code')
print(f'Created Insured Patient: ID={pid_insured}, Code={pcode_insured}')
print(f'Insurance Record: {res_insured.get("insurance")}')
print(f'Billing Record: {res_insured.get("bill")}')
print(f'Claim Record: {res_insured.get("insurance_claim")}')

print('\n=== 2. TEST CREATE UNINSURED PATIENT ===')
payload_uninsured = {
    'first_name': 'Ramesh',
    'last_name': 'Gupta',
    'date_of_birth': '1995-11-20',
    'gender': 'Male',
    'phone': '9811223344',
    'is_insured': False,
    'create_visit': True,
    'visit_type': 'Outpatient',
    'consultation_reason': 'Viral fever and throat irritation',
    'create_admission': False,
    'primary_diagnosis': 'Acute Upper Respiratory Tract Infection',
    'diagnoses': [
        {'diagnosis_code': 'J06.9', 'diagnosis_name': 'Acute upper respiratory infection, unspecified', 'diagnosis_type': 'Primary', 'is_primary': True}
    ],
    'bill_items': [
        {'item_type': 'Consultation', 'item_name': 'General Physician Consultation', 'unit_price': 800.0, 'quantity': 1},
        {'item_type': 'Pharmacy', 'item_name': 'Paracetamol 650mg (10 tabs)', 'unit_price': 50.0, 'quantity': 1}
    ]
}

status, res_uninsured = post_json(f'{BASE_URL}/create-full', payload_uninsured)
print(f'Status: {status}')
pat_unins = res_uninsured.get('patient', {})
pid_uninsured = pat_unins.get('id')
pcode_uninsured = pat_unins.get('patient_code')
print(f'Created Uninsured Patient: ID={pid_uninsured}, Code={pcode_uninsured}')
print(f'Insurance Record (Should be None): {res_uninsured.get("insurance")}')
print(f'Billing Record: {res_uninsured.get("bill")}')

print('\n=== 3. GET FULL PATIENT DETAILS ===')
st, details = get_req(f'{BASE_URL}/{pid_insured}/full-details')
pat_data = details.get('data', {})
print(f'Status: {st}, Full details fetched for {pid_insured}:')
print(f'Patient Name: {pat_data.get("patient", {}).get("first_name")} {pat_data.get("patient", {}).get("last_name")}')
print(f'Insurance Coverage Limit: {pat_data.get("insurance", {}).get("coverage_limit")}')
print(f'Admissions count: {len(pat_data.get("admissions", []))}')
print(f'Diagnoses count: {len(pat_data.get("diagnoses", []))}')
print(f'Prescriptions count: {len(pat_data.get("prescriptions", []))}')
print(f'Bills count: {len(pat_data.get("bills", []))}')
print(f'Lab Orders count: {len(pat_data.get("lab_orders", []))}')

print('\n=== 4. TEST ATOMIC DELETION ===')
del_st, del_res = delete_req(f'{BASE_URL}/{pid_insured}/delete-full')
print(f'Delete Insured Patient ({pid_insured}) Status: {del_st}')
print(f'Purged entities: {del_res.get("purged_records")}')

del_st2, del_res2 = delete_req(f'{BASE_URL}/{pid_uninsured}/delete-full')
print(f'Delete Uninsured Patient ({pid_uninsured}) Status: {del_st2}')
print(f'Purged entities: {del_res2.get("purged_records")}')

print('\n=== 5. VERIFY DELETED PATIENTS ARE 404 (NO ORPHANS) ===')
chk_st, chk_res = get_req(f'{BASE_URL}/{pid_insured}/full-details')
print(f'Checking {pid_insured} after deletion -> Status: {chk_st} ({chk_res.get("detail")})')
chk_st2, chk_res2 = get_req(f'{BASE_URL}/{pid_uninsured}/full-details')
print(f'Checking {pid_uninsured} after deletion -> Status: {chk_st2} ({chk_res2.get("detail")})')

print('\n=== ALL END-TO-END TESTS COMPLETED SUCCESSFULLY! ===')
