"""Read-only management endpoints for AG-21."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.auth_helper import get_current_user
from services.ag21_management_service import bottleneck_feed, executive_summary
from services.ag21_strategy_service import answer_management_question

router = APIRouter(prefix="/api/v1/ag21", tags=["AG-21 Management Copilot"])
MANAGEMENT_ROLES = {"admin", "system admin", "hospital management", "ai administrator"}


class ManagementQuery(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    context_question: str | None = Field(default=None, max_length=1000)
    context_items: list[str] | None = Field(default=None, max_length=25)


def require_management(user=Depends(get_current_user)):
    role = str(user.get("role") or "").strip().lower()
    if role not in MANAGEMENT_ROLES:
        raise HTTPException(status_code=403, detail="Management authorization required.")
    return user


@router.get("/summary")
def get_management_summary(_user=Depends(require_management)):
    """Return source-isolated, read-only AG-21 executive metrics."""
    try:
        return executive_summary()
    except Exception as exc:
        # Individual source failures are already isolated in the service.
        raise HTTPException(status_code=503, detail="Management summary is temporarily unavailable.") from exc


@router.get("/bottlenecks")
def get_bottlenecks(
    category: str | None = Query(None, max_length=40),
    management_category: str | None = Query(None, max_length=40),
    source_agent: str | None = Query(None, max_length=40),
    priority: str | None = Query(None, max_length=40),
    page: int = Query(1, ge=1),
    page_size: int | None = Query(None, ge=1, le=500),
    limit: int | None = Query(None, ge=1, le=500, deprecated=True),
    _user=Depends(require_management),
):
    """Return currently pending, source-evidenced work items."""
    try:
        return bottleneck_feed(category=category, management_category=management_category,
                               source_agent=source_agent, priority=priority,
                               page=page, page_size=page_size, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Bottleneck feed is temporarily unavailable.") from exc


@router.post("/query")
def post_management_query(request: ManagementQuery, _user=Depends(require_management)):
    """Answer management questions from verified AG-21 summary and bottleneck data only."""
    try:
        return answer_management_question(request.question, context_question=request.context_question,
                                          context_items=request.context_items)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AG-21 could not retrieve management evidence at this time.") from exc
