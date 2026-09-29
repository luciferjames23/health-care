from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from connectors.databricks_connector import DatabricksConnector
from config.config import Config

router = APIRouter(
    prefix="/api/v1/notebook",
    tags=["Databricks Notebook Execution APIs"]
)

db_connector = DatabricksConnector()

# Known notebooks:
# 2865138219507461 -> /Users/jamesrubert02@gmail.com/Health-care/code/Discharge_summary/Discharge Summary LLM Generation
# 3655906645282312 -> /Users/gaberieljayaraj05@gmail.com/Health-care/code/Discharge_summary/Discharge Summary LLM Generation

from services.discharge_generator import generate_and_persist_discharge_summaries

DEFAULT_NOTEBOOK_ID = "2865138219507461"


class PatientNotebookRequest(BaseModel):
    patient_id: str
    notebook_id: Optional[str] = DEFAULT_NOTEBOOK_ID
    timeout_seconds: Optional[int] = 300


@router.post("/run-patient", summary="Execute Discharge Summary Notebook for Patient ID (POST)")
def run_patient_notebook_post(request: PatientNotebookRequest):
    """
    Executes the Discharge Summary Generation engine locally for one or more patient IDs
    (comma-separated e.g. "87224,87225" or "1,2,3,4") and persists results to Gold Delta table.
    """
    pid = str(request.patient_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Parameter patient_id is required.")

    notebook_id = str(request.notebook_id or DEFAULT_NOTEBOOK_ID).strip()

    try:
        gen_res = generate_and_persist_discharge_summaries(pid)
        summaries = gen_res.get("data", [])
        return {
            "status": "success",
            "notebook_id": notebook_id,
            "patient_ids": pid,
            "total_processed": len(summaries),
            "execution_state": "SUCCESS",
            "mode": "local_engine",
            "target_table": "health_care.gold.dim_generated_discharge_summaries",
            "data": summaries
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute discharge summary: {str(e)}")



@router.get("/run-patient", summary="Execute Databricks Notebook for Patient ID (GET)")
def run_patient_notebook_get(
    patient_id: str = Query(..., description="Patient ID to pass to the notebook (e.g. 87227)"),
    notebook_id: Optional[str] = Query(
        default=DEFAULT_NOTEBOOK_ID,
        description="Databricks Notebook object ID or absolute workspace path"
    ),
    timeout_seconds: int = Query(default=300, ge=1, le=600)
):
    """
    Triggers execution of the Discharge Summary LLM Generation notebook
    passing patient_id as a parameter via query string.
    """
    pid = str(patient_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Parameter patient_id is required.")

    nb = str(notebook_id or DEFAULT_NOTEBOOK_ID).strip()
    parameters = {"patient_id": pid}

    try:
        res = db_connector.run_databricks_notebook(
            notebook_path_or_id=nb,
            parameters=parameters,
            timeout_seconds=timeout_seconds
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute notebook: {str(e)}")


@router.get("/config", summary="Databricks Workspace and Notebook Configuration")
def get_notebook_config():
    """Returns configured Databricks workspace URL, default job ID, and known notebook IDs."""
    job_id = DEFAULT_NOTEBOOK_ID
    return {
        "workspace_hostname": Config.DATABRICKS_SERVER_HOSTNAME,
        "workspace_id": Config.DATABRICKS_WORKSPACE_ID,
        "default_job_id": job_id,
        "job_url": (
            f"https://{Config.DATABRICKS_SERVER_HOSTNAME}"
            f"/#job/{job_id}?o={Config.DATABRICKS_WORKSPACE_ID}"
        ),
        "known_jobs": {
            "63391549950619": "Registered Job: discharge_summary_generation (Owner: jamesrubert02@gmail.com)"
        },
        "known_notebooks": {
            "2865138219507461": (
                "/Users/jamesrubert02@gmail.com/Health-care/code/"
                "Discharge_summary/Discharge Summary LLM Generation"
            ),
            "3655906645282312": (
                "/Users/gaberieljayaraj05@gmail.com/Health-care/code/"
                "Discharge_summary/Discharge Summary LLM Generation"
            ),
        },
        "supported_parameters": ["patient_id"],
    }
