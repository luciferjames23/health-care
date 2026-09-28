"""
rag.py
======
REST API Router for Meridian Hospital AI Hybrid RAG Layer.

Prefix: /api/rag
Endpoints:
- POST /api/rag/query
- POST /api/rag/conversations
- GET  /api/rag/conversations/{conversation_id}
- POST /api/rag/reindex/patient/{patient_id}
- POST /api/rag/reindex/admission/{admission_id}
- POST /api/rag/reindex/radiology-order/{order_id}
- POST /api/rag/reindex/discharge/{admission_id}
- GET  /api/rag/health
"""

import os
import sys
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import db_config
from api.auth_helper import get_current_user, require_admin
from services.rag_embedding_service import embedding_service
from services.rag_ingestion_service import ingestion_service
from services.rag_query_expansion import query_expansion_service
from services.rag_search_service import search_service
from services.rag_generation_service import generation_service
from services.rag_conversation_service import conversation_service
from services.rag_audit_service import audit_service

router = APIRouter(prefix="/api/rag", tags=["Clinical Hybrid RAG"])


# ─────────────────────────────────────────────────────────────────────────────
# OUTPUT GUARDRAIL — Defense-in-Depth Source Scope Verification
# ─────────────────────────────────────────────────────────────────────────────

_RADIOLOGY_DOC_TYPES = {'xray_order', 'radiology_ai_result', 'radiologist_final_report', 'radiology_clarification'}


def _apply_output_guardrail(sources: list, role: str) -> list:
    """Strips any sources that shouldn't be visible to the current role. Applied AFTER retrieval, BEFORE LLM."""
    if role in ("admin", "hospital management"):
        return sources
    if role == "radiologist":
        return [
            s for s in sources
            if s.get("document_type") in _RADIOLOGY_DOC_TYPES
        ]
    # Doctor and other roles: sources already filtered by search service patient assignment checks
    return sources


# ─────────────────────────────────────────────────────────────────────────────
# PYDANTIC REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────────────────────────────────────

class RagQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1500, description="Clinical query text")
    area: str = Field(..., description="Target area: patient360 | doctor_workspace | radiology | discharge")
    conversation_id: Optional[str] = Field(default=None, description="Existing session UUID for conversational continuation")
    patient_id: Optional[int] = Field(default=None, description="Active patient ID")
    admission_id: Optional[int] = Field(default=None, description="Active admission ID")
    order_id: Optional[str] = Field(default=None, description="Target radiology order UUID")
    accession_number: Optional[str] = Field(default=None, description="Target radiology accession number")
    limit: Optional[int] = Field(default=8, ge=1, le=25, description="Maximum source records to retrieve")
    language: Optional[str] = Field(default="en", description="Target response language code, e.g. en, hi, ta, te, kn, ml, es")
    language_name: Optional[str] = Field(default="English", description="Target response language display name, e.g. English, Hindi, Tamil")


class CreateConversationRequest(BaseModel):
    area: str = Field(..., description="patient360 | doctor_workspace | radiology | discharge")
    patient_id: Optional[int] = None
    admission_id: Optional[int] = None
    doctor_id: Optional[int] = None
    order_id: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/query", summary="Context-Aware Hybrid RAG Clinical Query")
def query_rag(body: RagQueryRequest, user: dict = Depends(get_current_user)):
    """
    Executes an isolated, context-grounded Hybrid RAG query:
    1. Enforces role-based access control and patient assignment verification.
    2. Expands medical terminology and preserves exact identifiers.
    3. Retrieves authorized clinical records using PostgreSQL full-text and vector similarity.
    4. Applies clinical boosting (verified reports, active admission, final radiologist report).
    5. Synthesizes a grounded answer with citations and clinical safety disclaimers.
    6. Logs an immutable audit trail.
    """
    request_id = str(uuid.uuid4())
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user session: user_id not found.")
    role = str(user.get("role", "")).strip().lower()
    if not role:
        raise HTTPException(status_code=401, detail="Invalid user session: role not found.")

    # Normalize area
    area = body.area.strip().lower()
    if area not in ("patient360", "doctor_workspace", "radiology", "discharge"):
        raise HTTPException(status_code=400, detail=f"Invalid area '{body.area}'. Supported areas: patient360, doctor_workspace, radiology, discharge.")

    # 1. Manage Conversation Session
    conv_id = body.conversation_id
    convo = None
    if conv_id:
        try:
            convo = conversation_service.get_or_validate_conversation(
                conversation_id=conv_id,
                user_id=user_id,
                role=role,
                area=area,
                patient_id=body.patient_id,
                order_id=body.order_id
            )
        except PermissionError as pe:
            raise HTTPException(status_code=403, detail=str(pe))

    if not convo:
        # Create fresh session
        convo = conversation_service.create_conversation(
            user_id=user_id,
            role=role,
            area=area,
            patient_id=body.patient_id,
            admission_id=body.admission_id,
            doctor_id=user.get("doctor_id"),
            order_id=body.order_id
        )
        conv_id = convo["id"]

    # 2. Retrieve Conversation History
    history = conversation_service.get_conversation_history(conv_id, user_id=user_id, limit=5)

    # 3. Query Understanding & Expansion
    expansion = query_expansion_service.expand_query(
        query=body.question,
        area=area,
        role=role,
        patient_id=body.patient_id,
        admission_id=body.admission_id,
        order_id=body.order_id,
        accession_number=body.accession_number,
        conversation_history=history
    )

    # 4. Hybrid Retrieval & Authorization Filtering
    try:
        sources, strategy = search_service.search(
            query=body.question,
            area=area,
            user=user,
            expanded_phrases=expansion.get("search_phrases"),
            patient_id=expansion.get("patient_id"),
            admission_id=expansion.get("admission_id"),
            order_id=expansion.get("order_id"),
            accession_number=expansion.get("accession_number"),
            status_filter=expansion.get("status_filter"),
            limit=body.limit or 8
        )
    except PermissionError as pe:
        audit_service.log_query(
            request_id=request_id,
            user_id=user_id,
            role=role,
            area=area,
            query=body.question,
            expanded_query=expansion,
            retrieval_strategy="unauthorized_denied",
            result_count=0,
            patient_id=body.patient_id,
            admission_id=body.admission_id,
            order_id=body.order_id,
            response_status=403,
            failure_reason=str(pe)
        )
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as exc:
        audit_service.log_query(
            request_id=request_id,
            user_id=user_id,
            role=role,
            area=area,
            query=body.question,
            expanded_query=expansion,
            retrieval_strategy="search_error",
            result_count=0,
            patient_id=body.patient_id,
            admission_id=body.admission_id,
            order_id=body.order_id,
            response_status=500,
            failure_reason=str(exc)
        )
        raise HTTPException(status_code=500, detail=f"Retrieval error: {str(exc)}")

    # 4.1 Output Guardrail: defense-in-depth source scope verification
    sources = _apply_output_guardrail(sources, role)

    # 5. Answer Generation with Safety Grounding & Multilingual Support
    gen_result = generation_service.generate_answer(
        question=body.question,
        area=area,
        role=role,
        sources=sources,
        conversation_history=history,
        patient_context={
            "patient_id": body.patient_id,
            "admission_id": body.admission_id,
            "order_id": body.order_id
        },
        language=body.language or "en",
        language_name=body.language_name or "English"
    )

    # 6. Save User & Assistant Messages
    source_ids = [s["id"] for s in sources]
    conversation_service.add_message(
        conversation_id=conv_id,
        user_id=user_id,
        role=role,
        message_type="user",
        content=body.question
    )
    conversation_service.add_message(
        conversation_id=conv_id,
        user_id=user_id,
        role=role,
        message_type="assistant",
        content=gen_result["answer"],
        source_ids=source_ids
    )

    # 7. Audit Log
    audit_service.log_query(
        request_id=request_id,
        user_id=user_id,
        role=role,
        area=area,
        query=body.question,
        expanded_query=expansion,
        retrieval_strategy=strategy,
        result_count=len(sources),
        source_ids=source_ids,
        patient_id=body.patient_id,
        admission_id=body.admission_id,
        order_id=body.order_id,
        response_status=200
    )

    # 8. Return Response
    return {
        "request_id": request_id,
        "conversation_id": conv_id,
        "answer": gen_result["answer"],
        "confidence": gen_result["confidence"],
        "disclaimer": gen_result["disclaimer"],
        "used_llm": gen_result["used_llm"],
        "strategy": strategy,
        "intent": expansion.get("intent"),
        "expanded_queries": expansion.get("search_phrases"),
        "sources": sources,
        "language": body.language or "en",
        "language_name": body.language_name or "English"
    }


@router.post("/conversations", summary="Create New RAG Conversation Session")
def create_conversation(body: CreateConversationRequest, user: dict = Depends(get_current_user)):
    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user session.")
    role = str(user.get("role", "")).strip().lower()
    conv = conversation_service.create_conversation(
        user_id=user_id,
        role=role,
        area=body.area,
        patient_id=body.patient_id,
        admission_id=body.admission_id,
        doctor_id=user.get("doctor_id"),
        order_id=body.order_id
    )
    return {"status": "success", "conversation": conv}


@router.get("/conversations/{conversation_id}", summary="Get RAG Conversation History")
def get_conversation(conversation_id: str, user: dict = Depends(get_current_user)):
    user_id = user.get("user_id") or 0
    conv = conversation_service.get_full_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation session not found")
    if conv["user_id"] != user_id and str(user.get("role", "")).upper() != "ADMIN":
        raise HTTPException(status_code=403, detail="Access denied to this conversation session.")
    return {"status": "success", "conversation": conv}


# ─────────────────────────────────────────────────────────────────────────────
# REINDEXING ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/reindex/patient/{patient_id}", summary="Incrementally Reindex Patient Clinical Records")
def reindex_patient_endpoint(patient_id: int, user: dict = Depends(require_admin)):
    stats = ingestion_service.reindex_patient(patient_id)
    return {"status": "success", "patient_id": patient_id, "indexed": stats}


@router.post("/reindex/admission/{admission_id}", summary="Incrementally Reindex Admission Records")
def reindex_admission_endpoint(admission_id: int, user: dict = Depends(require_admin)):
    stats = ingestion_service.reindex_admission(admission_id)
    return {"status": "success", "admission_id": admission_id, "indexed": stats}


@router.post("/reindex/radiology-order/{order_id}", summary="Incrementally Reindex Radiology Order & Report")
def reindex_radiology_endpoint(order_id: str, user: dict = Depends(require_admin)):
    stats = ingestion_service.reindex_radiology_order(order_id)
    return {"status": "success", "order_id": order_id, "indexed": stats}


@router.post("/reindex/discharge/{admission_id}", summary="Incrementally Reindex Discharge Readiness")
def reindex_discharge_endpoint(admission_id: int, user: dict = Depends(require_admin)):
    stats = ingestion_service.reindex_discharge(admission_id)
    return {"status": "success", "admission_id": admission_id, "indexed": stats}


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH & OBSERVABILITY ENDPOINT
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/health", summary="RAG System Diagnostics & Observability Health Check")
def rag_health():
    """
    Returns live health diagnostics for:
    - PostgreSQL database connectivity
    - Full-text search index presence
    - pgvector extension availability
    - Embedding adapter status
    - LLM provider status
    - Ingested document counts and breakdown
    - Failed indexing retries count
    """
    conn = None
    db_connected = False
    fts_indexed = False
    pgvector_available = False
    total_docs = 0
    type_breakdown = {}
    failed_indexing_count = 0

    try:
        conn = db_config.get_db_connection()
        db_connected = True
        with conn.cursor() as cur:
            # Check pgvector
            cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector';")
            pgvector_available = cur.fetchone() is not None

            # Check documents count & breakdown
            cur.execute("""
                SELECT document_type, COUNT(*)
                FROM rag_documents
                WHERE is_active = TRUE
                GROUP BY document_type;
            """)
            for row in cur.fetchall():
                type_breakdown[row[0]] = row[1]
                total_docs += row[1]

            # Check FTS indexing
            cur.execute("""
                SELECT 1 FROM pg_indexes
                WHERE tablename = 'rag_documents' AND indexname IN ('idx_rag_docs_tsv', 'idx_rag_search_fts', 'rag_fts');
            """)
            fts_indexed = cur.fetchone() is not None

            # Check failed attempts
            cur.execute("""
                SELECT COUNT(*) FROM rag_documents WHERE embedding_attempts > 0;
            """)
            failed_indexing_count = cur.fetchone()[0]

    except Exception as exc:
        print(f"[RAG HEALTH WARNING] Health check query issue: {exc}")
    finally:
        if conn:
            conn.close()

    emb_status = embedding_service.get_provider_status()
    groq_active = bool(os.getenv("GROQ_API_KEY"))
    openai_active = bool(os.getenv("OPENAI_API_KEY"))

    llm_status = {
        "groq_configured": groq_active,
        "openai_configured": openai_active,
        "active_model": os.getenv("DISCHARGE_LLM_MODEL", "llama-3.3-70b-versatile"),
        "status": "ready" if (groq_active or openai_active) else "fallback_synthesis"
    }

    return {
        "status": "healthy" if db_connected else "degraded",
        "database_connected": db_connected,
        "full_text_indexed": fts_indexed,
        "pgvector_available": pgvector_available,
        "embedding_provider": emb_status,
        "llm_provider": llm_status,
        "total_documents": total_docs,
        "document_type_breakdown": type_breakdown,
        "failed_indexing_count": failed_indexing_count
    }
