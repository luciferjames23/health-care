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
    assert data["count"] == 2

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

    print("\n--- 9. Testing GET /api/v1/gold/table/{table_name} (Dynamic Query Endpoint) ---")
    res = client.get("/api/v1/gold/table/fact_bed_demand_forecast_7day_detailed")
    assert res.status_code == 200
    print("Dynamic Table Query rows:", res.json().get("returned_rows"))

    print("\n[SUCCESS] ALL GOLD SCHEMA API TESTS FOR dim_revenue_predictions AND fact_bed_demand_forecast_7day_detailed PASSED PERFECTLY!")

if __name__ == "__main__":
    test_gold_tables_api()
