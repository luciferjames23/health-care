import requests

BASE_URL = "http://localhost:8000"

def test_clinical_ops_all_patients():
    print("Testing GET /api/v1/clinical-ops/all-patients?category=OP...")
    resp = requests.get(f"{BASE_URL}/api/v1/clinical-ops/all-patients", params={"category": "OP"})
    print("HTTP Status:", resp.status_code)
    assert resp.status_code == 200
    data = resp.json()
    print("Response Type:", type(data))
    print("Total Records in OP category:", len(data))
    
    edwin_records = [r for r in data if "Edwin" in str(r.get("doctor", ""))]
    print(f"Records for Dr. Edwin Stephano J: {len(edwin_records)}")
    for r in edwin_records:
        print("  - Patient ID:", r.get("patient_id"), "| Name:", r.get("patient_name"), "| Doctor:", r.get("doctor"), "| Status:", r.get("status"))

    assert len(edwin_records) >= 3, "Expected at least 3 records for Dr. Edwin Stephano J!"
    print("SUCCESS: Clinical Ops OP Directory returns all Dr. Edwin Stephano J patients!")

if __name__ == "__main__":
    test_clinical_ops_all_patients()
