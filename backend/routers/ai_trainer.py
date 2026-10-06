"""AG-13 protocol copilot APIs. Protocols are isolated from patient RAG data."""
import os
import re
from datetime import date
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from api.auth_helper import get_current_user
from services import ai_trainer_service as trainer

router = APIRouter(prefix="/api/ai-trainer", tags=["AI Trainer Protocol Copilot"])
STAFF_ROLES = {"admin", "doctor", "nurse", "resident", "resident doctor", "junior nurse", "medical intern", "intern", "hospital management", "ai administrator", "governance officer", "it administrator", "auditor", "pharmacy"}


def require_staff(user=Depends(get_current_user)):
    if str(user.get("role", "")).strip().lower() not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Hospital staff access is required.")
    return user


def require_protocol_admin(user=Depends(get_current_user)):
    # Hospital Management is the app's full-access admin persona; keep this scope local to AG-13.
    role = str(user.get("role", "")).strip().lower()
    if role not in {"admin", "hospital management", "ai administrator", "it administrator"}:
        raise HTTPException(status_code=403, detail="Administrator authorization required.")
    return user


class QueryBody(BaseModel):
    question: str = Field(..., min_length=1, max_length=1500)
    department: str | None = None
    category: str | None = None
    document_id: str | None = None


class MetadataBody(BaseModel):
    title: str | None = None
    version: str | None = None
    department: str | None = None
    category: str | None = None
    status: str | None = None
    approval_status: str | None = None
    effective_date: date | None = None
    review_date: date | None = None
    expiry_date: date | None = None
    supersedes_version: str | None = None
    active: bool | None = None


@router.get("/health")
def health(user=Depends(require_staff)):
    try:
        docs = trainer.list_documents()
        return {"status": "healthy", "documents": len(docs), "knowledge_base": "DEMO", "embedding": trainer.embedding_service.get_provider_status()}
    except Exception:
        raise HTTPException(status_code=503, detail="AI Trainer knowledge store is unavailable.")


@router.post("/query")
def query(body: QueryBody, user=Depends(require_staff)):
    try:
        return trainer.query(body.question, user, department=body.department,
                             category=body.category, document_id=body.document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=503, detail="Protocol search is temporarily unavailable.")


@router.get("/search")
def search(q: str = Query(..., min_length=1, max_length=300), department: str | None = None,
          category: str | None = None, document_id: str | None = None, version: str | None = None,
          status: str | None = None, user=Depends(require_staff)):
    try:
        rows = trainer.search(q, department, category, document_id, version, status)
        return {"results": [{"document_id": r["document_id"], "document_title": r["title"],
                "version": r["version"], "department": r["department"], "category": r["category"],
                "section": r["section_number"], "section_title": r["section_title"], "status": r["status"],
                "snippet": r["content"][:360], "score": r["score"]} for r in rows]}
    except Exception:
        raise HTTPException(status_code=503, detail="Protocol search is temporarily unavailable.")


@router.get("/documents")
def documents(user=Depends(require_staff)):
    try:
        role = str(user.get("role", "")).strip().lower()
        include_inactive = role in {"admin", "hospital management", "ai administrator", "it administrator"}
        return {"documents": trainer.list_documents(include_inactive=include_inactive)}
    except Exception:
        raise HTTPException(status_code=503, detail="Protocol documents are temporarily unavailable.")


@router.get("/documents/{document_id}")
def document(document_id: str, user=Depends(require_staff)):
    try:
        result = trainer.get_document(document_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Protocol source is temporarily unavailable.")
    if not result:
        raise HTTPException(status_code=404, detail="Protocol source not found.")
    return result


@router.post("/documents", status_code=201)
async def upload_document(file: UploadFile = File(...), document_id: str = Form(...), title: str = Form(...),
        version: str = Form("1.0"), department: str = Form(""), category: str = Form(""),
        status: str = Form("DRAFT"), approval_status: str = Form("DRAFT"),
        effective_date: str | None = Form(None), review_date: str | None = Form(None), expiry_date: str | None = Form(None),
        supersedes_version: str | None = Form(None), user=Depends(require_protocol_admin)):
    filename = os.path.basename(file.filename or "upload")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,99}", document_id.strip()):
        raise HTTPException(status_code=400, detail="Document ID may contain letters, numbers, dot, underscore, and hyphen.")
    data = await file.read(trainer.MAX_UPLOAD_BYTES + 1)
    if len(data) > trainer.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the configured upload limit.")
    try:
        text = trainer.extract_file(filename, data)
        if not text.strip():
            raise ValueError("No readable text was found in this file.")
        return trainer.upsert_document({"document_id": document_id,"title": title,"version": version,
            "department": department,"category": category,"status": status,"approval_status": approval_status,
            "effective_date": effective_date or None,"review_date": review_date or None,"expiry_date": expiry_date or None,
            "supersedes_version": supersedes_version,"source_file": filename,"source_text": text},
            uploaded_by=user.get("username") or user.get("user_id"))
    except ValueError as exc:
        try: trainer.record_ingestion_failure(document_id, title, filename, str(exc), user.get("username") or user.get("user_id"), version)
        except Exception: pass
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        try: trainer.record_ingestion_failure(document_id, title, filename, "Parsing or indexing failed. Check the file and database, then retry.", user.get("username") or user.get("user_id"), version)
        except Exception: pass
        raise HTTPException(status_code=503, detail="Document ingestion failed. Check the file and knowledge store, then retry.")


@router.patch("/documents/{document_id}")
def update_document(document_id: str, body: MetadataBody, user=Depends(require_protocol_admin)):
    try:
        if not trainer.update_metadata(document_id, body.model_dump(exclude_none=True)):
            raise HTTPException(status_code=404, detail="Protocol document not found.")
        return {"status": "updated", "document_id": document_id}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/documents/{document_id}/reindex")
def reindex_document(document_id: str, user=Depends(require_protocol_admin)):
    try:
        result = trainer.reindex_document(document_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Document reindexing failed. Check the knowledge store and retry.")
    if not result:
        raise HTTPException(status_code=404, detail="Protocol document not found.")
    return result


@router.get("/audit")
def audit(limit: int = Query(100, ge=1, le=500), user=Depends(require_protocol_admin)):
    try:
        return {"activity": trainer.audit_activity(limit)}
    except Exception:
        raise HTTPException(status_code=503, detail="AI Trainer audit activity is unavailable.")
