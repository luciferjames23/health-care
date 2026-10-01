"""
AG-04 Employee Service Agent Router (பணியாளர் சேவை முகவர்)
Path: backend/routers/employee_service_agent.py

REST API endpoints powering the Internal Staff Chatbot widget:
- GET  /api/v1/employee-agent/profile
- GET  /api/v1/employee-agent/shift
- GET  /api/v1/employee-agent/leave-balance
- POST /api/v1/employee-agent/apply-leave
- POST /api/v1/employee-agent/chat
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from services.employee_service_agent import EmployeeServiceAgentService

router = APIRouter(
    prefix="/api/v1/employee-agent",
    tags=["AG-04 · Employee Service Agent (பணியாளர் சேவை முகவர்)"]
)

# Ultra-fast Employee Service Agent instance
agent_service = EmployeeServiceAgentService()

class ChatRequest(BaseModel):
    message: str = Field(..., description="Message from staff employee")
    username: Optional[str] = Field(default="nurse.priya", description="Logged-in staff username or ID")
    history: Optional[List[Dict[str, str]]] = Field(default=None, description="Previous conversation turns")

class LeaveApplyRequest(BaseModel):
    username: str = Field(..., description="Logged in username")
    leave_type: Optional[str] = Field(default="Comp-Off", description="Type of leave (Comp-Off, Casual, Sick)")
    from_date: Optional[str] = Field(default=None, description="Start date (YYYY-MM-DD)")
    to_date: Optional[str] = Field(default=None, description="End date (YYYY-MM-DD)")
    reason: Optional[str] = Field(default=None, description="Reason for leave")

@router.get("/profile", summary="Get AG-04 Agent Specifications")
def get_agent_profile():
    """Returns AG-04 agent specification, connected tools, and governed policy documents."""
    return {
        "status": "success",
        "agent": agent_service.get_agent_profile()
    }

@router.get("/shift", summary="Get Employee Shift Timing")
def get_shift(
    username: str = Query(default="nurse.priya", description="Employee username or ID"),
    date: Optional[str] = Query(default="tomorrow", description="Date: 'today', 'tomorrow', or YYYY-MM-DD")
):
    """Checks PostgreSQL roster tables for employee shift timing."""
    res = agent_service.get_user_shift(user_identifier=username, target_date=date)
    return res

@router.get("/leave-balance", summary="Get Employee Leave & Comp-Off Balance")
def get_leave_balance(
    username: str = Query(default="nurse.priya", description="Employee username or ID")
):
    """Retrieves comp-off and leave balance from PostgreSQL ledger."""
    res = agent_service.get_user_leave_balance(user_identifier=username)
    return res

@router.post("/apply-leave", summary="Apply for Leave / Comp-Off")
def apply_leave(payload: LeaveApplyRequest):
    """Submits leave or comp-off request and routes to supervisor."""
    res = agent_service.apply_leave(
        user_identifier=payload.username,
        leave_type=payload.leave_type or "Comp-Off",
        from_date=payload.from_date,
        to_date=payload.to_date,
        reason=payload.reason
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to apply leave"))
    return res

@router.post("/chat", summary="Chat with Employee Service Agent")
def chat_agent(payload: ChatRequest):
    """
    Main conversational interface:
    Handles employee natural language questions regarding shifts, comp-off availability,
    and HR policies, returning tailored text and interactive pre-filled leave slips.
    """
    res = agent_service.process_chat(
        message=payload.message,
        user_identifier=payload.username or "nurse.priya",
        history=payload.history
    )
    return res
