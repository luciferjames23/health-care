import os
import datetime
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from connectors.databricks_connector import DatabricksConnector
from services.discharge_generator import (
    generate_and_persist_discharge_summaries,
    generate_patient_discharge_summary,
    SUPPORTED_LLM_PROVIDERS,
    resolve_llm_provider
)

router = APIRouter(
    prefix="/api/v1/discharge-summary-llm",
    tags=["Discharge Summary Multi-Model LLM Generation (Groq / Gemini / OpenAI / Databricks / Local)"]
)

db_connector = DatabricksConnector()

DEFAULT_MODEL = os.getenv("DISCHARGE_LLM_MODEL", "llama-3.3-70b-versatile")


class DischargeSummaryLLMRequest(BaseModel):
    patient_id: Optional[str] = "all"  # Comma-separated (e.g. "87224,87225") or "all"
    model_name: Optional[str] = Field(
        default=None,
        description="Any LLM model identifier (e.g. 'llama-3.3-70b-versatile', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gpt-4o', 'databricks-meta-llama-3-3-70b-instruct', or 'local-clinical-engine')"
    )
    provider: Optional[str] = Field(
        default=None,
        description="Optional provider override: 'groq', 'gemini', 'openai', 'databricks', 'local', or 'auto'"
    )
    api_key: Optional[str] = Field(
        default=None,
        description="Optional provider API key. If omitted, uses server environment variables (GROQ_API_KEY, GEMINI_API_KEY, etc.)"
    )
    temperature: Optional[float] = 0.3
    max_tokens: Optional[int] = 2000
    save_to_gold: Optional[bool] = True


@router.get("/available-models", summary="List All Supported LLM Providers & Models")
def get_available_llm_models():
    """Returns all supported LLM providers (Groq, Gemini, OpenAI, Databricks, Local) and active environment key status."""
    catalog = []
    for prov_id, meta in SUPPORTED_LLM_PROVIDERS.items():
        env_var = meta.get("env_key")
        is_configured = bool(os.getenv(env_var)) if env_var else True
        catalog.append({
            "provider_id": prov_id,
            "provider_name": meta.get("provider_name"),
            "default_model": meta.get("default_model"),
            "available_models": meta.get("available_models", []),
            "description": meta.get("description"),
            "api_key_env": env_var,
            "is_configured": is_configured
        })
    return {
        "status": "success",
        "default_active_model": DEFAULT_MODEL,
        "providers": catalog
    }


@router.post("/generate", summary="Generate Discharge Summaries with Any LLM Model - POST")
def generate_discharge_summary_llm_post(request: DischargeSummaryLLMRequest):
    """
    Executes the Multi-Model Discharge Summary Generation workflow:
    1. Resolves `patient_id` (e.g. comma-separated '87224,87225' or 'all').
    2. Resolves selected LLM (Groq, Google Gemini, OpenAI, Databricks, or Local Engine).
    3. Retrieves patient clinical inputs from `dim_admission_inputs`.
    4. Generates all 8 structured clinical fields using chosen model.
    5. Automatically persists generated output into `dim_generated_discharge_summaries`.
    """
    pid_param = str(request.patient_id or "all").strip()
    if not pid_param:
        pid_param = "all"

    selected_model = request.model_name or DEFAULT_MODEL

    try:
        res = generate_and_persist_discharge_summaries(
            patient_ids=pid_param,
            model_name=selected_model,
            provider=request.provider,
            api_key=request.api_key
        )
        return {
            "status": "success",
            "model": res.get("model_name", selected_model),
            "provider": res.get("provider", request.provider or "auto"),
            "temperature": request.temperature or 0.3,
            "max_tokens": request.max_tokens or 2000,
            "patient_ids_requested": pid_param,
            "patient_ids_executed": res.get("patient_ids_executed"),
            "total_generated": res.get("total_processed", 0),
            "target_table": "dim_generated_discharge_summaries",
            "data": res.get("data", []),
            "timestamp": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")


@router.get("/generate", summary="Generate Discharge Summaries with Any LLM Model - GET")
def generate_discharge_summary_llm_get(
    patient_id: str = Query(
        default="all",
        description="Comma-separated patient IDs (e.g. '87224,87225' or '2,3,4,5,6') or 'all'"
    ),
    model_name: Optional[str] = Query(
        default=None,
        description="Model identifier (e.g. 'llama-3.3-70b-versatile', 'gemini-1.5-flash', 'gpt-4o', or 'local-clinical-engine')"
    ),
    provider: Optional[str] = Query(
        default=None,
        description="Provider override: 'groq', 'gemini', 'openai', 'databricks', or 'local'"
    ),
    api_key: Optional[str] = Query(
        default=None,
        description="Optional API key override"
    ),
    save_to_gold: Optional[bool] = Query(default=True)
):
    """Executes the Discharge Summary LLM Generation workflow via GET with optional model selection."""
    req = DischargeSummaryLLMRequest(
        patient_id=patient_id,
        model_name=model_name,
        provider=provider,
        api_key=api_key,
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
    # Exact 17-column Databricks Lakehouse Schema
    summary_id: Optional[Union[int, str]] = None
    admission_id: Optional[Union[int, str]] = None
    patient_id: Optional[Union[int, str]] = None
    doctor_id: Optional[Union[int, str]] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    diagnoses: Optional[str] = None
    case_history: Optional[str] = None
    investigations: Optional[str] = None
    treatment: Optional[str] = None
    primary_consultant: Optional[str] = None
    discharge_advice: Optional[str] = None
    surgery_details: Optional[str] = None
    patient_condition: Optional[str] = None
    generated_at: Optional[str] = None
    ingestion_timestamp: Optional[str] = None
    approval_status: Optional[str] = None  # e.g. "Approved", "Pending Approval", "Rejected", "Under Revision", "Signed"

    # Compatibility Aliases
    approved_by: Optional[str] = None
    hospital_course_summary: Optional[str] = None
    discharge_diagnosis: Optional[str] = None
    discharge_medications: Optional[str] = None
    followup_instructions: Optional[str] = None
    attending_physician: Optional[str] = None
    admission_reason: Optional[str] = None
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
    Updates the content (diagnoses, case_history, treatment, discharge_advice, etc.)
    and governance status (`approval_status`) in `health_care.gold.dim_generated_discharge_summaries`.
    Matches by `summary_id` (e.g. 87229), `patient_id` (e.g. 87230), `patient_number`, or `admission_id`.
    """
    id_str = str(summary_id).strip()
    return _perform_discharge_summary_update(id_str, payload)


@router.post("/update", summary="Edit and Update Discharge Summary via POST Body")
@router.put("/update", summary="Edit and Update Discharge Summary via PUT Body")
def update_discharge_summary_by_body(
    payload: DischargeSummaryLLMUpdateRequest
):
    """
    Updates the content and approval status for a generated discharge summary using `summary_id`, `admission_id`, or `patient_id` specified in the body.
    """
    id_str = str(payload.summary_id or payload.admission_id or payload.patient_id or "").strip()
    if not id_str:
        raise HTTPException(status_code=400, detail="Either summary_id, admission_id, or patient_id must be provided in request body.")
    return _perform_discharge_summary_update(id_str, payload)


def _perform_discharge_summary_update(identifier: str, payload: DischargeSummaryLLMUpdateRequest):
    id_str = str(identifier).strip()
    id_digits = "".join(filter(str.isdigit, id_str))
    
    res = db_connector.query_gold_table("dim_generated_discharge_summaries", limit=1000)
    data = res.get("data", [])
    matched = None

    # Priority 1: Exact summary_id match (numeric or prefixed)
    for row in data:
        sid = str(row.get("summary_id", "")).strip().lower()
        if sid == id_str.lower() or sid == f"ds-{id_str}".lower() or (id_digits and sid == id_digits):
            matched = row
            break

    # Priority 2: Exact admission_id match
    if not matched:
        for row in data:
            aid = str(row.get("admission_id", "")).strip().lower()
            if aid == id_str.lower() or (id_digits and aid == id_digits):
                matched = row
                break

    # Priority 3: Exact patient_id match
    if not matched:
        for row in data:
            pid = str(row.get("patient_id", "")).strip()
            if pid == id_str or (id_digits and pid == id_digits):
                matched = row
                break

    # Priority 4: Exact patient_number match
    if not matched:
        for row in data:
            if str(row.get("patient_number", "")).strip().lower() == id_str.lower():
                matched = row
                break

    if not matched:
        # ── Upsert: patient has no discharge summary row yet (synthesized on frontend).
        # Use insert_record which does INSERT ... RETURNING * so the BIGSERIAL summary_id
        # is generated by PostgreSQL — never pass summary_id explicitly.
        raw_payload = payload.dict()
        patient_id_val = raw_payload.get("patient_id") or id_digits or None
        admission_id_val = raw_payload.get("admission_id") or None

        # Normalize alias names before insert
        diagnoses_val = raw_payload.get("diagnoses") or raw_payload.get("discharge_diagnosis") or None
        case_history_val = raw_payload.get("case_history") or raw_payload.get("hospital_course_summary") or None
        treatment_val = raw_payload.get("treatment") or raw_payload.get("discharge_medications") or None
        discharge_advice_val = raw_payload.get("discharge_advice") or raw_payload.get("followup_instructions") or None
        consultant_val = raw_payload.get("primary_consultant") or raw_payload.get("attending_physician") or None
        approval_val = raw_payload.get("approval_status") or "Pending Review"

        # Build insert dict — DO NOT include summary_id; it is BIGSERIAL and auto-generated by DB
        insert_record = {}
        if patient_id_val:
            insert_record["patient_id"] = int(patient_id_val)
        if admission_id_val:
            try:
                insert_record["admission_id"] = int(admission_id_val)
            except (ValueError, TypeError):
                pass
        if diagnoses_val:
            insert_record["diagnoses"] = diagnoses_val
        if case_history_val:
            insert_record["case_history"] = case_history_val
        if treatment_val:
            insert_record["treatment"] = treatment_val
        if discharge_advice_val:
            insert_record["discharge_advice"] = discharge_advice_val
        if consultant_val:
            insert_record["primary_consultant"] = consultant_val
        if raw_payload.get("investigations"):
            insert_record["investigations"] = raw_payload["investigations"]
        if raw_payload.get("surgery_details"):
            insert_record["surgery_details"] = raw_payload["surgery_details"]
        if raw_payload.get("patient_condition"):
            insert_record["patient_condition"] = raw_payload["patient_condition"]
        insert_record["approval_status"] = approval_val
        insert_record["generated_at"] = datetime.datetime.utcnow()

        try:
            # insert_record uses INSERT ... RETURNING * — PostgreSQL generates summary_id
            new_row = db_connector.insert_record(
                table_name="dim_generated_discharge_summaries",
                record=insert_record
            )
            if not new_row:
                raise ValueError("INSERT returned no row")
            matched = new_row
        except Exception as ins_err:
            raise HTTPException(
                status_code=500,
                detail=f"Discharge summary '{id_str}' not found and auto-insert also failed: {str(ins_err)}"
            )

    actual_sid = matched.get("summary_id")
    raw_dict = payload.dict()
    raw_dict.pop("summary_id", None)

    # Normalize alias field names into true table column names
    if raw_dict.get("discharge_diagnosis") and not raw_dict.get("diagnoses"):
        raw_dict["diagnoses"] = raw_dict.pop("discharge_diagnosis")
    if raw_dict.get("hospital_course_summary") and not raw_dict.get("case_history"):
        raw_dict["case_history"] = raw_dict.pop("hospital_course_summary")
    if raw_dict.get("discharge_medications") and not raw_dict.get("treatment"):
        raw_dict["treatment"] = raw_dict.pop("discharge_medications")
    if raw_dict.get("followup_instructions") and not raw_dict.get("discharge_advice"):
        raw_dict["discharge_advice"] = raw_dict.pop("followup_instructions")
    if raw_dict.get("attending_physician") and not raw_dict.get("primary_consultant"):
        raw_dict["primary_consultant"] = raw_dict.pop("attending_physician")

    # Only include valid table schema columns for the SQL update statement
    VALID_COLS = {
        "admission_id", "patient_id", "doctor_id", "admission_date", "discharge_date",
        "diagnoses", "case_history", "investigations", "treatment", "primary_consultant",
        "discharge_advice", "surgery_details", "patient_condition", "generated_at",
        "ingestion_timestamp", "approval_status"
    }

    update_dict = {k: v for k, v in raw_dict.items() if v is not None and k in VALID_COLS}

    if not update_dict:
        return {
            "status": "no_change",
            "message": "No valid schema fields provided to update.",
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
            "admission_id": matched.get("admission_id"),
            "primary_consultant": matched.get("primary_consultant"),
            "updated_fields": list(update_dict.keys()),
            "data": upd_res.get("data") or {**matched, **update_dict}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update discharge summary: {str(e)}")

