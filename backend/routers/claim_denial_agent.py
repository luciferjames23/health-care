import logging
from typing import Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from services.claim_denial_agent import ClaimDenialAgentService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/claim-denials",
    tags=["Claim Denial & Shortfall Appeal Desk (AG-20)"]
)

denial_service = ClaimDenialAgentService()

class GenerateAppealRequest(BaseModel):
    claim_id: Optional[Union[str, int]] = Field(None, description="Claim ID or Claim Number")
    patient_id: Optional[Union[str, int]] = Field(None, description="Patient ID or UHID")

class SubmitAppealRequest(BaseModel):
    claim_id: Optional[Union[str, int]] = None
    patient_id: Optional[Union[str, int]] = None
    denial_code: Optional[str] = "Denial Code 204"
    disputed_amount: Optional[float] = 80000.0
    shortfall_reason: Optional[str] = "Lack of documented conservative management trial"
    appeal_letter: Optional[str] = None
    submitted_by: Optional[str] = "R. Sundar (Revenue Cycle Lead)"

@router.get("/profile")
def get_agent_profile():
    """Returns AG-20 Claim Denial Agent specification, operational tier, and live KPIs."""
    try:
        return {
            "agent_id": "AG-20",
            "agent_name": "Claim Denial Agent (காப்பீட்டு மறுப்பு மேல்முறையீட்டு முகவர்)",
            "delivery_mode": "Workflow Automation (Exactly like AG-19)",
            "primary_users": ["Insurance Desk Executive", "Revenue Cycle Lead", "TPA Adjudication Liaison"],
            "success_rate": "91.0%",
            "operational_tier": "Medium Risk · Selective Human-in-the-Loop",
            "knowledge_base": ["Insurance Preauthorisation SOP v2.4", "IRDAI Cashless Settlement Guidelines 2024", "Master Circular 2020"],
            "tools_used": ["TPA Rejection Parser", "EMR Clinical Retrieval API", "Appeal Dossier Assembler"],
            "stats": denial_service.get_stats()
        }
    except Exception as e:
        logger.error(f"Error getting claim denial profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
def get_appeal_stats():
    """Returns real-time KPIs for Claim Denial & Shortfall Appeal Desk."""
    try:
        return denial_service.get_stats()
    except Exception as e:
        logger.error(f"Error getting claim denial stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cases")
def list_denial_cases(
    limit: Optional[int] = Query(50, description="Limit of shortfall cases"),
    search: Optional[str] = Query(None, description="Search by patient name, UHID, claim number, or insurer")
):
    """Lists active claims having deductions / shortfalls or explicit rejections for Appeal Desk."""
    try:
        cases = denial_service.list_denial_cases(limit=limit or 50, search=search)
        return {
            "success": True,
            "count": len(cases),
            "cases": cases
        }
    except Exception as e:
        logger.error(f"Error fetching denial cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/appeal/{claim_identifier}")
def get_or_generate_appeal_dossier(claim_identifier: str):
    """Fetches or generates the complete AG-20 Appeal Dossier with retrieved clinical EMR proof and appeal letter."""
    try:
        return denial_service.get_appeal_dossier(claim_identifier)
    except Exception as e:
        logger.error(f"Error getting appeal dossier for {claim_identifier}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
def generate_appeal_post(req: GenerateAppealRequest = Body(...)):
    """Triggers generation of the appeal dossier."""
    try:
        target = req.claim_id or req.patient_id or "45019"
        return denial_service.get_appeal_dossier(target)
    except Exception as e:
        logger.error(f"Error generating appeal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit")
def submit_appeal_to_tpa(req: SubmitAppealRequest = Body(...)):
    """1-Click human submission of the AG-20 Appeal Dossier to TPA / Insurer Portal."""
    try:
        return denial_service.submit_appeal_to_tpa(req.dict())
    except Exception as e:
        logger.error(f"Error submitting appeal to TPA: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ResolveChecklistRequest(BaseModel):
    claim_id: int = Field(..., description="Claim ID to resolve missing item for")
    item_id: Optional[str] = Field("medical_necessity", description="Checklist item ID to resolve from EMR")

@router.post("/resolve-item")
def resolve_checklist_item(req: ResolveChecklistRequest = Body(...)):
    """Scans and retrieves missing clinical evidence (e.g., Medical Necessity Justification) from EMR archives to unblock re-submission."""
    try:
        return denial_service.resolve_checklist_item(req.claim_id, req.item_id or "medical_necessity")
    except Exception as e:
        logger.error(f"Error resolving checklist item for claim {req.claim_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

