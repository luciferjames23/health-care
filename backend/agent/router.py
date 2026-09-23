from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agent.discharge_pipeline import DischargeAgentPipeline

router = APIRouter(
    prefix="/api/v1/agent/discharge",
    tags=["Discharge Summary Agent (AG-19)"]
)

pipeline = DischargeAgentPipeline()


class ExtractRequest(BaseModel):
    patient_id: str


class ValidateRequest(BaseModel):
    extracted_data: Dict[str, Any]


class GenerateRequest(BaseModel):
    extracted_data: Dict[str, Any]
    model_name: Optional[str] = "Meta-Llama-3.3-70B-Instruct"


class SignOffRequest(BaseModel):
    admission_id: int
    patient_id: int
    doctor_name: str
    notes: Optional[str] = None
    summary_payload: Optional[Dict[str, Any]] = None


@router.get("/candidates", summary="List Eligible Admitted Patients for Discharge Summary Agent")
def get_discharge_candidates():
    """
    Dynamically returns currently admitted patients who need a discharge summary drafted.
    """
    try:
        candidates = pipeline.get_eligible_candidates()
        return {
            "status": "success",
            "count": len(candidates),
            "data": candidates
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract", summary="Step 1: Extract Clinical & Demographic Data")
def extract_clinical_data(req: ExtractRequest):
    """
    Step 1: Dynamically queries PostgreSQL for patient admission, vitals, billing, and diagnosis.
    """
    try:
        data = pipeline.extract_clinical_data(req.patient_id)
        return {
            "status": "success",
            "step": 1,
            "step_name": "Clinical Data Extraction",
            "data": data
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate-gates", summary="Step 2: Evaluate Clinical, Diagnostic & Billing Validation Gates")
def validate_gates(req: ValidateRequest):
    """
    Step 2: Evaluates hemodynamic stability, diagnostics completion, and financial clearance.
    """
    try:
        results = pipeline.evaluate_validation_gates(req.extracted_data)
        return {
            "status": "success",
            "step": 2,
            "step_name": "Autonomous Validation Gates",
            "data": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate", summary="Step 3: Generate LLM Discharge Summary Draft")
def generate_summary(req: GenerateRequest):
    """
    Step 3: Synthesizes extracted encounter data and clinical protocols into structured summary draft.
    """
    try:
        draft = pipeline.generate_llm_summary(req.extracted_data, model_name=req.model_name)
        return {
            "status": "success",
            "step": 3,
            "step_name": "LLM Summary Generation",
            "data": draft
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sign-off", summary="Step 4: Physician Sign-Off, Lakehouse Persistence & Bed Release")
def physician_sign_off(req: SignOffRequest):
    """
    Step 4: Records doctor sign-off, commits to PostgreSQL, marks patient Discharged, and releases the bed.
    """
    try:
        result = pipeline.physician_sign_off_and_discharge(
            admission_id=req.admission_id,
            patient_id=req.patient_id,
            doctor_name=req.doctor_name,
            notes=req.notes,
            summary_payload=req.summary_payload
        )
        return {
            "status": "success",
            "step": 4,
            "step_name": "Physician Sign-Off & Execution",
            "data": result
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BatchGenerateRequest(BaseModel):
    model_name: Optional[str] = "Meta-Llama-3.3-70B-Instruct"


@router.get("/batch-status", summary="Pre-flight Status Metrics for 1-Click Autonomous Batch")
def get_batch_status(model_name: Optional[str] = "Meta-Llama-3.3-70B-Instruct"):
    """
    Dynamically scans all admissions, evaluates the 3 validation pillars using LLM vital evaluation,
    and returns real-time metrics (total admitted, eligible, skipped, and generated summaries).
    """
    try:
        data = pipeline.get_batch_status_metrics(model_name=model_name or "Meta-Llama-3.3-70B-Instruct")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/batch-generate", summary="Execute 1-Click Fully Automated Autonomous Discharge Batch")
def run_batch_generate(req: BatchGenerateRequest = BatchGenerateRequest()):
    """
    ONE-CLICK FULLY AUTOMATED WORKFLOW:
    1. Reads all patients from current admission data (210 active patients).
    2. Evaluates 4 validation gates for each patient.
    3. Filters eligible patients automatically.
    4. Automatically generates discharge summaries using existing LLM pipeline.
    5. Persists summaries into dim_generated_discharge_summaries in PostgreSQL.
    6. Returns real-time counts, eligible summaries, and skipped reasons.
    """
    try:
        result = pipeline.run_autonomous_batch(model_name=req.model_name or "Meta-Llama-3.3-70B-Instruct")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

