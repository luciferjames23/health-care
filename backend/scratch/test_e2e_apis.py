import sys, os, urllib.request, json
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8000"

def get(url):
    try:
        req = urllib.request.Request(f"{BASE_URL}{url}", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body
    except Exception as e:
        return 500, str(e)

def test_patient(pid, label):
    print(f"\n=======================================================")
    print(f"TESTING PATIENT: {pid} ({label})")
    print(f"=======================================================")
    
    # 1. Vitals
    st, data = get(f"/api/v1/clinical-ops/vitals?patient_id={pid}")
    vitals_cnt = len(data.get('data', [])) if isinstance(data, dict) else 0
    print(f"1. Vitals: HTTP {st}, records: {vitals_cnt}")
    
    # 2. Diagnoses
    st, data = get(f"/api/v1/clinical-ops/diagnoses?patient_id={pid}")
    diag_cnt = len(data.get('data', [])) if isinstance(data, dict) else 0
    print(f"2. Diagnoses: HTTP {st}, records: {diag_cnt}")
    if diag_cnt > 0:
        first = data['data'][0]
        print(f"   Sample diag: {first.get('code')} - {first.get('name')} (Dr. {first.get('doctor')})")
        
    # 3. Lab Orders
    st, data = get(f"/api/v1/clinical-ops/labs?patient_id={pid}")
    lab_cnt = len(data.get('data', [])) if isinstance(data, dict) else 0
    print(f"3. Labs: HTTP {st}, records: {lab_cnt}")
    if lab_cnt > 0:
        first = data['data'][0]
        res_cnt = len(first.get('results', []))
        print(f"   Sample lab: {first.get('order_number')} - {first.get('test_name')} | Results count: {res_cnt}")
        
    # 4. Prescriptions
    st, data = get(f"/api/v1/pharmacy-supply/prescriptions?patient_id={pid}")
    rx_cnt = len(data.get('data', [])) if isinstance(data, dict) else 0
    print(f"4. Prescriptions: HTTP {st}, records: {rx_cnt}")
    if rx_cnt > 0:
        first = data['data'][0]
        print(f"   Sample rx: {first.get('rx_number')} - {first.get('drug')} ({first.get('dosage')} {first.get('frequency')})")
        
    # 5. Bill by Patient
    st, data = get(f"/api/finance/bills/patient/{pid}")
    has_bill = st == 200 and 'bill' in data
    print(f"5. Bill: HTTP {st}, has_bill: {has_bill}")
    if has_bill:
        b = data['bill']
        print(f"   Bill ID: {b.get('bill_id')}, No: {b.get('bill_number')}, Net: {b.get('net_amount')}, Insurer: {b.get('insurance_provider')}")
        print(f"   Items: {len(b.get('items', []))}, Pharm items: {len(b.get('pharmacy_items', []))}, Lab items: {len(b.get('lab_items', []))}, Claims: {len(b.get('claims', []))}")
        
    # 6. Discharge Summary
    st, data = get(f"/api/v1/gold/generated-discharge-summaries/{pid}")
    has_ds = st == 200 and ('summary_id' in data or 'data' in data)
    print(f"6. Discharge Summary: HTTP {st}, has_summary: {has_ds}")
    if has_ds:
        ds = data.get('data', [data])[0] if 'data' in data else data
        print(f"   Summary ID: {ds.get('summary_id')}, Diagnosis: {str(ds.get('discharge_diagnosis') or ds.get('diagnoses'))[:40]}...")

    # 7. Radiology
    st, data = get(f"/api/v1/gold/patient-scans?patient_id={pid}")
    scan_cnt = len(data.get('data', [])) if isinstance(data, dict) else 0
    print(f"7. Radiology Scans: HTTP {st}, records: {scan_cnt}")

if __name__ == '__main__':
    # Test suite of multiple diverse patients:
    patients_to_test = [
        (3, "Inpatient: Admitted, Insured + Claim (Pooja Narayanan)"),
        (4, "Inpatient: Admitted, Insured no Claim (Anand Narayanan)"),
        (87256, "Inpatient: Discharged, Radiology Order (Rohitel Parthalan)"),
        (98321, "Outpatient: Self-Pay / Uninsured (Aarav Krishnan)"),
        (43716, "Inpatient: Insurance Claim Partially Approved (Meenakshia Vermakar)")
    ]
    for pid, lbl in patients_to_test:
        test_patient(pid, lbl)
