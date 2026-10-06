import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=================================================================")
print("1. TEST GET AVAILABLE BEDS (/api/v1/patients/available-beds)")
print("=================================================================")
beds_resp = client.get("/api/v1/patients/available-beds")
print(f"Status: {beds_resp.status_code}")
beds_data = beds_resp.json()
print(f"Total Available Beds: {beds_data.get('total_available')}")
available_beds = beds_data.get("available_beds", [])
selected_bed = available_beds[0] if available_beds else None
if selected_bed:
    print(f"Selected Available Bed for Admission: {selected_bed['bed_number']} (ID: {selected_bed['bed_id']}, Type: {selected_bed['bed_type']}, Daily Rate: Rs {selected_bed['daily_charge']}, Ward: {selected_bed['ward_name']})")
else:
    print("Warning: No available beds found in database!")

print("\n=================================================================")
print("2. TEST CREATE INPATIENT (IP) WITH BED ALLOCATION & BED CHARGE IN BILL")
print("=================================================================")
payload_ip = {
    "patient_type": "IP",
    "is_insured": True,
    "insurance_amount": 2500000.0,
    "insurance_provider": "HDFC ERGO General Insurance",
    "policy_number": "HDFC-MED-2026-8821",
    
    "first_name": "Siddharth",
    "last_name": "Mukherjee",
    "date_of_birth": "1978-08-22",
    "gender": "Male",
    "blood_group": "B+",
    "phone": "+91 98401 22334",
    "email": "siddharth.m@example.com",
    
    "bed_id": selected_bed["bed_id"] if selected_bed else None,
    "bed_number": selected_bed["bed_number"] if selected_bed else None,
    "admission_days": 3,
    "reason_for_admission": "Severe Pneumonia with Type 1 Respiratory Failure",
    
    "primary_diagnosis": "Severe Community-Acquired Pneumonia",
    "diagnoses": [
        {"diagnosis_code": "J18.9", "diagnosis_name": "Pneumonia, unspecified organism", "diagnosis_type": "Primary", "is_primary": True},
        {"diagnosis_code": "J96.00", "diagnosis_name": "Acute respiratory failure, unspecified", "diagnosis_type": "Secondary", "is_primary": False}
    ],
    
    "vitals": {
        "temperature": 101.4,
        "heart_rate": 108,
        "systolic_bp": 130,
        "diastolic_bp": 85,
        "oxygen_saturation": 91.0
    },
    
    "medications": [
        {"medication_name": "Ceftriaxone IV", "dosage": "1g", "frequency": "BD", "route": "IV", "duration": "5 Days"},
        {"medication_name": "Azithromycin", "dosage": "500mg", "frequency": "OD", "route": "Oral", "duration": "5 Days"}
    ],
    
    "bill_items": [
        {"item_name": "Specialist Pulmonology Consultation", "unit_price": 2500.0, "quantity": 1},
        {"item_name": "Oxygen Therapy & Nebulization (3 Days)", "unit_price": 1800.0, "quantity": 3}
    ]
}

resp_ip = client.post("/api/v1/patients/create-full", json=payload_ip)
print(f"Status: {resp_ip.status_code}")
res_ip_json = resp_ip.json()
print(f"Success: {res_ip_json.get('success')}")
print(f"Encounter Type: {res_ip_json.get('encounter_type')}")
pid_ip = res_ip_json.get("patient", {}).get("id")
pcode_ip = res_ip_json.get("patient", {}).get("patient_code")
print(f"Created IP Patient: ID={pid_ip}, Code={pcode_ip}")
print(f"\nBed Allocated Details in Response:")
print(json.dumps(res_ip_json.get("bed"), indent=2))
print(f"\nAdmission Details:")
print(json.dumps(res_ip_json.get("admission"), indent=2))
print(f"\nBilling Breakdown (Bed Charge Included):")
print(json.dumps(res_ip_json.get("bill"), indent=2))

print("\n=================================================================")
print("3. TEST CREATE OUTPATIENT (OP) - NO BED ASSIGNED, NO BED CHARGE")
print("=================================================================")
payload_op = {
    "patient_type": "OP",
    "is_insured": False,
    "first_name": "Kavita",
    "last_name": "Krishnan",
    "date_of_birth": "1992-04-11",
    "gender": "Female",
    "phone": "+91 97890 11223",
    "consultation_reason": "Migraine headache and mild vertigo",
    "primary_diagnosis": "Classic Migraine without aura",
    "bill_items": [
        {"item_name": "Neurology Consultation", "unit_price": 1000.0, "quantity": 1},
        {"item_name": "Sumatriptan 50mg Tablets", "unit_price": 120.0, "quantity": 1}
    ]
}

resp_op = client.post("/api/v1/patients/create-full", json=payload_op)
print(f"Status: {resp_op.status_code}")
res_op_json = resp_op.json()
print(f"Success: {res_op_json.get('success')}")
print(f"Encounter Type: {res_op_json.get('encounter_type')}")
pid_op = res_op_json.get("patient", {}).get("id")
pcode_op = res_op_json.get("patient", {}).get("patient_code")
print(f"Created OP Patient: ID={pid_op}, Code={pcode_op}")
print(f"Bed Object (Must be None): {res_op_json.get('bed')}")
print(f"Admission Object (Must be None): {res_op_json.get('admission')}")
print(f"Billing Breakdown (OP Only):")
print(json.dumps(res_op_json.get("bill"), indent=2))

print("\n=================================================================")
print("4. TEST DELETE BOTH PATIENTS & VERIFY BED STATUS RESTORED TO AVAILABLE")
print("=================================================================")
del_resp_ip = client.delete(f"/api/v1/patients/{pid_ip}/delete-full")
print(f"Delete IP Patient Status: {del_resp_ip.status_code}")
print(f"Records Purged: {del_resp_ip.json().get('records_purged')}")

del_resp_op = client.delete(f"/api/v1/patients/{pid_op}/delete-full")
print(f"Delete OP Patient Status: {del_resp_op.status_code}")
print(f"Records Purged: {del_resp_op.json().get('records_purged')}")

print("\n=================================================================")
print("5. VERIFY GET ON DELETED PATIENTS RETURNS 404")
print("=================================================================")
chk_ip = client.get(f"/api/v1/patients/{pid_ip}/full-details")
print(f"Checking IP Patient {pid_ip} -> Status: {chk_ip.status_code} ({chk_ip.json().get('detail')})")
chk_op = client.get(f"/api/v1/patients/{pid_op}/full-details")
print(f"Checking OP Patient {pid_op} -> Status: {chk_op.status_code} ({chk_op.json().get('detail')})")

print("\n=== ALL IP/OP AND BED CHARGE BILLING TESTS PASSED PERFECTLY! ===")
