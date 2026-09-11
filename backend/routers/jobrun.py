from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from connectors.databricks_connector import DatabricksConnector
from config.config import Config

router = APIRouter(
    prefix="/api/v1/job",
    tags=["Databricks Job Execution APIs"]
)

db_connector = DatabricksConnector()

# Default Registered Databricks Job ID
DEFAULT_JOB_ID = "63391549950619"


class PatientJobRequest(BaseModel):
    patient_id: str
    job_id: Optional[str] = DEFAULT_JOB_ID
    timeout_seconds: Optional[int] = 300


@router.post("/run-patient", summary="Execute Databricks Job for Patient ID (POST)")
def run_patient_job_post(request: PatientJobRequest):
    """
    Triggers execution of the registered Databricks Job (ID 63391549950619) via Jobs API /run-now,
    passing patient_id as a job parameter, polls until completion, and returns the job output.
    """
    pid = str(request.patient_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Parameter patient_id is required.")

    job_id = str(request.job_id or DEFAULT_JOB_ID).strip()
    parameters = {"patient_id": pid}

    try:
        res = db_connector.run_databricks_notebook(
            notebook_path_or_id=job_id,
            parameters=parameters,
            timeout_seconds=request.timeout_seconds or 300
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute Databricks job: {str(e)}")


@router.get("/run-patient", summary="Execute Databricks Job for Patient ID (GET)")
def run_patient_job_get(
    patient_id: str = Query(..., description="Patient ID to pass to the job (e.g. 87237)"),
    job_id: Optional[str] = Query(
        default=DEFAULT_JOB_ID,
        description="Registered Databricks Job ID"
    ),
    timeout_seconds: int = Query(default=300, ge=1, le=600)
):
    """
    Triggers execution of the registered Databricks Job via GET query parameters.
    """
    pid = str(patient_id or "").strip()
    if not pid:
        raise HTTPException(status_code=400, detail="Parameter patient_id is required.")

    jid = str(job_id or DEFAULT_JOB_ID).strip()
    parameters = {"patient_id": pid}

    try:
        res = db_connector.run_databricks_notebook(
            notebook_path_or_id=jid,
            parameters=parameters,
            timeout_seconds=timeout_seconds
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute Databricks job: {str(e)}")


@router.get("/config", summary="Databricks Job Execution Configuration")
def get_job_config():
    """Returns configured Databricks workspace URL and default job details."""
    return {
        "workspace_hostname": Config.DATABRICKS_SERVER_HOSTNAME,
        "workspace_id": Config.DATABRICKS_WORKSPACE_ID,
        "default_job_id": DEFAULT_JOB_ID,
        "job_url": (
            f"https://{Config.DATABRICKS_SERVER_HOSTNAME}"
            f"/#job/{DEFAULT_JOB_ID}?o={Config.DATABRICKS_WORKSPACE_ID}"
        ),
        "supported_parameters": ["patient_id"],
    }
