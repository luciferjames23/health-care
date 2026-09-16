from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import psycopg2
import psycopg2.extras
from connectors.databricks_connector import DatabricksConnector
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
        "description": "AI-generated clinical discharge summaries containing diagnoses, case history, investigations, treatment, primary consultant, discharge advice, surgery details, patient condition, and approval workflow status.",
        "schema": [
            {"column_name": "summary_id", "data_type": "BIGINT", "is_primary": True},
            {"column_name": "admission_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "patient_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "doctor_id", "data_type": "BIGINT", "is_primary": False},
            {"column_name": "admission_date", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "discharge_date", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "diagnoses", "data_type": "STRING", "is_primary": False},
            {"column_name": "case_history", "data_type": "STRING", "is_primary": False},
            {"column_name": "investigations", "data_type": "STRING", "is_primary": False},
            {"column_name": "treatment", "data_type": "STRING", "is_primary": False},
            {"column_name": "primary_consultant", "data_type": "STRING", "is_primary": False},
            {"column_name": "discharge_advice", "data_type": "STRING", "is_primary": False},
            {"column_name": "surgery_details", "data_type": "STRING", "is_primary": False},
            {"column_name": "patient_condition", "data_type": "STRING", "is_primary": False},
            {"column_name": "generated_at", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "ingestion_timestamp", "data_type": "TIMESTAMP", "is_primary": False},
            {"column_name": "approval_status", "data_type": "STRING", "is_primary": False}
        ]
    },
    "patients": {
        "table_name": "patients",
        "primary_key": "patient_id",
        "domain": "Front Office & Master Index",
        "description": "Enterprise Patient Master Index (EMPI) containing demographics, contact information, National ID, and registration history.",
        "schema": [
            {"column_name": "patient_id", "data_type": "BIGINT", "is_primary": True, "description": "Unique Master Patient Index identifier"},
            {"column_name": "patient_number", "data_type": "STRING", "is_primary": False, "description": "Hospital UHID tracking number"},
            {"column_name": "first_name", "data_type": "STRING", "is_primary": False, "description": "Patient legal first name"},
            {"column_name": "last_name", "data_type": "STRING", "is_primary": False, "description": "Patient legal surname"},
            {"column_name": "gender", "data_type": "STRING", "is_primary": False, "description": "Biological sex / gender identity"},
            {"column_name": "date_of_birth", "data_type": "DATE", "is_primary": False, "description": "Date of birth (YYYY-MM-DD)"},
            {"column_name": "blood_group", "data_type": "STRING", "is_primary": False, "description": "ABO and Rh blood group classification"},
            {"column_name": "phone", "data_type": "STRING", "is_primary": False, "description": "Primary verified contact telephone number"},
            {"column_name": "email", "data_type": "STRING", "is_primary": False, "description": "Primary electronic notification address"},
            {"column_name": "city", "data_type": "STRING", "is_primary": False, "description": "Residential municipality/city"},
            {"column_name": "emergency_contact_name", "data_type": "STRING", "is_primary": False, "description": "Designated emergency guardian or relative"},
            {"column_name": "created_at", "data_type": "TIMESTAMP", "is_primary": False, "description": "EMPI record creation timestamp"}
        ]
    },
    "admissions": {
        "table_name": "admissions",
        "primary_key": "admission_id",
        "domain": "Clinical Operations & Inpatient",
        "description": "Hospital admission encounters, active inpatient stays, attending doctor assignments, and discharge disposition status.",
        "schema": [
            {"column_name": "admission_id", "data_type": "BIGINT", "is_primary": True, "description": "Unique inpatient encounter identifier"},
            {"column_name": "patient_id", "data_type": "BIGINT", "is_primary": False, "description": "Foreign key to patients table"},
            {"column_name": "admission_number", "data_type": "STRING", "is_primary": False, "description": "Encounter tracking registration code"},
            {"column_name": "admission_date", "data_type": "TIMESTAMP", "is_primary": False, "description": "Date and time of inpatient bed booking"},
            {"column_name": "admission_type", "data_type": "STRING", "is_primary": False, "description": "Elective, Emergency, or Transfer encounter"},
            {"column_name": "discharge_status", "data_type": "STRING", "is_primary": False, "description": "Admitted, Ready for Discharge, or Discharged"},
            {"column_name": "primary_diagnosis", "data_type": "STRING", "is_primary": False, "description": "Definitive ICD admission diagnosis description"},
            {"column_name": "secondary_diagnoses", "data_type": "STRING", "is_primary": False, "description": "Secondary clinical diagnoses and comorbidities"},
            {"column_name": "doctor_id", "data_type": "BIGINT", "is_primary": False, "description": "Primary attending physician staff ID"},
            {"column_name": "bed_id", "data_type": "BIGINT", "is_primary": False, "description": "Assigned hospital bed location identifier"},
            {"column_name": "length_of_stay_days", "data_type": "INT", "is_primary": False, "description": "Elapsed or finalized duration of hospitalization"}
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


@router.get("/schema/{table_name}", summary="Get Table Schema and Column Definitions")
def get_gold_table_schema(table_name: str):
    """Returns columns, types, primary keys, and description for a Gold table."""
    meta = GOLD_TABLES_META.get(table_name)
    if not meta:
        for k, v in GOLD_TABLES_META.items():
            if k.lower() == table_name.lower() or k.lower() == f"dim_{table_name.lower()}" or k.lower() == f"fact_{table_name.lower()}":
                meta = v
                table_name = k
                break
                
    if not meta:
        return {
            "table_name": table_name,
            "catalog": Config.DATABRICKS_CATALOG,
            "schema": Config.DATABRICKS_SCHEMA,
            "columns": [
                {"column_name": "id", "data_type": "BIGINT", "is_primary": True, "description": "Primary unique record identifier"},
                {"column_name": "name", "data_type": "STRING", "is_primary": False, "description": "Name / descriptor"},
                {"column_name": "status", "data_type": "STRING", "is_primary": False, "description": "Lifecycle status"},
                {"column_name": "created_at", "data_type": "TIMESTAMP", "is_primary": False, "description": "Creation timestamp"}
            ]
        }

    row_count = db_connector.get_row_count(table_name)
    return {
        "table_name": table_name,
        "catalog": Config.DATABRICKS_CATALOG,
        "schema": Config.DATABRICKS_SCHEMA,
        "primary_key": meta.get("primary_key"),
        "domain": meta.get("domain"),
        "description": meta.get("description"),
        "row_count": row_count,
        "columns": meta.get("schema", [])
    }


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
        res = db_connector.query_gold_table("dim_generated_discharge_summaries", filters=filters, limit=limit, offset=offset)
        # Automatically extract patient_name and primary_consultant if missing
        import re
        for row in res.get("data", []):
            if not row.get("patient_name") and row.get("case_history"):
                m = re.search(r'The patient(?:,\s*|\s+)([A-Z][a-zA-Z\s]+?)(?:,|\s+a|\s+an|\s+was|\s+is|\s+aged|\s+\d)', row["case_history"])
                if m:
                    row["patient_name"] = m.group(1).strip()
            if not row.get("primary_consultant") and row.get("doctor_name"):
                row["primary_consultant"] = row.get("doctor_name")
        return res
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
    import re
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
    
    rec = data[0]
    if not rec.get("patient_name") and rec.get("case_history"):
        m = re.search(r'The patient(?:,\s*|\s+)([A-Z][a-zA-Z\s]+?)(?:,|\s+a|\s+an|\s+was|\s+is|\s+aged|\s+\d)', rec["case_history"])
        if m:
            rec["patient_name"] = m.group(1).strip()
    return rec


class DischargeSummaryUpdateRequest(BaseModel):
    approval_status: Optional[str] = Field(None, description="Approval status: Approved, Pending Approval, Rejected, Under Revision, Signed, etc.")
    approved_by: Optional[str] = Field(None, description="Approving physician/reviewer name")
    hospital_course_summary: Optional[str] = Field(None, description="Updated hospital course summary narrative")
    discharge_diagnosis: Optional[str] = Field(None, description="Updated primary/final discharge diagnosis")
    discharge_medications: Optional[str] = Field(None, description="Updated medications list with dosages and frequencies")
    followup_instructions: Optional[str] = Field(None, description="Updated follow-up instructions and precautions")
    attending_physician: Optional[str] = Field(None, description="Updated attending physician name")
    admission_reason: Optional[str] = Field(None, description="Updated chief complaint or admission reason")
    investigations: Optional[str] = Field(None, description="Updated clinical investigations and laboratory findings")
    patient_condition: Optional[str] = Field(None, description="Updated patient condition at discharge")
    discharge_date: Optional[str] = Field(None, description="Updated discharge date timestamp")
    llm_generated_summary_text: Optional[str] = Field(None, description="Full formatted discharge summary document")
    model_name: Optional[str] = Field(None, description="Model identifier")
    patient_name: Optional[str] = Field(None, description="Patient name")


@router.put("/generated-discharge-summaries/{summary_id}", summary="Edit Content & Approval Status in dim_generated_discharge_summaries")
@router.patch("/generated-discharge-summaries/{summary_id}", summary="Edit Content & Approval Status in dim_generated_discharge_summaries (Partial)")
def update_dim_generated_discharge_summary(
    summary_id: str,
    payload: DischargeSummaryUpdateRequest
):
    """
    Updates content fields (course summary, diagnosis, medications, follow-up instructions)
    and governance status (`approval_status`, `approved_by`) in `health_care.gold.dim_generated_discharge_summaries`.
    Lookup matches `summary_id`, `patient_id`, `patient_number`, or `admission_id`.
    """
    id_str = str(summary_id).strip()
    if not id_str:
        raise HTTPException(status_code=400, detail="Discharge summary identifier is required.")

    # 1. Locate record using strict priority matching
    res = db_connector.query_gold_table("dim_generated_discharge_summaries", limit=1000)
    data = res.get("data", [])
    matched = None

    # Priority 1: Exact summary_id match (e.g. "DS-87224") or "DS-{id}"
    for row in data:
        sid = str(row.get("summary_id", "")).strip().lower()
        if sid == id_str.lower() or sid == f"ds-{id_str}".lower():
            matched = row
            break

    # Priority 2: Exact patient_id match (e.g. 87224)
    if not matched:
        for row in data:
            if str(row.get("patient_id", "")).strip() == id_str:
                matched = row
                break

    # Priority 3: Exact patient_number match (e.g. "MER-PAT-0087224")
    if not matched:
        for row in data:
            if str(row.get("patient_number", "")).strip().lower() == id_str.lower():
                matched = row
                break

    # Priority 4: Exact admission_id match (e.g. "ADM-87224")
    if not matched:
        for row in data:
            if str(row.get("admission_id", "")).strip().lower() == id_str.lower():
                matched = row
                break

    if not matched:
        raise HTTPException(
            status_code=404,
            detail=f"Discharge summary '{id_str}' not found in health_care.gold.dim_generated_discharge_summaries."
        )

    actual_sid = matched.get("summary_id")
    update_dict = {k: v for k, v in payload.dict().items() if v is not None}

    if not update_dict:
        return {
            "status": "no_change",
            "message": "No fields provided to update.",
            "summary_id": actual_sid,
            "data": matched
        }

    try:
        upd_res = db_connector.update_record(
            table_name="dim_generated_discharge_summaries",
            key_field="summary_id",
            key_value=actual_sid,
            updates=update_dict
        )
        return {
            "status": "success",
            "message": f"Discharge summary '{actual_sid}' successfully updated in gold.dim_generated_discharge_summaries.",
            "summary_id": actual_sid,
            "patient_id": matched.get("patient_id"),
            "patient_name": matched.get("patient_name"),
            "updated_fields": list(update_dict.keys()),
            "data": upd_res.get("data") or {**matched, **update_dict}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update discharge summary: {str(e)}")



# ---------------------------------------------------------------------------
# COMBINED BED MANAGEMENT ENDPOINT (Ward -> Room -> Bed -> Patient)
# ---------------------------------------------------------------------------
@router.get("/bed-management", summary="Combined Ward, Room, Bed and Patient Hierarchy")
def get_bed_management_data(
    ward_id: Optional[int] = Query(None, description="Filter by ward_id"),
    occupancy_status: Optional[str] = Query(None, description="Filter by occupancy_status (Occupied, Available, Maintenance, Blocked)")
):
    """Provides combined hierarchical data connecting Wards -> Rooms -> Beds -> Assigned Patient dynamically from PostgreSQL."""
    try:
        conn = db_connector.get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute("SELECT ward_id, ward_name, department_id, ward_type, floor_number, status FROM wards ORDER BY ward_id;")
        wards_data = cur.fetchall()

        cur.execute("SELECT room_id, room_number, ward_id, room_type, daily_charge, status FROM rooms ORDER BY room_id;")
        rooms_data = cur.fetchall()

        cur.execute("SELECT bed_id, bed_number, room_id, ward_id, bed_type, daily_charge, status FROM beds ORDER BY bed_id;")
        beds_data = cur.fetchall()

        cur.execute("SELECT summary_id, admission_id, patient_id, approval_status, discharge_date, diagnoses, primary_consultant FROM dim_generated_discharge_summaries;")
        ds_data = cur.fetchall()

        cur.execute("""
            SELECT 
                a.admission_id, a.admission_number, a.patient_id, a.bed_id, a.admission_date,
                COALESCE(d.first_name || ' ' || d.last_name, 'Patient #' || a.patient_id) as patient_name,
                COALESCE(d.attending_doctor, 'Doctor #' || a.doctor_id) as attending_doctor,
                COALESCE(d.primary_diagnosis, a.reason_for_admission) as primary_diagnosis
            FROM admissions a
            LEFT JOIN dim_admission_inputs d ON a.admission_id = d.admission_id
            WHERE a.discharge_status = 'Admitted';
        """)
        admissions_data = cur.fetchall()

        cur.close()
        conn.close()

        # Discharged set - Discharge summary table is source of truth
        discharged_ids = {str(r["patient_id"]).strip() for r in ds_data if r.get("patient_id") is not None}
        discharged_adm_ids = {str(r["admission_id"]).strip() for r in ds_data if r.get("admission_id")}

        # Build active bed -> patient map (excluding discharged patients)
        bed_patient_map = {}
        for a in admissions_data:
            pid = str(a.get("patient_id")).strip() if a.get("patient_id") else None
            aid = str(a.get("admission_id")).strip() if a.get("admission_id") else None
            if (pid and pid in discharged_ids) or (aid and aid in discharged_adm_ids):
                continue
            bid = a.get("bed_id")
            if bid:
                bed_patient_map[bid] = {
                    "patient_id": a.get("patient_id"),
                    "admission_id": a.get("admission_id"),
                    "admission_number": a.get("admission_number"),
                    "patient_name": a.get("patient_name"),
                    "attending_doctor": a.get("attending_doctor"),
                    "primary_diagnosis": a.get("primary_diagnosis"),
                    "admission_date": a.get("admission_date").isoformat() if a.get("admission_date") else None
                }

        occupied_count = 0
        available_count = 0
        maintenance_count = 0

        beds_by_room = {}
        for b in beds_data:
            bid = b.get("bed_id")
            rid = b.get("room_id")
            wid = b.get("ward_id")
            assigned = bed_patient_map.get(bid)

            raw_status = str(b.get("status") or "").strip().lower()
            is_maint = raw_status in ["maintenance", "blocked", "cleaning", "reserved"]

            if assigned:
                bed_status = "Occupied"
                occupied_count += 1
            elif is_maint:
                bed_status = "Maintenance"
                maintenance_count += 1
            else:
                bed_status = "Available"
                available_count += 1

            if occupancy_status and bed_status.lower() != occupancy_status.lower():
                continue

            bed_obj = {
                "bed_id": bid,
                "bed_number": b.get("bed_number"),
                "room_id": rid,
                "ward_id": wid,
                "bed_type": b.get("bed_type"),
                "daily_charge": float(b.get("daily_charge")) if b.get("daily_charge") else 0.0,
                "status": bed_status,
                "is_occupied": bed_status == "Occupied",
                "assigned_patient": assigned
            }
            beds_by_room.setdefault(rid, []).append(bed_obj)

        # Organize rooms by ward_id
        rooms_by_ward = {}
        for rm in rooms_data:
            r_id = rm.get("room_id")
            w_id = rm.get("ward_id")
            rm_beds = beds_by_room.get(r_id, [])

            room_obj = {
                "room_id": r_id,
                "room_number": rm.get("room_number"),
                "ward_id": w_id,
                "room_type": rm.get("room_type"),
                "capacity": rm.get("capacity", len(rm_beds)),
                "daily_charge": float(rm.get("daily_charge")) if rm.get("daily_charge") else 0.0,
                "status": rm.get("status", "Available"),
                "beds_count": len(rm_beds),
                "occupied_count": sum(1 for b in rm_beds if b["is_occupied"]),
                "beds": rm_beds
            }
            rooms_by_ward.setdefault(w_id, []).append(room_obj)

        # Build Ward hierarchy
        ward_tree = []
        for w in wards_data:
            w_id = w.get("ward_id")
            if ward_id is not None and w_id != ward_id:
                continue

            w_rooms = rooms_by_ward.get(w_id, [])
            total_ward_beds = sum(r["beds_count"] for r in w_rooms)
            occupied_ward_beds = sum(r["occupied_count"] for r in w_rooms)

            ward_tree.append({
                "ward_id": w_id,
                "ward_name": w.get("ward_name"),
                "department_id": w.get("department_id"),
                "ward_type": w.get("ward_type"),
                "floor_number": w.get("floor_number"),
                "status": w.get("status", "Active"),
                "rooms_count": len(w_rooms),
                "total_beds": total_ward_beds,
                "occupied_beds": occupied_ward_beds,
                "available_beds": max(0, total_ward_beds - occupied_ward_beds),
                "occupancy_rate": round(occupied_ward_beds / total_ward_beds * 100, 1) if total_ward_beds else 0.0,
                "rooms": w_rooms
            })

        total_beds = len(beds_data)
        return {
            "catalog": Config.POSTGRES_DB,
            "schema": "public",
            "kpis": {
                "total_wards": len(wards_data),
                "total_rooms": len(rooms_data),
                "total_beds": total_beds,
                "occupied_beds": occupied_count,
                "available_beds": available_count,
                "maintenance_beds": maintenance_count,
                "occupancy_rate": round(occupied_count / total_beds * 100, 1) if total_beds else 0.0
            },
            "wards": ward_tree
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate bed management hierarchy: {str(e)}")


@router.get("/table/{table_name}", summary="Dynamic Query Endpoint for Tables")
def query_dynamic_gold_table(
    table_name: str,
    limit: Optional[int] = Query(None, ge=1, description="Max records to return. Omit to fetch full data."),
    offset: int = Query(default=0, ge=0)
):
    """Dynamic pagination and retrieval for PostgreSQL tables."""
    try:
        return db_connector.query_gold_table(table_name, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query table '{table_name}': {str(e)}")



