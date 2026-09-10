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
    },
    "dim_admission_inputs": {
        "table_name": "dim_admission_inputs",
        "primary_key": "admission_id",
        "domain": "LLM & Clinical AI Analytics",
        "description": "Patient admission details, clinical vital/lab summaries, and formatted prompt context prepped for LLM inference and clinical risk modeling.",
        "schema": [
            {"column_name": "admission_id", "data_type": "STRING", "is_primary": True},
            {"column_name": "patient_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "patient_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "patient_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "age", "data_type": "INT", "is_primary": False},
            {"column_name": "gender", "data_type": "STRING", "is_primary": False},
            {"column_name": "admission_date", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "admission_type", "data_type": "STRING", "is_primary": False},
            {"column_name": "chief_complaint", "data_type": "STRING", "is_primary": False},
            {"column_name": "primary_diagnosis", "data_type": "STRING", "is_primary": False},
            {"column_name": "secondary_diagnoses", "data_type": "STRING", "is_primary": False},
            {"column_name": "vital_signs_summary", "data_type": "STRING", "is_primary": False},
            {"column_name": "lab_results_summary", "data_type": "STRING", "is_primary": False},
            {"column_name": "clinical_notes_text", "data_type": "STRING", "is_primary": False},
            {"column_name": "llm_prompt_context", "data_type": "STRING", "is_primary": False},
            {"column_name": "risk_score", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "predicted_length_of_stay", "data_type": "DOUBLE", "is_primary": False},
            {"column_name": "admission_status", "data_type": "STRING", "is_primary": False},
            {"column_name": "created_at", "data_type": "TIMESTAMP", "is_primary": False}
        ]
    },
    "dim_generated_discharge_summaries": {
        "table_name": "dim_generated_discharge_summaries",
        "primary_key": "summary_id",
        "domain": "LLM & Clinical AI Analytics",
        "description": "AI-generated clinical discharge summaries, hospital course summaries, discharge medications, follow-up instructions, and physician approval workflow statuses.",
        "schema": [
            {"column_name": "summary_id", "data_type": "STRING", "is_primary": True},
            {"column_name": "admission_id", "data_type": "STRING", "is_primary": False},
            {"column_name": "patient_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "patient_number", "data_type": "STRING", "is_primary": False},
            {"column_name": "patient_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "attending_physician", "data_type": "STRING", "is_primary": False},
            {"column_name": "discharge_date", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "admission_reason", "data_type": "STRING", "is_primary": False},
            {"column_name": "discharge_diagnosis", "data_type": "STRING", "is_primary": False},
            {"column_name": "hospital_course_summary", "data_type": "STRING", "is_primary": False},
            {"column_name": "discharge_medications", "data_type": "STRING", "is_primary": False},
            {"column_name": "followup_instructions", "data_type": "STRING", "is_primary": False},
            {"column_name": "llm_generated_summary_text", "data_type": "STRING", "is_primary": False},
            {"column_name": "model_name", "data_type": "STRING", "is_primary": False},
            {"column_name": "approval_status", "data_type": "STRING", "is_primary": False},
            {"column_name": "approved_by", "data_type": "STRING", "is_primary": False},
            {"column_name": "created_at", "data_type": "TIMESTAMP", "is_primary": False}
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

        total_capacity = 0
        for b in bed_data:
            occ_rate = float(b.get("predicted_occupancy_rate", 0) or 0)
            p_beds = int(b.get("predicted_beds", 0) or 0)
            if occ_rate > 0:
                total_capacity += int(round(p_beds / (occ_rate / 100.0)))
            else:
                total_capacity += p_beds
        total_capacity = max(total_capacity, total_predicted_beds)
        available_beds = max(0, total_capacity - total_predicted_beds)

        return {
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": Config.DATABRICKS_SCHEMA,
            "financial_kpis": {
                "total_predicted_revenue_usd": round(total_predicted_revenue, 2),
                "total_prediction_records": len(rev_data)
            },
            "bed_capacity_kpis": {
                "total_beds_capacity": total_capacity,
                "occupied_beds_count": total_predicted_beds,
                "available_beds_count": available_beds,
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
    limit: Optional[int] = Query(None, ge=1, description="Max records to return. Omit to fetch full data."),
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
    limit: Optional[int] = Query(None, ge=1, description="Max records to return. Omit to fetch full data."),
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
    """Computes total predicted beds, emergency vs elective breakdown, available vs occupied bed counts, and average occupancy rate."""
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

        total_capacity = 0
        for b in data:
            occ_rate = float(b.get("predicted_occupancy_rate", 0) or 0)
            p_beds = int(b.get("predicted_beds", 0) or 0)
            if occ_rate > 0:
                total_capacity += int(round(p_beds / (occ_rate / 100.0)))
            else:
                total_capacity += p_beds
        total_capacity = max(total_capacity, total_predicted)
        available_beds = max(0, total_capacity - total_predicted)

        return {
            "table_name": "fact_bed_demand_forecast_7day_detailed",
            "total_records": total_count,
            "metrics": {
                "total_beds_capacity": total_capacity,
                "occupied_beds_count": total_predicted,
                "available_beds_count": available_beds,
                "total_predicted_beds": total_predicted,
                "total_predicted_emergency_beds": total_emergency,
                "total_predicted_elective_beds": total_elective,
                "avg_predicted_occupancy_rate_pct": round(avg_occupancy, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute bed demand forecast summary: {str(e)}")


# ---------------------------------------------------------------------------
# dim_admission_inputs ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/current-admission-llm-inputs", summary="Query dim_admission_inputs Table")
def get_dim_admission_inputs(
    patient_id: Optional[int] = Query(None, description="Filter by patient_id"),
    patient_number: Optional[str] = Query(None, description="Filter by patient_number (e.g. PAT-10892)"),
    admission_type: Optional[str] = Query(None, description="Filter by admission type (Emergency, Urgent, Elective)"),
    admission_status: Optional[str] = Query(None, description="Filter by status (Admitted, In Progress, Discharged)"),
    gender: Optional[str] = Query(None, description="Filter by gender (M, F, Other)"),
    admission_date_from: Optional[str] = Query(None, description="Admission date starting on or after (YYYY-MM-DD)"),
    admission_date_to: Optional[str] = Query(None, description="Admission date starting on or before (YYYY-MM-DD)"),
    risk_score_gt: Optional[float] = Query(None, description="Filter risk score greater than or equal to threshold"),
    limit: Optional[int] = Query(None, ge=1, description="Max records to return. Omit to fetch full data."),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.gold.dim_admission_inputs` table with optional filters and pagination."""
    filters = {}
    if patient_id is not None: filters["patient_id"] = patient_id
    if patient_number: filters["patient_number"] = patient_number
    if admission_type: filters["admission_type"] = admission_type
    if admission_status: filters["admission_status"] = admission_status
    if gender: filters["gender"] = gender
    if admission_date_from: filters["admission_date_from"] = admission_date_from
    if admission_date_to: filters["admission_date_to"] = admission_date_to
    if risk_score_gt is not None: filters["risk_score_gt"] = risk_score_gt

    try:
        return db_connector.query_gold_table("dim_admission_inputs", filters=filters, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query dim_admission_inputs: {str(e)}")


@router.get("/current-admission-llm-inputs/summary", summary="Current Admission LLM Inputs Summary Analytics")
def get_dim_admission_inputs_summary():
    """Computes summary metrics for LLM admission inputs including total records, average risk, and status breakdown."""
    try:
        res = db_connector.query_gold_table("dim_admission_inputs", limit=1000)
        data = res.get("data", [])

        total_count = len(data)
        if total_count == 0:
            return {"notice": "No current admission LLM input records found", "metrics": {}}

        avg_risk = sum(float(r.get("risk_score", 0) or 0) for r in data) / total_count
        avg_los = sum(float(r.get("predicted_length_of_stay", 0) or 0) for r in data) / total_count

        admission_types = {}
        for r in data:
            t = r.get("admission_type", "Unknown")
            admission_types[t] = admission_types.get(t, 0) + 1

        admission_statuses = {}
        for r in data:
            s = r.get("admission_status", "Unknown")
            admission_statuses[s] = admission_statuses.get(s, 0) + 1

        return {
            "table_name": "dim_admission_inputs",
            "total_records": total_count,
            "metrics": {
                "avg_risk_score": round(avg_risk, 3),
                "avg_predicted_length_of_stay_days": round(avg_los, 2),
                "admission_type_breakdown": admission_types,
                "admission_status_breakdown": admission_statuses
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute admission LLM inputs summary: {str(e)}")


@router.get("/current-admission-llm-inputs/{admission_id}", summary="Get Single Current Admission LLM Record")
def get_current_admission_llm_input_by_id(admission_id: str):
    """Retrieve a single admission LLM input record by admission_id or patient_number."""
    res = db_connector.query_gold_table("dim_admission_inputs", filters={"admission_id": admission_id}, limit=1)
    data = res.get("data", [])
    if not data:
        res = db_connector.query_gold_table("dim_admission_inputs", filters={"patient_number": admission_id}, limit=1)
        data = res.get("data", [])
    if not data:
        raise HTTPException(status_code=404, detail=f"Admission LLM record '{admission_id}' not found.")
    return data[0]


# ---------------------------------------------------------------------------
# dim_generated_discharge_summaries ENDPOINTS
# ---------------------------------------------------------------------------
@router.get("/generated-discharge-summaries", summary="Query dim_generated_discharge_summaries Table")
def get_dim_generated_discharge_summaries(
    patient_id: Optional[int] = Query(None, description="Filter by patient_id"),
    patient_number: Optional[str] = Query(None, description="Filter by patient_number (e.g. PAT-10892)"),
    admission_id: Optional[str] = Query(None, description="Filter by admission_id (e.g. ADM-2026-001)"),
    approval_status: Optional[str] = Query(None, description="Filter by approval status (Approved, Pending Review, Revised)"),
    attending_physician: Optional[str] = Query(None, description="Filter by attending physician name"),
    model_name: Optional[str] = Query(None, description="Filter by LLM model name (e.g. med-lm-v2, gpt-4o)"),
    discharge_date_from: Optional[str] = Query(None, description="Discharge date starting on or after (YYYY-MM-DD)"),
    discharge_date_to: Optional[str] = Query(None, description="Discharge date starting on or before (YYYY-MM-DD)"),
    limit: Optional[int] = Query(None, ge=1, description="Max records to return. Omit to fetch full data."),
    offset: int = Query(default=0, ge=0)
):
    """Query `health_care.gold.dim_generated_discharge_summaries` table with optional filters and pagination."""
    filters = {}
    if patient_id is not None: filters["patient_id"] = patient_id
    if patient_number: filters["patient_number"] = patient_number
    if admission_id: filters["admission_id"] = admission_id
    if approval_status: filters["approval_status"] = approval_status
    if attending_physician: filters["attending_physician"] = attending_physician
    if model_name: filters["model_name"] = model_name
    if discharge_date_from: filters["discharge_date_from"] = discharge_date_from
    if discharge_date_to: filters["discharge_date_to"] = discharge_date_to

    try:
        return db_connector.query_gold_table("dim_generated_discharge_summaries", filters=filters, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query dim_generated_discharge_summaries: {str(e)}")


@router.get("/generated-discharge-summaries/summary", summary="Generated Discharge Summaries Analytics Summary")
def get_dim_generated_discharge_summaries_summary():
    """Computes summary metrics for generated discharge summaries including status breakdown and LLM model stats."""
    try:
        res = db_connector.query_gold_table("dim_generated_discharge_summaries", limit=1000)
        data = res.get("data", [])

        total_count = len(data)
        if total_count == 0:
            return {"notice": "No generated discharge summary records found", "metrics": {}}

        status_counts = {}
        for r in data:
            st = r.get("approval_status", "Unknown")
            status_counts[st] = status_counts.get(st, 0) + 1

        model_counts = {}
        for r in data:
            m = r.get("model_name", "Unknown")
            model_counts[m] = model_counts.get(m, 0) + 1

        return {
            "table_name": "dim_generated_discharge_summaries",
            "total_records": total_count,
            "metrics": {
                "approval_status_breakdown": status_counts,
                "llm_model_usage": model_counts,
                "approved_count": status_counts.get("Approved", 0),
                "pending_review_count": status_counts.get("Pending Review", 0)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute discharge summaries analytics: {str(e)}")


@router.get("/generated-discharge-summaries/{summary_id}", summary="Get Single Discharge Summary Record")
def get_generated_discharge_summary_by_id(summary_id: str):
    """Retrieve a single discharge summary record by summary_id, admission_id, or patient_number."""
    res = db_connector.query_gold_table("dim_generated_discharge_summaries", filters={"summary_id": summary_id}, limit=1)
    data = res.get("data", [])
    if not data:
        res = db_connector.query_gold_table("dim_generated_discharge_summaries", filters={"admission_id": summary_id}, limit=1)
        data = res.get("data", [])
    if not data:
        res = db_connector.query_gold_table("dim_generated_discharge_summaries", filters={"patient_number": summary_id}, limit=1)
        data = res.get("data", [])
    if not data:
        raise HTTPException(status_code=404, detail=f"Discharge summary record '{summary_id}' not found.")
    return data[0]


# ---------------------------------------------------------------------------
# DYNAMIC GOLD TABLE QUERY ENDPOINT
# ---------------------------------------------------------------------------
@router.get("/table/{table_name}", summary="Dynamic Query Endpoint for Gold Tables")
def query_dynamic_gold_table(
    table_name: str,
    limit: Optional[int] = Query(None, ge=1, description="Max records to return. Omit to fetch full data."),
    offset: int = Query(default=0, ge=0)
):
    """Dynamic pagination and retrieval for Gold tables."""
    valid_tables = ["dim_revenue_predictions", "fact_bed_demand_forecast_7day_detailed", "dim_admission_inputs", "dim_generated_discharge_summaries"]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' is not supported. Valid Gold tables: {valid_tables}")

    try:
        return db_connector.query_gold_table(table_name, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query Gold table '{table_name}': {str(e)}")


