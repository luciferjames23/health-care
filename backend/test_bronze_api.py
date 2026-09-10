import sys
from pathlib import Path
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from main import app
from connectors.databricks_connector import DatabricksConnector

# Enable fast fallback mode for instant local testing
DatabricksConnector._connection_failed = True

client = TestClient(app)

def test_bronze_tables_api():
    print("\n--- 1. Testing GET /api/v1/bronze/tables (List Bronze Tables) ---")
    res = client.get("/api/v1/bronze/tables")
    assert res.status_code == 200
    data = res.json()
    print("Status:", res.status_code)
    print("Bronze Table Count:", data.get("count"))
    assert data["count"] == 3
    table_names = [t["table_name"] for t in data["tables"]]
    assert "beds" in table_names
    assert "doctors" in table_names
    assert "patients" in table_names

    print("\n--- 2. Testing GET /api/v1/bronze/summary (Bronze Overview Summary) ---")
    res = client.get("/api/v1/bronze/summary")
    assert res.status_code == 200
    summary = res.json()
    print("Table Counts:", summary.get("table_counts"))
    print("Bronze KPIs:", summary.get("kpis"))
    assert summary.get("table_counts", {}).get("beds_count") > 0
    assert summary.get("table_counts", {}).get("doctors_count") > 0
    assert summary.get("table_counts", {}).get("patients_count") > 0

    print("\n--- 3. Testing GET /api/v1/bronze/beds (Query health_care.bronze.beds) ---")
    res = client.get("/api/v1/bronze/beds")
    assert res.status_code == 200
    beds_data = res.json()
    print("Beds Default Limit:", beds_data.get("limit"))
    print("Returned Beds:", beds_data.get("returned_rows"))
    assert beds_data.get("limit") == 400
    assert beds_data.get("returned_rows") > 0

    print("\n--- 4. Testing GET /api/v1/bronze/beds/summary (Beds Summary) ---")
    res = client.get("/api/v1/bronze/beds/summary")
    assert res.status_code == 200
    beds_sum = res.json()
    print("Beds Metrics:", beds_sum.get("metrics"))
    assert "occupancy_status_breakdown" in beds_sum.get("metrics", {})

    print("\n--- 5. Testing GET /api/v1/bronze/beds/{id} (Single Bed Record Lookup) ---")
    res = client.get("/api/v1/bronze/beds/101")
    assert res.status_code == 200
    bed_item = res.json()
    print("Bed Item:", bed_item.get("bed_id"), bed_item.get("bed_number"), bed_item.get("occupancy_status"))
    assert bed_item.get("bed_id") == 101

    print("\n--- 6. Testing GET /api/v1/bronze/doctors (Query health_care.bronze.doctors) ---")
    res = client.get("/api/v1/bronze/doctors?specialty=Cardiology")
    assert res.status_code == 200
    docs_data = res.json()
    print("Returned Cardiology Doctors:", docs_data.get("returned_rows"))
    assert docs_data.get("returned_rows") > 0
    assert docs_data.get("limit") == 400

    print("\n--- 7. Testing GET /api/v1/bronze/doctors/summary (Doctors Summary) ---")
    res = client.get("/api/v1/bronze/doctors/summary")
    assert res.status_code == 200
    docs_sum = res.json()
    print("Doctors Metrics:", docs_sum.get("metrics"))
    assert "active_doctors_count" in docs_sum.get("metrics", {})

    print("\n--- 8. Testing GET /api/v1/bronze/doctors/{id} (Single Doctor Lookup) ---")
    res = client.get("/api/v1/bronze/doctors/88210")
    assert res.status_code == 200
    doc_item = res.json()
    print("Doctor Item:", doc_item.get("doctor_id"), doc_item.get("full_name"), doc_item.get("specialty"))
    assert doc_item.get("doctor_id") == 88210

    print("\n--- 9. Testing GET /api/v1/bronze/patients (Query health_care.bronze.patients) ---")
    res = client.get("/api/v1/bronze/patients")
    assert res.status_code == 200
    pats_data = res.json()
    print("Patients Default Limit:", pats_data.get("limit"))
    print("Returned Patients:", pats_data.get("returned_rows"))
    assert pats_data.get("limit") == 400
    assert pats_data.get("returned_rows") > 0

    print("\n--- 10. Testing GET /api/v1/bronze/patients/summary (Patients Summary) ---")
    res = client.get("/api/v1/bronze/patients/summary")
    assert res.status_code == 200
    pats_sum = res.json()
    print("Patients Metrics:", pats_sum.get("metrics"))
    assert "gender_breakdown" in pats_sum.get("metrics", {})

    print("\n--- 11. Testing GET /api/v1/bronze/patients/{id} (Single Patient Lookup) ---")
    res = client.get("/api/v1/bronze/patients/10892")
    assert res.status_code == 200
    pat_item = res.json()
    print("Patient Item:", pat_item.get("patient_id"), pat_item.get("first_name"), pat_item.get("last_name"))
    assert pat_item.get("patient_id") == 10892

    print("\n--- 12. Testing GET /api/v1/bronze/table/{table_name} (Dynamic Bronze Query) ---")
    res = client.get("/api/v1/bronze/table/patients?limit=1")
    assert res.status_code == 200
    dyn_data = res.json()
    print("Dynamic Bronze Query (limit=1): limit =", dyn_data.get("limit"), "| returned_rows =", dyn_data.get("returned_rows"))
    assert dyn_data.get("limit") == 1
    assert dyn_data.get("returned_rows") == 1

    print("\n[SUCCESS] ALL BRONZE SCHEMA API TESTS AND DEFAULT LIMIT VERIFICATIONS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_bronze_tables_api()
