import logging
from typing import Optional, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from services.billing_transparency_agent import BillingTransparencyAgentService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/billing-transparency",
    tags=["AG-08 · Billing Transparency Agent (கட்டண வெளிப்படைத்தன்மை முகவர்)"]
)

billing_service = BillingTransparencyAgentService()


class BreakdownRequest(BaseModel):
    patient_id: Optional[Union[str, int]] = Field(None, description="Patient ID, UHID, Invoice ID or Name")
    model_name: Optional[str] = Field(default="openai/gpt-oss-120b", description="LLM model identifier")
    api_key: Optional[str] = Field(default=None, description="Optional Groq API key override")


class ApproveExplanationRequest(BaseModel):
    invoice_id: str = Field(..., description="Invoice ID (e.g. INV-2026-902)")
    approver_name: Optional[str] = Field(default="S. Murugan (Chief Cashier)", description="Staff approver name")
    notes: Optional[str] = Field(default="Reviewed and approved plain-language explanation for invoice print.", description="Staff notes")


@router.get("/status", summary="Get AG-08 Agent Profile & Benchmarks")
def get_agent_status():
    """Returns AG-08 prototype specification, architecture, tools, knowledge bases, and performance benchmarks."""
    try:
        return {
            "status": "success",
            "agent": billing_service.get_agent_profile()
        }
    except Exception as e:
        logger.error(f"Error in get_agent_status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", summary="Get Live Billing Desk & Variance Statistics")
def get_billing_stats():
    """Returns real-time cashier desk metrics, total invoiced, estimates, and variance flags."""
    try:
        return {
            "status": "success",
            "data": billing_service.get_billing_stats()
        }
    except Exception as e:
        logger.error(f"Error in get_billing_stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cases", summary="List Inpatient Accounts with Variance Indicators")
def list_billing_cases(
    limit: Optional[int] = Query(None, description="Max cases to return"),
    search: Optional[str] = Query(None, description="Search by name, UHID, invoice or department"),
    status_filter: Optional[str] = Query(None, description="Filter by 'variance' or 'cleared'")
):
    """Lists inpatient billing files with real-time variance calculation against initial estimate."""
    try:
        cases = billing_service.list_billing_cases(limit=limit, search=search, status_filter=status_filter)
        return {
            "status": "success",
            "count": len(cases),
            "data": cases
        }
    except Exception as e:
        logger.error(f"Error in list_billing_cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/breakdown/{patient_identifier}", summary="Get Bilingual Plain-Language Breakdown (English + Tamil)")
def get_plain_language_breakdown(patient_identifier: str):
    """
    Executes Groq LLM (openai/gpt-oss-120b) synthesis to convert technical line items & OT notes
    into plain-language English and Tamil explanations.
    """
    try:
        result = billing_service.generate_plain_language_breakdown(patient_identifier)
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error generating plain language breakdown: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-breakdown", summary="Trigger On-Demand LLM Plain-Language Breakdown")
def generate_plain_language_breakdown_post(req: BreakdownRequest = Body(...)):
    """Triggers real-time LLM inference for custom patient / model selection."""
    try:
        target = req.patient_id or "87221"
        result = billing_service.generate_plain_language_breakdown(
            str(target),
            custom_model=req.model_name,
            custom_api_key=req.api_key
        )
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error in generate_plain_language_breakdown_post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/necessity/{patient_identifier}", summary="Investigate Clinical Necessity Audit Drawer")
def investigate_clinical_necessity(
    patient_identifier: str,
    item_code: Optional[str] = Query(None, description="Item code to investigate (e.g. MAT-CATH-NC)")
):
    """Returns verified clinical audit trail and doctor justifications for contested line items."""
    try:
        result = billing_service.investigate_clinical_necessity(patient_identifier, item_code=item_code)
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error investigating clinical necessity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/approve-print", summary="Approve Plain-Language Summary for Invoice Print")
def approve_explanation_for_print(req: ApproveExplanationRequest = Body(...)):
    """Authorizes the plain-language note to appear on the official patient invoice / PDF."""
    try:
        result = billing_service.approve_for_invoice(req.invoice_id, req.approver_name, req.notes)
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error approving explanation for print: {e}")
        raise HTTPException(status_code=500, detail=str(e))
