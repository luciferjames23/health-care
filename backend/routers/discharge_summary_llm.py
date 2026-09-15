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


class DischargeSummaryLLMUpdateRequest(BaseModel):
    summary_id: Optional[str] = None
    patient_id: Optional[Union[str, int]] = None
    approval_status: Optional[str] = None  # e.g. "Approved", "Pending Approval", "Rejected", "Under Revision", "Signed"
    approved_by: Optional[str] = None      # e.g. "Dr. Meenakshi Nair, MBBS, MD"
    hospital_course_summary: Optional[str] = None
    discharge_diagnosis: Optional[str] = None
    discharge_medications: Optional[str] = None
    followup_instructions: Optional[str] = None
    attending_physician: Optional[str] = None
    admission_reason: Optional[str] = None
    discharge_date: Optional[str] = None
    llm_generated_summary_text: Optional[str] = None
    model_name: Optional[str] = None
    patient_name: Optional[str] = None


@router.put("/update/{summary_id}", summary="Edit and Update Discharge Summary (Content & Approval Status)")
@router.patch("/update/{summary_id}", summary="Partial Update Discharge Summary (Content & Approval Status)")
def update_discharge_summary_by_path(
    summary_id: str,
    payload: DischargeSummaryLLMUpdateRequest
):
    """
    Updates the content (diagnosis, medications, hospital course, instructions)
    and governance status (`approval_status`, `approved_by`) in `health_care.gold.dim_generated_discharge_summaries`.
    Matches by `summary_id` (e.g. 'DS-87224'), `patient_id` (e.g. '87224'), `patient_number`, or `admission_id`.
    """
    id_str = str(summary_id).strip()
    return _perform_discharge_summary_update(id_str, payload)


@router.post("/update", summary="Edit and Update Discharge Summary via POST Body")
@router.put("/update", summary="Edit and Update Discharge Summary via PUT Body")
def update_discharge_summary_by_body(
    payload: DischargeSummaryLLMUpdateRequest
):
    """
    Updates the content and approval status for a generated discharge summary using `summary_id` or `patient_id` specified in the body.
    """
    id_str = str(payload.summary_id or payload.patient_id or "").strip()
    if not id_str:
        raise HTTPException(status_code=400, detail="Either summary_id or patient_id must be provided in request body.")
    return _perform_discharge_summary_update(id_str, payload)


def _perform_discharge_summary_update(identifier: str, payload: DischargeSummaryLLMUpdateRequest):
    id_str = str(identifier).strip()
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
    raw_dict = payload.dict()
    raw_dict.pop("summary_id", None)
    if "patient_id" in raw_dict and raw_dict["patient_id"] is None:
        raw_dict.pop("patient_id", None)

    update_dict = {k: v for k, v in raw_dict.items() if v is not None}

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

