import datetime
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from connectors.databricks_connector import DatabricksConnector
from services.discharge_generator import (
    generate_and_persist_discharge_summaries,
    generate_patient_discharge_summary
)

router = APIRouter(
    prefix="/api/v1/discharge-summary-llm",
    tags=["Discharge Summary LLM Generation (Llama 3.3 70B)"]
)

db_connector = DatabricksConnector()

DEFAULT_MODEL = "databricks-meta-llama-3-3-70b-instruct"


class DischargeSummaryLLMRequest(BaseModel):
    patient_id: Optional[str] = "all"  # Comma-separated (e.g. "87224,87225" or "2,3,4,5,6") or "all"
    model_name: Optional[str] = DEFAULT_MODEL
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 2000
    save_to_gold: Optional[bool] = True


@router.post("/generate", summary="Generate Discharge Summaries with LLM (Llama 3.3 70B) - POST")
def generate_discharge_summary_llm_post(request: DischargeSummaryLLMRequest):
    """
    Executes the Discharge Summary Generation workflow:
    1. Resolves `patient_id` (e.g. comma-separated '87224,87225' or 'all' for all admitted patients).
    2. Retrieves patient clinical input from `health_care.gold.dim_admission_inputs` (with silver/bronze fallback).
    3. Generates all 8 structured clinical fields:
       - diagnoses (ICD codes + descriptions)
       - case_history (clinical presentation, stay course)
       - investigations (labs, SpO2, heart rate, BP, ECG/radiology)
       - treatment (medications with exact dosage & volume, IV fluids)
       - primary_consultant (attending doctor with credentials)
       - discharge_advice (medication regimen, red flags, OPD review, and Tamil instructions)
       - surgery_details (procedure notes or 'Nil')
       - patient_condition (hemodynamic stability, clinical status)
       - llm_generated_summary_text (full multi-section formatted discharge document)
    4. Automatically persists generated output into `health_care.gold.dim_generated_discharge_summaries`.
    5. Returns the complete generated dataset with execution metadata.
    """
    pid_param = str(request.patient_id or "all").strip()
    if not pid_param:
        pid_param = "all"

    try:
        res = generate_and_persist_discharge_summaries(pid_param)
        return {
            "status": "success",
            "model": request.model_name or DEFAULT_MODEL,
            "temperature": request.temperature or 0.3,
            "max_tokens": request.max_tokens or 2000,
            "patient_ids_requested": pid_param,
            "patient_ids_executed": res.get("patient_ids_executed"),
            "total_generated": res.get("total_processed", 0),
            "target_table": "health_care.gold.dim_generated_discharge_summaries",
            "data": res.get("data", []),
            "first_summary": res.get("first_summary"),
            "timestamp": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")


@router.get("/generate", summary="Generate Discharge Summaries with LLM (Llama 3.3 70B) - GET")
def generate_discharge_summary_llm_get(
    patient_id: str = Query(
        default="all",
        description="Comma-separated patient IDs (e.g. '87224,87225' or '2,3,4,5,6') or 'all'"
    ),
    model_name: Optional[str] = Query(default=DEFAULT_MODEL),
    save_to_gold: Optional[bool] = Query(default=True)
):
    """
    Executes the Discharge Summary LLM Generation workflow via GET request with query parameters.
    """
    req = DischargeSummaryLLMRequest(
        patient_id=patient_id,
        model_name=model_name,
        save_to_gold=save_to_gold
    )
    return generate_discharge_summary_llm_post(req)


@router.get("/records", summary="List All LLM-Generated Discharge Summaries from Gold Table")
def list_generated_discharge_summaries(
    limit: Optional[int] = Query(None, description="Limit rows returned (omit for all)"),
    offset: int = Query(default=0, ge=0)
):
    """
    Queries `health_care.gold.dim_generated_discharge_summaries` to retrieve stored discharge summaries.
    """
    try:
        res = db_connector.query_gold_table(
            table_name="dim_generated_discharge_summaries",
            limit=limit,
            offset=offset
        )
        return {
            "status": "success",
            "total": res.get("total_rows", 0),
            "limit": limit,
            "offset": offset,
            "data": res.get("data", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch generated summaries: {str(e)}")


@router.get("/records/{patient_id}", summary="Get Generated Discharge Summary for a Single Patient")
def get_single_patient_generated_summary(patient_id: str):
    """
    Retrieves the latest generated discharge summary for a specific patient from Gold Delta table.
    """
    pid_str = str(patient_id).strip()
    try:
        res = db_connector.query_gold_table(
            table_name="dim_generated_discharge_summaries",
            limit=500
        )
        data = res.get("data", [])
        matched = None
        for row in data:
            if str(row.get("patient_id")) == pid_str or str(row.get("patient_number", "")).lower() == pid_str.lower():
                matched = row
                break

        if not matched:
            # Auto-generate on-demand if not found
            gen_res = generate_and_persist_discharge_summaries(pid_str)
            if gen_res.get("data"):
                matched = gen_res["data"][0]

        if not matched:
            raise HTTPException(status_code=404, detail=f"Discharge summary for patient '{pid_str}' not found.")

        return {
            "status": "success",
            "patient_id": pid_str,
            "data": matched
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch summary for patient {pid_str}: {str(e)}")
