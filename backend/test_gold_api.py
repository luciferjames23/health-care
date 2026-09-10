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

def test_gold_tables_api():
    print("\n--- 1. Testing GET /api/v1/gold/tables (List Gold Tables) ---")
    res = client.get("/api/v1/gold/tables")
    assert res.status_code == 200
    data = res.json()
    print("Status:", res.status_code)
    print("Gold Table Count:", data.get("count"))
    assert data["count"] == 4

    print("\n--- 2. Testing GET /api/v1/gold/summary (Executive Analytics Summary) ---")
    res = client.get("/api/v1/gold/summary")
    assert res.status_code == 200
    summary = res.json()
    print("Financial KPIs:", summary.get("financial_kpis"))
    print("Bed Capacity KPIs:", summary.get("bed_capacity_kpis"))
    assert "total_predicted_revenue_usd" in summary.get("financial_kpis", {})

    print("\n--- 3. Testing GET /api/v1/gold/revenue-predictions (Query dim_revenue_predictions) ---")
    res = client.get("/api/v1/gold/revenue-predictions?risk_level=LOW")
    assert res.status_code == 200
    rev_data = res.json()
    print("Returned LOW Risk Revenue Predictions:", rev_data.get("returned_rows"))
    assert rev_data.get("returned_rows") > 0

    print("\n--- 4. Testing GET /api/v1/gold/revenue-predictions/summary (Revenue Analytics) ---")
    res = client.get("/api/v1/gold/revenue-predictions/summary")
    assert res.status_code == 200
    rev_summary = res.json()
    print("Revenue Summary:", rev_summary)
    assert "total_predicted_revenue_usd" in rev_summary

    print("\n--- 5. Testing GET /api/v1/gold/revenue-predictions/{id} (Lookup Single Prediction) ---")
    res = client.get("/api/v1/gold/revenue-predictions/REV-PRED-2026-001")
    assert res.status_code == 200
    item = res.json()
    print("Prediction Item:", item.get("prediction_id"), item.get("department"), item.get("predicted_revenue"))
    assert item.get("prediction_id") == "REV-PRED-2026-001"

    print("\n--- 6. Testing GET /api/v1/gold/bed-demand-forecast (Query fact_bed_demand_forecast_7day_detailed) ---")
    res = client.get("/api/v1/gold/bed-demand-forecast")
    assert res.status_code == 200
    bed_data = res.json()
    print("Returned Bed Demand Detailed Forecasts:", bed_data.get("returned_rows"))
    assert bed_data.get("returned_rows") > 0

    print("\n--- 7. Testing GET /api/v1/gold/bed-demand-forecast/summary (Bed Forecast Summary) ---")
    res = client.get("/api/v1/gold/bed-demand-forecast/summary")
    assert res.status_code == 200
    bed_summary = res.json()
    print("Bed Forecast Summary:", bed_summary)
    assert "total_predicted_beds" in bed_summary.get("metrics", {})

    print("\n--- 8. Testing GET /api/v1/gold/bed-demand-forecast/7day-trend (7-Day Detailed Forecast List) ---")
    res = client.get("/api/v1/gold/bed-demand-forecast/7day-trend")
    assert res.status_code == 200
    trend_data = res.json()
    print("7-Day Trend Detailed List Returned Rows:", trend_data.get("returned_rows"))
    assert trend_data.get("returned_rows") > 0
    assert "forecast_date" in trend_data.get("data", [])[0]
    assert "ward_name" in trend_data.get("data", [])[0]

    print("\n--- 9. Testing GET /api/v1/gold/current-admission-llm-inputs (Query dim_admission_inputs) ---")
    res = client.get("/api/v1/gold/current-admission-llm-inputs?admission_type=Emergency")
    assert res.status_code == 200
    adm_data = res.json()
    print("Returned Emergency Admission LLM Inputs:", adm_data.get("returned_rows"))
    assert adm_data.get("returned_rows") > 0
    assert adm_data.get("data")[0]["admission_type"] == "Emergency"

    print("\n--- 10. Testing GET /api/v1/gold/current-admission-llm-inputs/summary (Admission LLM Summary) ---")
    res = client.get("/api/v1/gold/current-admission-llm-inputs/summary")
    assert res.status_code == 200
    adm_summary = res.json()
    print("Admission LLM Summary:", adm_summary)
    assert "avg_risk_score" in adm_summary.get("metrics", {})

    print("\n--- 11. Testing GET /api/v1/gold/current-admission-llm-inputs/{id} (Single Admission Lookup) ---")
    res = client.get("/api/v1/gold/current-admission-llm-inputs/ADM-2026-001")
    assert res.status_code == 200
    adm_item = res.json()
    print("Admission LLM Record:", adm_item.get("admission_id"), adm_item.get("patient_name"), adm_item.get("risk_score"))
    assert adm_item.get("admission_id") == "ADM-2026-001"

    print("\n--- 12. Testing GET /api/v1/gold/generated-discharge-summaries (Query dim_generated_discharge_summaries) ---")
    res = client.get("/api/v1/gold/generated-discharge-summaries?approval_status=Approved")
    assert res.status_code == 200
    ds_data = res.json()
    print("Returned Approved Discharge Summaries:", ds_data.get("returned_rows"))
    assert ds_data.get("returned_rows") > 0
    assert ds_data.get("data")[0]["approval_status"] == "Approved"

    print("\n--- 13. Testing GET /api/v1/gold/generated-discharge-summaries/summary (Discharge Summary Analytics) ---")
    res = client.get("/api/v1/gold/generated-discharge-summaries/summary")
    assert res.status_code == 200
    ds_summary = res.json()
    print("Discharge Summary Analytics:", ds_summary)
    assert "approved_count" in ds_summary.get("metrics", {})

    print("\n--- 14. Testing GET /api/v1/gold/generated-discharge-summaries/{id} (Single Summary Lookup) ---")
    res = client.get("/api/v1/gold/generated-discharge-summaries/DS-2026-001")
    assert res.status_code == 200
    ds_item = res.json()
    print("Discharge Summary Record:", ds_item.get("summary_id"), ds_item.get("patient_name"), ds_item.get("approval_status"))
    assert ds_item.get("summary_id") == "DS-2026-001"

    print("\n--- 15. Testing GET /api/v1/gold/table/{table_name} (Dynamic Query Endpoint) ---")
    res = client.get("/api/v1/gold/table/dim_generated_discharge_summaries")
    assert res.status_code == 200
    print("Dynamic Table Query rows for dim_generated_discharge_summaries:", res.json().get("returned_rows"))
    assert res.json().get("returned_rows") > 0

    print("\n--- 16. Testing Default Limit Behavior (Omitted Limit = Full Data, Explicit Limit = Truncated) ---")
    # Test 16a: Omitted limit returns full data (all 5 admission records)
    full_res = client.get("/api/v1/gold/current-admission-llm-inputs")
    assert full_res.status_code == 200
    full_json = full_res.json()
    assert full_json.get("limit") is None
    assert full_json.get("returned_rows") == 5
    print("Full Data (No limit specified): limit =", full_json.get("limit"), "| returned_rows =", full_json.get("returned_rows"))

    # Test 16b: Explicit limit=2 returns exactly 2 records
    limited_res = client.get("/api/v1/gold/current-admission-llm-inputs?limit=2")
    assert limited_res.status_code == 200
    limited_json = limited_res.json()
    assert limited_json.get("limit") == 2
    assert limited_json.get("returned_rows") == 2
    print("Explicit Limit (limit=2): limit =", limited_json.get("limit"), "| returned_rows =", limited_json.get("returned_rows"))

    print("\n[SUCCESS] ALL GOLD SCHEMA API TESTS AND LIMIT BEHAVIOR VERIFICATIONS PASSED PERFECTLY!")

if __name__ == "__main__":
    test_gold_tables_api()



