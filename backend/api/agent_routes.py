from fastapi import APIRouter, Query, HTTPException, File, Form, UploadFile, Depends, Body
from pydantic import BaseModel
from typing import Optional, List
import sys
import os
import uuid

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import agent.agent_service as agent_service
import agent.response_validator as response_validator
import voice.voice_service as voice_service

router = APIRouter(prefix="/api/agent", tags=["AI Agent"])

class AgentChatRequest(BaseModel):
    conversation_id: str
    patient_id: Optional[str] = None  # Could be patient code (e.g. 'P001') or null
    message: str
    language: Optional[str] = "ENGLISH"
    button_id: Optional[str] = None
    interactive_id: Optional[str] = None

class AgentChatResponse(BaseModel):
    success: bool
    conversation_id: str
    language: str
    intent: str
    response: str
    missing_information: List[str]
    tool_called: Optional[str] = None
    interactive_buttons: Optional[List[dict]] = None
    interactive_type: Optional[str] = None
    list_button_title: Optional[str] = None
    has_welcome_image: Optional[bool] = None
    welcome_image: Optional[str] = None

@router.post("/chat", response_model=AgentChatResponse)
def agent_chat_endpoint(payload: AgentChatRequest):
    try:
        # If payload.patient_id is provided, check if it is a patient code or user ID
        # Pass payload.message and conversation_id to process_agent_message
        btn = payload.button_id or payload.interactive_id
        res = agent_service.process_agent_message(
            conversation_code=payload.conversation_id,
            patient_code=payload.patient_id,
            message_text=payload.message,
            language_override=payload.language,
            interactive_id=btn
        )
        res = response_validator.normalize_interactive_type(res)
        return AgentChatResponse(
            success=res["success"],
            conversation_id=res["conversation_id"],
            language=res["language"],
            intent=res["intent"],
            response=res["response"],
            missing_information=res["missing_information"],
            tool_called=res["tool_called"],
            interactive_buttons=res.get("interactive_buttons"),
            interactive_type=res.get("interactive_type"),
            list_button_title=res.get("list_button_title"),
            has_welcome_image=res.get("has_welcome_image"),
            welcome_image=res.get("welcome_image")
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class VoiceProcessResponse(BaseModel):
    success: bool
    transcript: str
    language: str
    response_text: str
    audio: str
    intent: str
    missing_information: List[str]
    tool_called: Optional[str] = None

@router.post("/voice/process", response_model=VoiceProcessResponse)
async def voice_process_endpoint(
    audio: UploadFile = File(...),
    session_id: str = Form(...),
    patient_code: Optional[str] = Form(None),
    language: Optional[str] = Form(None)
):
    # Validate MIME type (must be audio file)
    if audio.content_type and not audio.content_type.startswith("audio/") and not audio.filename.endswith((".wav", ".mp3", ".ogg", ".m4a", ".webm")):
        raise HTTPException(status_code=400, detail="Invalid file type. Only audio files are accepted.")
    
    # Write incoming stream to temp file in scratch directory
    scratch_dir = os.path.join(backend_dir, "scratch")
    os.makedirs(scratch_dir, exist_ok=True)
    
    # Save file with extension preserved
    ext = os.path.splitext(audio.filename)[1] or ".wav"
    temp_file_name = f"upload_{uuid.uuid4().hex}{ext}"
    temp_file_path = os.path.join(scratch_dir, temp_file_name)
    
    try:
        # Validate size: limit to 15MB
        size = 0
        with open(temp_file_path, "wb") as buffer:
            while chunk := await audio.read(1024 * 1024):  # 1MB chunks
                size += len(chunk)
                if size > 15 * 1024 * 1024:
                    raise HTTPException(status_code=400, detail="Audio file too large. Maximum size is 15MB.")
                buffer.write(chunk)
        
        # Run speech-to-text -> Agent -> text-to-speech workflow
        res = voice_service.process_voice_input(
            audio_file_path=temp_file_path,
            session_id=session_id,
            patient_code=patient_code,
            language_override=language
        )
        
        if not res["success"]:
            raise HTTPException(status_code=500, detail=res.get("error", "Voice processing failed"))
            
        return VoiceProcessResponse(
            success=True,
            transcript=res["transcript"],
            language=res["language"],
            response_text=res["response_text"],
            audio=res["audio"],
            intent=res["intent"],
            missing_information=res["missing_information"],
            tool_called=res["tool_called"]
        )
    except HTTPException:
        # Re-raise standard HTTP exceptions
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temporary upload file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass



# ─── Knowledge Base API ────────────────────────────────────────────────────────

class KnowledgeSearchRequest(BaseModel):
    query: str
    language: Optional[str] = "ENGLISH"
    category: Optional[str] = None   # e.g. "DEPARTMENT", "OPD_TIMING", "PRE_ADMISSION"
    top_k: Optional[int] = 3

class KnowledgeSearchResult(BaseModel):
    category: str
    title: str
    content: str
    score: float
    source: Optional[str] = None
    document_id: Optional[int] = None
    chunk_id: Optional[int] = None

class KnowledgeSearchResponse(BaseModel):
    success: bool
    query: str
    results: List[KnowledgeSearchResult]
    total: int

knowledge_router = APIRouter(prefix="/api/knowledge", tags=["Knowledge Base"])

@knowledge_router.post("/search", response_model=KnowledgeSearchResponse)
def knowledge_search_endpoint(payload: KnowledgeSearchRequest):
    """
    Search the Meridian Hospital knowledge base.
    Returns relevant knowledge chunks ranked by relevance score.
    Internal API — not exposed to patient UI.
    """
    try:
        import knowledge.knowledge_retriever as knowledge_retriever
        results = knowledge_retriever.search(
            query=payload.query,
            language=payload.language or "ENGLISH",
            category_hint=payload.category,
            top_k=payload.top_k or 3
        )
        return KnowledgeSearchResponse(
            success=True,
            query=payload.query,
            results=[
                KnowledgeSearchResult(
                    category=r["category"],
                    title=r["title"],
                    content=r["content"],
                    score=r["score"],
                    source=r.get("source"),
                    document_id=r.get("document_id"),
                    chunk_id=r.get("chunk_id")
                )
                for r in results
            ],
            total=len(results)
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Dynamic Agent Configuration API ─────────────────────────────────────────────
import json
import db_config
from api.auth_helper import get_current_user

class AgentConfigPayload(BaseModel):
    agent_id: str
    name: Optional[str] = None
    name_ta: Optional[str] = None
    type: Optional[str] = None
    version: Optional[str] = None
    owner: Optional[str] = None
    risk_tier: Optional[str] = None
    status: Optional[str] = None
    human_approval: Optional[str] = None
    purpose: Optional[str] = None
    instructions: Optional[dict] = None
    tools: Optional[list] = None
    knowledge: Optional[list] = None
    memory: Optional[dict] = None
    access: Optional[dict] = None
    model: Optional[dict] = None
    evals: Optional[list] = None
    versions: Optional[list] = None
    managed_state: Optional[str] = None


def ensure_agent_config_table():
    try:
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS agent_configurations (
                agent_id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                name_ta VARCHAR(255),
                type VARCHAR(100) NOT NULL DEFAULT 'Monitor',
                version VARCHAR(50) NOT NULL DEFAULT '1.2.0',
                owner VARCHAR(100) NOT NULL DEFAULT 'Quality',
                risk_tier VARCHAR(50) NOT NULL DEFAULT 'Medium',
                status VARCHAR(50) NOT NULL DEFAULT 'Published',
                human_approval VARCHAR(100) DEFAULT 'Selective',
                purpose TEXT,
                instructions JSONB,
                tools JSONB,
                knowledge JSONB,
                memory JSONB,
                access JSONB,
                model JSONB,
                evals JSONB,
                versions JSONB,
                managed_state VARCHAR(100) DEFAULT 'Configurable • Dynamic',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        conn.commit()

        cur.execute("SELECT COUNT(*) FROM agent_configurations WHERE agent_id = 'AG-05';")
        if cur.fetchone()[0] == 0:
            ag05_default = {
                "agent_id": "AG-05",
                "name": "Feedback Agent",
                "name_ta": "கருத்து & குறைதீர்ப்பு முகவர்",
                "type": "Monitor",
                "version": "1.2.0",
                "owner": "Quality",
                "risk_tier": "Medium",
                "status": "Published",
                "human_approval": "Selective • owner Quality",
                "purpose": "Assist Quality with feedback tasks under human oversight.",
                "instructions": {
                    "objective": "Reduce turnaround and manual coordination for Quality.",
                    "system": "You are the Hospital Feedback Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.",
                    "rules": "Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.",
                    "safety": "Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.",
                    "escalation": "Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.",
                    "refusal": "\"I don't have enough verified information to answer this safely.\" then route to a human."
                },
                "tools": [
                    { "tool": "Messaging", "perm": "Collect patient sentiment & feedback", "read": True, "write": True, "appr": "None", "enabled": True },
                    { "tool": "Notification", "perm": "Trigger grievance escalation timer", "read": False, "write": True, "appr": "Quality Lead", "enabled": True }
                ],
                "knowledge": [
                    { "t": "NABH Patient Rights Charter", "v": "1.0", "eff": "01 Feb 2026", "status": "Published" }
                ],
                "memory": {
                    "session": "On · 30 min",
                    "patient": "Encounter-scoped",
                    "workflow": "On",
                    "retention": "90 days (audit) · 0 days (conversation)",
                    "sensitive": "No free-text PHI stored"
                },
                "access": {
                    "roles": "Quality, Hospital Management, Admin",
                    "departments": "All wards",
                    "patients": "Care-team relationship required",
                    "scopes": "Operational + financial (no clinical write)",
                    "env": "Production"
                },
                "model": {
                    "model": "meridian-llm-large",
                    "temperature": 0.2,
                    "tokens": 8000,
                    "fallback": "meridian-llm-small",
                    "latency": "< 3 s p50",
                    "cost": "₹18 / run"
                },
                "evals": [
                    { "id": "EV-705", "ver": "v1.2.0", "when": "08 Sep 2026", "cases": 110, "acc": "91.7%", "ground": "95.2%", "hall": "0.6%", "ref": "97%", "lat": "2.1s", "res": "Pass" }
                ],
                "versions": [
                    { "v": "1.2.0", "ts": "21 days ago", "author": "Clinical Informatics", "changes": "Prompt safety hardening", "score": "91.7", "state": "Published", "bg": "#dcfce7", "fg": "#15803d" },
                    { "v": "1.0.0", "ts": "55 days ago", "author": "AI Engineering", "changes": "Initial release", "score": "88.4", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569" }
                ],
                "managed_state": "Configurable • Dynamic"
            }

            cur.execute("""
                INSERT INTO agent_configurations (
                    agent_id, name, name_ta, type, version, owner, risk_tier, status,
                    human_approval, purpose, instructions, tools, knowledge, memory, access,
                    model, evals, versions, managed_state
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                ag05_default["agent_id"], ag05_default["name"], ag05_default["name_ta"],
                ag05_default["type"], ag05_default["version"], ag05_default["owner"],
                ag05_default["risk_tier"], ag05_default["status"], ag05_default["human_approval"],
                ag05_default["purpose"], json.dumps(ag05_default["instructions"]),
                json.dumps(ag05_default["tools"]), json.dumps(ag05_default["knowledge"]),
                json.dumps(ag05_default["memory"]), json.dumps(ag05_default["access"]),
                json.dumps(ag05_default["model"]), json.dumps(ag05_default["evals"]),
                json.dumps(ag05_default["versions"]), ag05_default["managed_state"]
            ))
            conn.commit()

        cur.close()
        conn.close()
    except Exception as e:
        print(f"[AGENT_CONFIG_INIT_ERR] {e}")


@router.get("/config/{agent_id}", summary="Get dynamic Agent Configuration")
def get_agent_config(agent_id: str):
    ensure_agent_config_table()
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT agent_id, name, name_ta, type, version, owner, risk_tier, status,
                   human_approval, purpose, instructions, tools, knowledge, memory, access,
                   model, evals, versions, managed_state, updated_at
            FROM agent_configurations
            WHERE UPPER(agent_id) = UPPER(%s);
        """, (agent_id,))
        row = cur.fetchone()

        if not row:
            # If not found in DB, return empty or fallback
            return {
                "success": False,
                "message": f"Agent {agent_id} configuration not found in database."
            }

        def parse_json(field):
            if isinstance(field, (dict, list)):
                return field
            try:
                return json.loads(field) if field else {}
            except Exception:
                return {}

        return {
            "success": True,
            "data": {
                "id": row[0],
                "agent_id": row[0],
                "name": row[1],
                "nameTa": row[2],
                "type": row[3],
                "v": row[4],
                "version": row[4],
                "owner": row[5],
                "tier": row[6],
                "risk_tier": row[6],
                "status": row[7],
                "humanApproval": row[8],
                "purpose": row[9],
                "instructions": parse_json(row[10]),
                "tools": parse_json(row[11]),
                "knowledge": parse_json(row[12]),
                "memory": parse_json(row[13]),
                "access": parse_json(row[14]),
                "model": parse_json(row[15]),
                "evals": parse_json(row[16]),
                "versions": parse_json(row[17]),
                "managedState": row[18],
                "updated_at": row[19].isoformat() if row[19] else None
            }
        }
    finally:
        cur.close()
        conn.close()


@router.put("/config/{agent_id}", summary="Save dynamic Agent Configuration")
def save_agent_config(
    agent_id: str,
    payload: AgentConfigPayload,
    user: dict = Depends(get_current_user)
):
    ensure_agent_config_table()

    # Validation
    if payload.type and payload.type not in ("Workflow Agent", "Answerer", "Monitor", "Task Agent"):
        raise HTTPException(status_code=400, detail=f"Invalid agent type: {payload.type}")
    if payload.risk_tier and payload.risk_tier not in ("Low", "Medium", "High", "Critical"):
        raise HTTPException(status_code=400, detail=f"Invalid risk tier: {payload.risk_tier}")
    if payload.status and payload.status not in ("Draft", "Published", "Archived"):
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor()

        # Check existing row
        cur.execute("SELECT agent_id FROM agent_configurations WHERE UPPER(agent_id) = UPPER(%s);", (agent_id,))
        exists = cur.fetchone()

        if exists:
            cur.execute("""
                UPDATE agent_configurations SET
                    name = COALESCE(%s, name),
                    name_ta = COALESCE(%s, name_ta),
                    type = COALESCE(%s, type),
                    version = COALESCE(%s, version),
                    owner = COALESCE(%s, owner),
                    risk_tier = COALESCE(%s, risk_tier),
                    status = COALESCE(%s, status),
                    human_approval = COALESCE(%s, human_approval),
                    purpose = COALESCE(%s, purpose),
                    instructions = COALESCE(%s::jsonb, instructions),
                    tools = COALESCE(%s::jsonb, tools),
                    knowledge = COALESCE(%s::jsonb, knowledge),
                    memory = COALESCE(%s::jsonb, memory),
                    access = COALESCE(%s::jsonb, access),
                    model = COALESCE(%s::jsonb, model),
                    evals = COALESCE(%s::jsonb, evals),
                    versions = COALESCE(%s::jsonb, versions),
                    managed_state = COALESCE(%s, managed_state),
                    updated_at = NOW()
                WHERE UPPER(agent_id) = UPPER(%s);
            """, (
                payload.name, payload.name_ta, payload.type, payload.version,
                payload.owner, payload.risk_tier, payload.status, payload.human_approval,
                payload.purpose,
                json.dumps(payload.instructions) if payload.instructions is not None else None,
                json.dumps(payload.tools) if payload.tools is not None else None,
                json.dumps(payload.knowledge) if payload.knowledge is not None else None,
                json.dumps(payload.memory) if payload.memory is not None else None,
                json.dumps(payload.access) if payload.access is not None else None,
                json.dumps(payload.model) if payload.model is not None else None,
                json.dumps(payload.evals) if payload.evals is not None else None,
                json.dumps(payload.versions) if payload.versions is not None else None,
                payload.managed_state,
                agent_id
            ))
        else:
            cur.execute("""
                INSERT INTO agent_configurations (
                    agent_id, name, name_ta, type, version, owner, risk_tier, status,
                    human_approval, purpose, instructions, tools, knowledge, memory, access,
                    model, evals, versions, managed_state
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                agent_id, payload.name or "Agent", payload.name_ta or "",
                payload.type or "Monitor", payload.version or "1.0.0", payload.owner or "Quality",
                payload.risk_tier or "Medium", payload.status or "Published",
                payload.human_approval or "Selective", payload.purpose or "",
                json.dumps(payload.instructions or {}), json.dumps(payload.tools or []),
                json.dumps(payload.knowledge or []), json.dumps(payload.memory or {}),
                json.dumps(payload.access or {}), json.dumps(payload.model or {}),
                json.dumps(payload.evals or []), json.dumps(payload.versions or []),
                payload.managed_state or "Configurable • Dynamic"
            ))

        conn.commit()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

    # Re-read freshly saved config
    return get_agent_config(agent_id)


@router.post("/config/{agent_id}/publish", summary="Publish new Agent version")
def publish_agent_version(
    agent_id: str,
    payload: dict = Body(...),
    user: dict = Depends(get_current_user)
):
    current = get_agent_config(agent_id)
    if not current.get("success"):
        raise HTTPException(status_code=404, detail="Agent not found")

    ag_data = current["data"]
    new_v = payload.get("version")
    if not new_v:
        # Increment patch
        parts = ag_data.get("v", "1.2.0").split(".")
        if len(parts) == 3 and parts[2].isdigit():
            parts[2] = str(int(parts[2]) + 1)
            new_v = ".".join(parts)
        else:
            new_v = "1.3.0"

    existing_versions = ag_data.get("versions") or []
    new_version_entry = {
        "v": new_v,
        "ts": "Just now",
        "author": user.get("full_name") or user.get("username") or "Admin",
        "changes": payload.get("changes", "Updated configuration and published version"),
        "score": ag_data.get("evals", [{}])[0].get("acc", "95.0%") if ag_data.get("evals") else "95.0%",
        "state": "Published",
        "bg": "#dcfce7",
        "fg": "#15803d"
    }

    updated_versions = [new_version_entry] + existing_versions

    save_payload = AgentConfigPayload(
        agent_id=agent_id,
        version=new_v,
        status="Published",
        versions=updated_versions
    )

    return save_agent_config(agent_id, save_payload, user)


@router.post("/config/{agent_id}/playground", summary="Run test prompt in Playground")
def run_agent_playground(
    agent_id: str,
    payload: dict = Body(...),
    user: dict = Depends(get_current_user)
):
    prompt_text = payload.get("prompt", "")
    if not prompt_text.strip():
        raise HTTPException(status_code=400, detail="Prompt text cannot be empty")

    res = agent_service.process_agent_message(
        conversation_code=f"PLAYGROUND_{agent_id}",
        patient_code=None,
        message_text=prompt_text
    )

    return {
        "success": True,
        "agent_id": agent_id,
        "prompt": prompt_text,
        "intent": res.get("intent"),
        "response": res.get("response"),
        "tool_called": res.get("tool_called"),
        "missing_information": res.get("missing_information", [])
    }

