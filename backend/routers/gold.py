from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from connectors.databricks_connector import DatabricksConnector, MOCK_GOLD_DATA
from config.config import Config

router = APIRouter(
    prefix="/api/v1/gold",
    tags=["Healthcare Gold Layer APIs"]
)

db_connector = DatabricksConnector()

GOLD_TABLES_META = {
    "dim_revenue_predictions": {
        "table_name": "dim_revenue_predictions",
        "primary_key": "revenue_prediction_id",
        "domain": "Financial & Predictive Analytics",
        "description": "Departmental and patient-level revenue projections, actual amounts, prediction variances, model names, and monthly totals.",
        "schema": [
            {"column_name": "revenue_prediction_id", "data_type": "BIGINT", "is_primary": True},
            {"column_name": "bill_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "patient_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "patient_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "patient_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "bill_date", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "bill_status", "data_type": "STRING", "is_primary": False},
            {"column_name": "actual_net_amount", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "predicted_revenue", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "prediction_variance", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "model_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "prediction_date", "data_type": "TIMESTAMP", "is_primary": False}
        ]
    },
    "fact_bed_demand_forecast_7day_detailed": {
        "table_name": "fact_bed_demand_forecast_7day_detailed",
        "primary_key": "forecast_date,ward_id",
        "domain": "Clinical Operations & Bed Management",
        "description": "Detailed 7-day rolling bed demand and ward unit occupancy forecasts including predicted emergency/elective beds and occupancy rates.",
        "schema": [
            {"column_name": "forecast_date", "data_type": "DATE", "is_primary": True},
            {"column_name": "day_of_week", "data_type": "INT", "is_primary": False},
            {"column_name": "day_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "is_weekend", "data_type": "INT", "is_primary": False},
            {"column_name": "ward_id", "data_type": "INT", "is_primary": True},
            {"column_name": "ward_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "floor_number", "data_type": "INT", "is_primary": False},
            {"column_name": "department_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "predicted_beds", "data_type": "INT", "is_primary": False},
            {"column_name": "predicted_emergency", "data_type": "INT", "is_primary": False},
            {"column_name": "predicted_elective", "data_type": "INT", "is_primary": False},
            {"column_name": "avg_length_of_stay", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "prev_year_occupancy_rate", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "predicted_occupancy_rate", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "prediction_generated_at", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "model_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "model_source", "data_type": "STRING", "is_primary": False},
            {"column_name": "prediction_version", "data_type": "STRING", "is_primary": False}
        ]
    }
}


@router.get("/tables", summary="List Gold Schema Tables and Column Schemas")
def list_gold_tables():
    """Returns catalog, schema, table metadata, and definitions for Gold tables."""
    try:
        tables_list = []
        for t_name, meta in GOLD_TABLES_META.items():
            row_count = db_connector.get_row_count(t_name)
            if row_count == 0 and t_name in MOCK_GOLD_DATA:
                row_count = len(MOCK_GOLD_DATA[t_name])
            
            tables_list.append({
                "table_name": t_name,
                "catalog": Config.DATABRICKS_CATALOG,
                "schema": Config.DATABRICKS_SCHEMA,
                "primary_key": meta["primary_key"],
                "domain": meta["domain"],
                "description": meta["description"],
                "row_count": row_count,
                "column_count": len(meta["schema"])
            })

        return {
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": Config.DATABRICKS_SCHEMA,
            "count": len(tables_list),
            "tables": tables_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list Gold tables: {str(e)}")


@router.get("/summary", summary="Gold Schema Executive Analytics Overview")
def get_gold_executive_summary():
    """Computes executive KPIs across revenue predictions and 7-day bed demand forecasts."""
    try:
        rev_res = db_connector.query_gold_table("dim_revenue_predictions", limit=1000)
        bed_res = db_connector.query_gold_table("fact_bed_demand_forecast_7day_detailed", limit=1000)

        rev_data = rev_res.get("data", [])
        bed_data = bed_res.get("data", [])

        total_predicted_revenue = sum(float(r.get("predicted_revenue", 0) or 0) for r in rev_data)
        total_predicted_beds = sum(int(b.get("predicted_beds", 0) or 0) for b in bed_data)
        avg_occupancy = (sum(float(b.get("predicted_occupancy_rate", 0) or 0) for b in bed_data) / len(bed_data)) if bed_data else 0.0

        return {
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": Config.DATABRICKS_SCHEMA,
            "financial_kpis": {
                "total_predicted_revenue_usd": round(total_predicted_revenue, 2),
                "total_prediction_records": len(rev_data)
            },
            "bed_capacity_kpis": {
                "total_predicted_beds_demanded": total_predicted_beds,
                "avg_predicted_occupancy_rate_pct": round(avg_occupancy, 2),
                "total_forecast_records": len(bed_data)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate executive summary: {str(e)}")


# ---------------------------------------------------------------------------
# DIM_REVENUE_PREDICTIONS ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/revenue-predictions", summary="Query dim_revenue_predictions Table")
def get_dim_revenue_predictions(
    department_name: Optional[str] = Query(None, description="Filter by department_name"),
    bill_status: Optional[str] = Query(None, description="Filter by bill status (e.g. Settled, Pending)"),
    bill_date_from: Optional[str] = Query(None, description="Bill date starting on or after (YYYY-MM-DD)"),
    bill_date_to: Optional[str] = Query(None, description="Bill date starting on or before (YYYY-MM-DD)"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.gold.dim_revenue_predictions` table with optional parameters and pagination."""
    filters = {}
    if department_name: filters["department_name"] = department_name
    if bill_status: filters["bill_status"] = bill_status
    if bill_date_from: filters["bill_date_from"] = bill_date_from
    if bill_date_to: filters["bill_date_to"] = bill_date_to

    try:
        return db_connector.query_gold_table("dim_revenue_predictions", filters=filters, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query dim_revenue_predictions: {str(e)}")


@router.get("/revenue-predictions/summary", summary="Revenue Predictions Summary Analytics")
def get_revenue_predictions_summary():
    """Computes total predicted revenue, total net actual revenue, prediction variance, and model metrics."""
    try:
        res = db_connector.query_gold_table("dim_revenue_predictions", limit=1000)
        data = res.get("data", [])

        total_count = len(data)
        if total_count == 0:
            return {"notice": "No revenue prediction records found", "metrics": {}}

        total_predicted = sum(float(r.get("predicted_revenue", 0) or 0) for r in data)
        total_actual = sum(float(r.get("actual_net_amount", 0) or 0) for r in data)
        avg_variance = sum(float(r.get("prediction_variance", 0) or 0) for r in data) / total_count

        return {
            "table_name": "dim_revenue_predictions",
            "total_records": total_count,
            "total_predicted_revenue_usd": round(total_predicted, 2),
            "total_actual_net_amount_usd": round(total_actual, 2),
            "avg_prediction_variance_usd": round(avg_variance, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute revenue prediction summary: {str(e)}")


@router.get("/revenue-predictions/{prediction_id}", summary="Get Single Revenue Prediction Record")
def get_revenue_prediction_by_id(prediction_id: str):
    """Retrieve a single revenue prediction record by revenue_prediction_id or bill_number."""
    res = db_connector.query_gold_table("dim_revenue_predictions", filters={"revenue_prediction_id": prediction_id}, limit=1)
    data = res.get("data", [])
    if not data:
        res = db_connector.query_gold_table("dim_revenue_predictions", filters={"bill_number": prediction_id}, limit=1)
        data = res.get("data", [])
    if not data:
        raise HTTPException(status_code=404, detail=f"Revenue prediction record '{prediction_id}' not found.")
    return data[0]


# ---------------------------------------------------------------------------
# FACT_BED_DEMAND_FORECAST_7DAY_DETAILED ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/bed-demand-forecast/7day-trend", summary="7-Day Detailed Bed Demand Forecast List")
@router.get("/bed-demand-forecast", summary="Query fact_bed_demand_forecast_7day_detailed Detailed List")
def get_fact_bed_demand_forecast(
    ward_id: Optional[int] = Query(None, description="Filter by ward_id"),
    ward_name: Optional[str] = Query(None, description="Filter by ward_name (e.g. Diamond Suite Ward)"),
    department_name: Optional[str] = Query(None, description="Filter by department_name"),
    day_name: Optional[str] = Query(None, description="Filter by day name (e.g. Monday, Sunday)"),
    is_weekend: Optional[int] = Query(None, description="Filter weekend (1 or 0)"),
    forecast_date_from: Optional[str] = Query(None, description="Forecast date starting on or after (YYYY-MM-DD)"),
    forecast_date_to: Optional[str] = Query(None, description="Forecast date starting on or before (YYYY-MM-DD)"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Returns detailed records directly from `health_care.gold.fact_bed_demand_forecast_7day_detailed` table."""
    filters = {}
    if ward_id is not None: filters["ward_id"] = ward_id
    if ward_name: filters["ward_name"] = ward_name
    if department_name: filters["department_name"] = department_name
    if day_name: filters["day_name"] = day_name
    if is_weekend is not None: filters["is_weekend"] = is_weekend
    if forecast_date_from: filters["forecast_date_from"] = forecast_date_from
    if forecast_date_to: filters["forecast_date_to"] = forecast_date_to

    try:
        return db_connector.query_gold_table("fact_bed_demand_forecast_7day_detailed", filters=filters, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query fact_bed_demand_forecast_7day_detailed: {str(e)}")


@router.get("/bed-demand-forecast/summary", summary="Bed Demand Forecast Analytics Summary")
def get_bed_demand_forecast_summary():
    """Computes total predicted beds, emergency vs elective breakdown, and average occupancy rate."""
    try:
        res = db_connector.query_gold_table("fact_bed_demand_forecast_7day_detailed", limit=1000)
        data = res.get("data", [])

        total_count = len(data)
        if total_count == 0:
            return {"notice": "No bed demand forecast records found", "metrics": {}}

        total_predicted = sum(int(b.get("predicted_beds", 0) or 0) for b in data)
        total_emergency = sum(int(b.get("predicted_emergency", 0) or 0) for b in data)
        total_elective = sum(int(b.get("predicted_elective", 0) or 0) for b in data)
        avg_occupancy = sum(float(b.get("predicted_occupancy_rate", 0) or 0) for b in data) / total_count

        return {
            "table_name": "fact_bed_demand_forecast_7day_detailed",
            "total_records": total_count,
            "metrics": {
                "total_predicted_beds": total_predicted,
                "total_predicted_emergency_beds": total_emergency,
                "total_predicted_elective_beds": total_elective,
                "avg_predicted_occupancy_rate_pct": round(avg_occupancy, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute bed demand forecast summary: {str(e)}")


# ---------------------------------------------------------------------------
# DYNAMIC GOLD TABLE QUERY ENDPOINT
# ---------------------------------------------------------------------------
@router.get("/table/{table_name}", summary="Dynamic Query Endpoint for Gold Tables")
def query_dynamic_gold_table(
    table_name: str,
    limit: int = Query(default=50, ge=1, le=1000),
    offset: int = Query(default=0, ge=0)
):
    """Dynamic pagination and retrieval for Gold tables."""
    valid_tables = ["dim_revenue_predictions", "fact_bed_demand_forecast_7day_detailed"]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' is not supported. Valid Gold tables: {valid_tables}")

    try:
        return db_connector.query_gold_table(table_name, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query Gold table '{table_name}': {str(e)}")
