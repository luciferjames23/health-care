import logging
from typing import Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from services.insurance_preauth_agent import InsurancePreauthAgentService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/preauth-agent",
    tags=["Insurance Preauth Desk"]
)

preauth_service = InsurancePreauthAgentService()


class GenerateDossierRequest(BaseModel):
    patient_id: Optional[Union[str, int]] = Field(None, description="Patient ID or Code (e.g. MER-PAT-0087264, 87264, or Kavitha)")
    model_name: Optional[str] = None
    provider: Optional[str] = "clinical_engine"
    api_key: Optional[str] = None
    force_refresh: Optional[bool] = False


class SubmitPreauthRequest(BaseModel):
    patient_code: Optional[str] = "MER-PAT-0087264"
    patient_id: Optional[Union[str, int]] = 87264
    admission_id: Optional[Union[str, int]] = 87264
    insurance_provider: Optional[str] = "Star Health & Allied Insurance"
    policy_number: Optional[str] = "STAR-POL-7728194"
    claimed_amount: Optional[float] = 245000.0
    submitted_by: Optional[str] = "R. Sundar (Insurance Desk Executive)"
    notes: Optional[str] = "1-Click Submission from Preauth Dossier Drawer"
    denial_risk: Optional[str] = "9% (Low Risk · Policy & Clinical Validation Engine)"


@router.get("/profile")
def get_agent_profile():
    """Returns Insurance Preauth Agent specification, architecture details, benchmarks, and active stats."""
    try:
        return preauth_service.get_agent_profile()
    except Exception as e:
        logger.error(f"Error getting preauth agent profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
def get_preauth_stats():
    """Returns real-time preauth metrics and submission speed benchmarks."""
    try:
        return preauth_service.get_preauth_stats()
    except Exception as e:
        logger.error(f"Error getting preauth stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cases")
def list_preauth_cases(
    limit: Optional[int] = Query(None, description="Optional limit of cases; if omitted, returns all active cases"),
    search: Optional[str] = Query(None, description="Search by patient name, UHID, policy number, or insurer")
):
    """Lists admitted / scheduled insured patients waiting for preauth dossier review."""
    try:
        cases = preauth_service.list_preauth_cases(limit=limit, search=search)
        return {
            "success": True,
            "count": len(cases),
            "cases": cases
        }
    except Exception as e:
        logger.error(f"Error fetching preauth cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dossier/{patient_identifier}")
def get_or_generate_dossier(patient_identifier: str):
    """Fetches preauth dossier preview for a patient WITHOUT modifying stage."""
    try:
        return preauth_service.generate_preauth_dossier(patient_identifier, record_action=False)
    except Exception as e:
        logger.error(f"Error generating preauth dossier for {patient_identifier}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
def generate_dossier_post(req: GenerateDossierRequest = Body(...)):
    """Triggers generation of the preauth dossier and advances patient stage to DOSSIER_READY."""
    try:
        target = req.patient_id or "87264"
        return preauth_service.generate_preauth_dossier(target, record_action=True)
    except Exception as e:
        logger.error(f"Error in generate_dossier_post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class ApprovePreauthRequest(BaseModel):
    patient_id: Optional[Union[str, int]] = None
    claim_id: Optional[Union[str, int]] = None
    claim_number: Optional[str] = None
    approved_amount: Optional[float] = None
    approved_by: Optional[str] = "TPA Medical Adjudicator / Insurance Desk"
    authorization_number: Optional[str] = None


@router.post("/submit")
def submit_preauth_packet(req: SubmitPreauthRequest = Body(...)):
    """1-Click human submission of preauth packet to TPA/Insurer with full audit tracking."""
    try:
        return preauth_service.submit_preauth_to_tpa(req.dict())
    except Exception as e:
        logger.error(f"Error submitting preauth packet: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve")
def approve_preauth_claim(req: ApprovePreauthRequest = Body(...)):
    """Approves preauth claim in DB and generates official cashless authorization letter."""
    try:
        return preauth_service.approve_preauth_claim(req.dict())
    except Exception as e:
        logger.error(f"Error approving preauth claim: {e}")
        raise HTTPException(status_code=500, detail=str(e))
