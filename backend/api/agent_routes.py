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
    last_run: Optional[str] = None
    success_rate: Optional[str] = None
    runs: Optional[int] = None


# Shared INSERT helper so seed blocks stay DRY
def _insert_agent_seed(cur, ag):
    cur.execute("""
        INSERT INTO agent_configurations (
            agent_id, name, name_ta, type, version, owner, risk_tier, status,
            human_approval, purpose, instructions, tools, knowledge, memory, access,
            model, evals, versions, managed_state, last_run, success_rate, runs
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (agent_id) DO NOTHING;
    """, (
        ag["agent_id"], ag["name"], ag.get("name_ta", ""),
        ag["type"], ag["version"], ag["owner"],
        ag["risk_tier"], ag["status"], ag["human_approval"],
        ag["purpose"],
        json.dumps(ag["instructions"]), json.dumps(ag["tools"]),
        json.dumps(ag["knowledge"]), json.dumps(ag["memory"]),
        json.dumps(ag["access"]), json.dumps(ag["model"]),
        json.dumps(ag["evals"]), json.dumps(ag["versions"]),
        ag["managed_state"],
        ag.get("last_run"), ag.get("success_rate"), ag.get("runs")
    ))


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

        # Add optional observability columns idempotently
        for col_sql in [
            "ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS last_run VARCHAR(50);",
            "ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS success_rate VARCHAR(20);",
            "ALTER TABLE agent_configurations ADD COLUMN IF NOT EXISTS runs INTEGER DEFAULT 0;",
        ]:
            try:
                cur.execute(col_sql)
                conn.commit()
            except Exception:
                conn.rollback()

        # ── AG-01  Appointment Agent ──────────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-01",
            "name": "Appointment Agent",
            "name_ta": "சந்திப்பு முன்பதிவு முகவர்",
            "type": "Workflow Agent",
            "version": "2.3.1",
            "owner": "Front Office",
            "risk_tier": "Low",
            "status": "Published",
            "human_approval": "None",
            "purpose": "Assist Front Office with appointment tasks under human oversight.",
            "last_run": "11:19",
            "success_rate": "96.8%",
            "runs": 412,
            "instructions": {
                "objective": "Reduce turnaround and manual coordination for Front Office.",
                "system": "You are the Hospital Appointment Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.",
                "rules": "Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.",
                "safety": "Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.",
                "escalation": "Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.",
                "refusal": "\"I don't have enough verified information to answer this safely.\" then route to a human."
            },
            "tools": [
                {"tool": "Patient Search", "perm": "Lookup patient UHID & demographics", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Appointment API", "perm": "Query OPD schedules & book slots", "read": True, "write": True, "appr": "None", "enabled": True},
                {"tool": "Messaging", "perm": "Send WhatsApp / SMS confirmation", "read": True, "write": True, "appr": "None", "enabled": True}
            ],
            "knowledge": [
                {"t": "Visiting Hours & Attendant Policy", "v": "2.0", "eff": "01 Jun 2026", "status": "Published"},
                {"t": "NABH Patient Rights Charter", "v": "1.0", "eff": "01 Feb 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Encounter-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "Front Office, Hospital Management", "departments": "All wards", "patients": "Care-team relationship required", "scopes": "Operational + financial (no clinical write)", "env": "Production"},
            "model": {"model": "meridian-llm-large", "temperature": 0.2, "tokens": 8000, "fallback": "meridian-llm-small", "latency": "< 3 s p50", "cost": "₹14 / run"},
            "evals": [
                {"id": "EV-701", "ver": "v2.3.1", "when": "Today 11:15", "cases": 120, "acc": "96.8%", "ground": "98.0%", "hall": "0.4%", "ref": "99%", "lat": "1.6s", "res": "Pass"},
                {"id": "EV-640", "ver": "v2.0.0", "when": "18 Aug 2026", "cases": 100, "acc": "94.5%", "ground": "96.2%", "hall": "0.8%", "ref": "98%", "lat": "1.8s", "res": "Pass"}
            ],
            "versions": [
                {"v": "2.3.1", "ts": "21 days ago", "author": "AI Engineering", "changes": "Escalation tuning", "score": "96.8", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"},
                {"v": "2.0.0", "ts": "41 days ago", "author": "Ops Product", "changes": "Added escalation rules", "score": "94.5", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569"},
                {"v": "1.0.0", "ts": "61 days ago", "author": "Clinical Informatics", "changes": "Initial release", "score": "91.2", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-02  Patient Access Agent ───────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-02",
            "name": "Patient Access Agent",
            "name_ta": "நோயாளி தொடர்பு முகவர்",
            "type": "Answerer",
            "version": "1.8.0",
            "owner": "Patient Experience",
            "risk_tier": "Low",
            "status": "Published",
            "human_approval": "None",
            "purpose": "Assist Patient Experience with patient access tasks under human oversight.",
            "last_run": "11:18",
            "success_rate": "95.1%",
            "runs": 380,
            "instructions": {
                "objective": "Reduce turnaround and manual coordination for Patient Experience.",
                "system": "You are the Hospital Patient Access Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.",
                "rules": "Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.",
                "safety": "Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.",
                "escalation": "Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.",
                "refusal": "\"I don't have enough verified information to answer this safely.\" then route to a human."
            },
            "tools": [
                {"tool": "Patient Search", "perm": "Lookup patient registration context", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Messaging", "perm": "Provide bilingual WhatsApp guidance", "read": True, "write": True, "appr": "None", "enabled": True}
            ],
            "knowledge": [
                {"t": "Visiting Hours & Attendant Policy", "v": "2.0", "eff": "01 Jun 2026", "status": "Published"},
                {"t": "NABH Patient Rights Charter", "v": "1.0", "eff": "01 Feb 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Encounter-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "Patient Experience, Hospital Management", "departments": "All wards", "patients": "Care-team relationship required", "scopes": "Operational + financial (no clinical write)", "env": "Production"},
            "model": {"model": "meridian-llm-large", "temperature": 0.2, "tokens": 8000, "fallback": "meridian-llm-small", "latency": "< 3 s p50", "cost": "₹12 / run"},
            "evals": [
                {"id": "EV-702", "ver": "v1.8.0", "when": "Today 11:10", "cases": 140, "acc": "95.1%", "ground": "97.5%", "hall": "0.3%", "ref": "100%", "lat": "1.9s", "res": "Pass"}
            ],
            "versions": [
                {"v": "1.8.0", "ts": "21 days ago", "author": "AI Engineering", "changes": "Prompt safety hardening", "score": "95.1", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"},
                {"v": "1.0.0", "ts": "61 days ago", "author": "Ops Product", "changes": "Initial release", "score": "92.0", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-03  Pre-registration Agent ─────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-03",
            "name": "Pre-registration Agent",
            "name_ta": "முன்-பதிவு முகவர்",
            "type": "Workflow Agent",
            "version": "1.4.2",
            "owner": "Front Office",
            "risk_tier": "Low",
            "status": "Published",
            "human_approval": "None",
            "purpose": "Assist Front Office with pre-registration tasks under human oversight.",
            "last_run": "11:12",
            "success_rate": "97.4%",
            "runs": 96,
            "instructions": {
                "objective": "Reduce turnaround and manual coordination for Front Office.",
                "system": "You are the Hospital Pre-registration Agent. Operate only on the patient/workflow context provided. Cite sources. Never diagnose, prescribe, triage or sign.",
                "rules": "Use Tamil when the patient language is Tamil. Prefer structured outputs. Log every tool call.",
                "safety": "Refuse clinical interpretation. Do not release bills, sign documents or submit to insurers. Mask PHI outside the care team.",
                "escalation": "Escalate to the human owner when confidence < 70%, a tool fails twice, or an SLA is breached.",
                "refusal": "\"I don't have enough verified information to answer this safely.\" then route to a human."
            },
            "tools": [
                {"tool": "Patient Search", "perm": "Validate UHID / KYC credentials", "read": True, "write": True, "appr": "None", "enabled": True},
                {"tool": "Appointment API", "perm": "Verify upcoming OPD slot", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Document Generator", "perm": "Generate provisional digital pass", "read": True, "write": True, "appr": "None", "enabled": True}
            ],
            "knowledge": [
                {"t": "NABH Patient Rights Charter", "v": "1.0", "eff": "01 Feb 2026", "status": "Published"},
                {"t": "Visiting Hours & Attendant Policy", "v": "2.0", "eff": "01 Jun 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Encounter-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "Front Office, Hospital Management", "departments": "All wards", "patients": "Care-team relationship required", "scopes": "Operational + financial (no clinical write)", "env": "Production"},
            "model": {"model": "meridian-llm-large", "temperature": 0.2, "tokens": 8000, "fallback": "meridian-llm-small", "latency": "< 3 s p50", "cost": "₹15 / run"},
            "evals": [
                {"id": "EV-703", "ver": "v1.4.2", "when": "Yesterday 17:00", "cases": 80, "acc": "97.4%", "ground": "98.5%", "hall": "0.1%", "ref": "100%", "lat": "1.5s", "res": "Pass"}
            ],
            "versions": [
                {"v": "1.4.2", "ts": "21 days ago", "author": "AI Engineering", "changes": "Tamil output", "score": "97.4", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"},
                {"v": "1.0.0", "ts": "50 days ago", "author": "Ops Product", "changes": "Initial release", "score": "93.8", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        # ── AG-04  Employee Service Agent ────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-04",
            "name": "Employee Service Agent",
            "name_ta": "பணியாளர் சேவை முகவர்",
            "type": "Internal Staff Chatbot",
            "version": "1.7.0",
            "owner": "HR Operations & Clinical Directorate",
            "risk_tier": "Low",
            "status": "Published",
            "human_approval": "None",
            "purpose": "Provide 24/7 conversational assistance to hospital doctors, nurses, technicians, and staff for shift timings, duty rosters, leave & comp-off balance ledger queries, and leave filings with live PostgreSQL grounding.",
            "last_run": "10:20 AM",
            "success_rate": "98.5%",
            "runs": 842,
            "instructions": {
                "objective": "Automate employee self-service inquiries for shift timing, duty rosters, leave balance tracking, and leave filings with 100% verified PostgreSQL roster grounding.",
                "system": "You are the Hospital Employee Service Agent (AG-04 · பணியாளர் சேவை முகவர்). Provide conversational HR and roster assistance to hospital staff (doctors, nurses, technicians, admin). Query PostgreSQL tables (staff_rosters, employee_leave_balances, employee_leave_requests) to fetch accurate shift schedules, reconcile leave quotas (Comp-off, Casual, Sick, Earned), apply leaves, and cite authoritative hospital HR policies. Never provide clinical medical advice or diagnose patients.",
                "rules": "Present duty shifts clearly with date, duty hours (e.g., Morning 07:00 AM - 03:00 PM), department/ward, and on-call status. Display leave balances in itemized format with available quotas. Support bilingual English and Tamil (தமிழ்) responses. Record all leave filings with timestamp and supervisor routing.",
                "safety": "Strictly restricted to internal hospital employee operations. Refuse patient clinical queries, medication advice, or prescription modifications. Mask employee salaries and confidential HR disciplinary records. Ensure leave filings check ward nursing coverage rules.",
                "escalation": "Escalate shift clashes, emergency leave rejections, or policy disputes to the HR Operations Head (ext. 4401) and Ward Nursing Supervisor.",
                "refusal": "I cannot answer medical or patient-care queries. I am your Employee Service Agent for HR and duty schedules. For patient care, please use clinical copilot or consult attending physician."
            },
            "tools": [
                {"tool": "PostgreSQL Roster Engine", "perm": "Query live duty rosters, shift timings & on-call schedules from staff_rosters", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Leave Balance Ledger", "perm": "Fetch employee leave balances (Casual, Sick, Comp-off, Earned)", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Leave Filing Engine", "perm": "Create and submit new leave requests into employee_leave_requests", "read": True, "write": True, "appr": "Supervisor", "enabled": True},
                {"tool": "HR Policy v5.0 Knowledge Engine", "perm": "Search hospital HR policies, shift allowances & benefits", "read": True, "write": False, "appr": "None", "enabled": True}
            ],
            "knowledge": [
                {"t": "HR Leave & Attendance Policy v5.0", "v": "5.0", "eff": "01 Jan 2026", "status": "Published"},
                {"t": "Nursing Shift Allowance & Roster SOP", "v": "3.2", "eff": "15 Mar 2026", "status": "Published"},
                {"t": "Employee Health & Dependent Medical Benefit Scheme", "v": "2.4", "eff": "01 Jun 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Staff-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "HR, Hospital Management, Doctors, Nurses, Technicians, Admin", "departments": "All Wards, ICUs, Labs, OT, Admin", "patients": "Staff-scoped", "scopes": "Operational HR read/write", "env": "Production"},
            "model": {"model": "meridian-llm-large", "temperature": 0.2, "tokens": 8000, "fallback": "meridian-llm-small", "latency": "< 1.5 s p50", "cost": "₹4 / run"},
            "evals": [
                {"id": "EV-704", "ver": "v1.7.0", "when": "Today 09:30", "cases": 180, "acc": "98.5%", "ground": "99.2%", "hall": "0.1%", "ref": "100%", "lat": "1.2s", "res": "Pass"},
                {"id": "EV-650", "ver": "v1.6.0", "when": "15 Sep 2026", "cases": 120, "acc": "95.8%", "ground": "97.4%", "hall": "0.3%", "ref": "99%", "lat": "1.4s", "res": "Pass"}
            ],
            "versions": [
                {"v": "1.7.0", "ts": "Today", "author": "AI Engineering", "changes": "Added live PostgreSQL staff_rosters sync and bilingual Tamil HR response templates", "score": "98.5", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"},
                {"v": "1.6.0", "ts": "21 days ago", "author": "HR Ops", "changes": "Added leave balance ledger integration", "score": "95.8", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-05  Feedback Agent ─────────────────────────────────────────────
        _insert_agent_seed(cur, {
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
            "last_run": "11:15",
            "success_rate": "91.7%",
            "runs": 240,
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
        })

        # ── AG-06  Queue / Flow Agent ─────────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-06",
            "name": "Queue / Flow Agent",
            "name_ta": "வரிசை நிர்வாக முகவர்",
            "type": "Monitor & Dispatcher",
            "version": "1.0.0",
            "owner": "Outpatient Operations",
            "risk_tier": "Low",
            "status": "Published",
            "human_approval": "Automated • deterministic rules",
            "purpose": "Monitor OPD queues, calculate tokens/ETA, and dispatch WhatsApp notifications.",
            "last_run": "Just now",
            "success_rate": "99.8%",
            "runs": 1500,
            "instructions": {
                "objective": "Provide real-time OPD queue status updates and minimize patient waiting room congestion.",
                "system": "You are the AG-06 Queue / Flow Agent for Meridian Hospital. All queue facts (tokens, positions, ETAs) are computed deterministically by PostgreSQL.",
                "rules": "Never guess or compute tokens/positions using LLM. Respect patient's preferred language. Idempotency is strictly enforced.",
                "safety": "Do not alter clinical triage or priority without doctor/admin action.",
                "escalation": "Escalate doctor delays exceeding 15 minutes to Outpatient Nursing Lead.",
                "refusal": "\"Queue information unavailable.\" then route to front desk."
            },
            "tools": [
                { "tool": "QueueEngine", "perm": "Calculate token, position, ETA", "read": True, "write": True, "appr": "None", "enabled": True },
                { "tool": "WhatsAppNotification", "perm": "Send queue updates via WhatsApp", "read": False, "write": True, "appr": "None", "enabled": True }
            ],
            "knowledge": [
                { "t": "Meridian OPD Queue SOP", "v": "2.0", "eff": "01 Jan 2026", "status": "Published" }
            ],
            "memory": {
                "session": "On • Queue Session scoped",
                "patient": "Token-scoped",
                "workflow": "On",
                "retention": "30 days (audit logs)",
                "sensitive": "No clinical data stored"
            },
            "access": {
                "roles": "Front Desk, Outpatient Wards, Admin, Doctors",
                "departments": "All Outpatient Departments",
                "patients": "Checked-in OPD Patients",
                "scopes": "Queue session management & notifications",
                "env": "Production"
            },
            "model": {
                "model": "meridian-llm-small",
                "temperature": 0.1,
                "tokens": 4000,
                "fallback": "rule-based-engine",
                "mode": "Deterministic + Multilingual Templates"
            },
            "evals": [
                { "id": "EV-801", "ver": "v1.0.0", "when": "07 Oct 2026", "cases": 150, "acc": "99.8%", "ground": "100%", "hall": "0.0%", "ref": "100%", "lat": "45ms", "res": "Pass" }
            ],
            "versions": [
                { "v": "1.0.0", "ts": "Today", "author": "Outpatient Engineering", "changes": "Initial production release of AG-06 Queue Agent", "score": "99.8", "state": "Published", "bg": "#dcfce7", "fg": "#15803d" }
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-07  Insurance Preauth Agent ────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-07",
            "name": "Insurance Preauth Agent",
            "name_ta": "காப்பீட்டு முன்அனுமதி முகவர்",
            "type": "Workflow & Decision Agent",
            "version": "2.4.0",
            "owner": "Insurance Desk & TPA Liaison",
            "risk_tier": "High",
            "status": "Published",
            "human_approval": "Selective • Insurance Lead",
            "purpose": "Autonomously assemble structured Pre-Authorization Submission Dossiers with bilingual clinical justifications, package estimates, and denial risk assessments for TPA / Insurer review.",
            "last_run": "Just now",
            "success_rate": "97.6%",
            "runs": 620,
            "instructions": {
                "objective": "Autonomously assemble structured Pre-Authorization Submission Dossiers for TPA & insurer review with 100% verified EMR grounding and bilingual justifications.",
                "system": "You are the Hospital Insurance Preauth Agent (AG-07 / காப்பீட்டு முன்அனுமதி முகவர்). Your duty is to autonomously assemble a complete, structured Preauth Submission Dossier for TPA/Insurance review. You must generate bilingual clinical justifications in English and Tamil (தமிழ்). Keep clinical justifications structured, crisp, and easily readable with clear distinct points (Presentation & Indication, Risk & Monitoring, Medical Necessity & Interventions, Expected Outcomes) separated by line breaks. Calculate checklist verification, medical necessity justification, itemized billing summary, and denial risk breakdown. Output MUST be valid JSON matching the requested structure.",
                "rules": "Generate bilingual clinical justifications in English and Tamil (தமிழ்). Structure clinical justification points by Indication, Risk, Interventions, and Outcomes. Calculate itemized billing breakdown and denial risk assessment. Strict JSON schema output.",
                "safety": "Refuse clinical diagnosis changes or unauthorized procedure codes. Ground all medical justifications strictly on attending physician notes. Mask sensitive patient identifiers for external review.",
                "escalation": "Escalate claims with denial risk > 35% or missing doctor signature to Senior TPA Liaison (L. Fathima) and Attending Physician.",
                "refusal": "Insufficient clinical EMR evidence to formulate an authorized pre-authorization request safely. Route to Insurance Desk."
            },
            "tools": [
                {"tool": "EMR Clinical History & Notes API", "perm": "Fetch admission indications, diagnoses & doctor operative orders", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Insurance Policy & Tariff Ledger", "perm": "Verify TPA network coverage limits, waiting periods & copay clauses", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Preauth Dossier Generator", "perm": "Assemble bilingual justification package & submit to TPA portal", "read": True, "write": True, "appr": "Selective", "enabled": True},
                {"tool": "Denial Risk AI Assessor", "perm": "Evaluate 17-criteria statutory checklist & compute denial probability", "read": True, "write": False, "appr": "None", "enabled": True}
            ],
            "knowledge": [
                {"t": "IRDAI Cashless Pre-Authorization Guidelines 2026", "v": "4.1", "eff": "01 Jan 2026", "status": "Published"},
                {"t": "TPA Package Rates & Exclusion Schedule FY26-27", "v": "3.0", "eff": "01 Apr 2026", "status": "Published"},
                {"t": "Hospital Preauth Clinical Justification SOP v2.8", "v": "2.8", "eff": "15 May 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Encounter-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "Insurance Desk, TPA Liaison, Hospital Management, Doctors", "departments": "All Inpatient Wards, ICUs, OT, Billing", "patients": "Care-team relationship required", "scopes": "Clinical read + Insurance write", "env": "Production"},
            "model": {"model": "openai/gpt-oss-120b (Groq LPU Inference)", "temperature": 0.1, "tokens": 8000, "fallback": "gemini-3.5-flash-lite", "latency": "< 1.8 s p50", "cost": "₹16 / run"},
            "evals": [
                {"id": "EV-707", "ver": "v2.4.0", "when": "Today 10:15", "cases": 140, "acc": "97.6%", "ground": "98.9%", "hall": "0.1%", "ref": "100%", "lat": "1.6s", "res": "Pass"}
            ],
            "versions": [
                {"v": "2.4.0", "ts": "Today", "author": "AI Engineering", "changes": "Added bilingual Tamil preauth justification synthesis & 17-criteria statutory audit", "score": "97.6", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-08  Billing Transparency Agent ─────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-08",
            "name": "Billing Transparency Agent",
            "name_ta": "கட்டண வெளிப்படைத்தன்மை முகவர்",
            "type": "Workflow Agent",
            "version": "2.0.0",
            "owner": "Finance & Billing",
            "risk_tier": "High",
            "status": "Published",
            "human_approval": "Optional",
            "purpose": "Assist Billing Desk & Cashier with automated plain-language English & Tamil breakdown of variance items under human oversight.",
            "last_run": "11:24",
            "success_rate": "96.4%",
            "runs": 342,
            "instructions": {
                "objective": "Translate complex surgical consumable charges, billing variances (>10%), and itemized tariffs into crystal-clear plain English & Tamil explanations grounded in doctor OT notes.",
                "system": "You are AG-08 Billing Transparency Agent (கட்டண வெளிப்படைத்தன்மை முகவர்) at Meridian Super Speciality Hospital. Your job is to translate technical hospital billing items, consumable codes, and doctor OT notes into crystal clear, empathetic, non-technical explanations in BOTH English and Tamil (தமிழ்). The explanation must be so clear that a hospital cashier can read it to the patient's family in 15 seconds, and the family immediately understands why the charge was medically necessary. Respond strictly in valid JSON format.",
                "rules": "Provide bilingual explanations in English and natural spoken Tamil (தமிழ்). Cite verbatim clinical quotes from doctor intra-operative notes. Itemize top variance drivers with amounts and layman-friendly rationale. Strict valid JSON format.",
                "safety": "Never alter hospital audited tariffs autonomously. Do not promise discounts without Medical Superintendent / Cashier sign-off. Ensure zero phantom consumable billing.",
                "escalation": "Escalate variance > 50% or billing disputes without EMR intra-op justification to Chief Financial Officer and Senior Billing Auditor.",
                "refusal": "Unable to verify billing variance against clinical EMR documentation safely. Route to Financial Counseling Desk."
            },
            "tools": [
                {"tool": "Billing Desk API", "perm": "Read Itemized Consumable Lines, Unit Prices & Running Totals", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Estimate Ledger", "perm": "Compare Charges Against Pre-Admission Estimate (>10% Variance)", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "EMR & OT Notes API", "perm": "Extract Intra-Operative Notes & Doctor Clinical Orders", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Document Generator", "perm": "Assemble Plain Bilingual Breakdown & Print to Invoice", "read": True, "write": True, "appr": "Cashier Sign-off", "enabled": True}
            ],
            "knowledge": [
                {"t": "Tariff Schedule FY26-27 & Package Exclusions", "v": "3.4", "eff": "01 Apr 2026", "status": "Published"},
                {"t": "Clinical Consumables & Implant Nomenclature", "v": "2.1", "eff": "01 Jun 2026", "status": "Published"},
                {"t": "Tamil Medical Lexicon & Layman Standards", "v": "1.8", "eff": "15 Jul 2026", "status": "Published"}
            ],
            "memory": {
                "session": "On · 30 min",
                "patient": "Encounter-scoped",
                "workflow": "On",
                "retention": "90 days (audit) · 0 days (conversation)",
                "sensitive": "No free-text PHI stored"
            },
            "access": {
                "roles": "Billing Staff, Hospital Cashiers, Ward Administrators, Finance Lead",
                "departments": "All wards",
                "patients": "Care-team relationship required",
                "scopes": "Financial + clinical read (no medical prescription write)",
                "env": "Production"
            },
            "model": {
                "model": "openai/gpt-oss-120b (Groq LPU Inference)",
                "provider": "Groq Inference API & Google Gemini Engine",
                "fallback": "gemini-3.5-flash-lite (Google Gemini)",
                "temperature": 0.2,
                "tokens": "8,000 tokens (Max context: 128k)",
                "latency": "< 1,500 ms (Groq accelerated)",
                "execution_protocol": "Sequential 3-Step Protocol (Estimate Diff → EMR OT Note Proof → Bilingual Synthesis)",
                "governance_gate": "Cashier Sign-off & Billing Auditor Review",
                "cost": "₹18 / run"
            },
            "evals": [
                {"id": "EV-708", "ver": "v2.0.0", "when": "Today 11:20", "cases": 120, "acc": "96.4%", "ground": "98.2%", "hall": "0.2%", "ref": "99%", "lat": "1.4s", "res": "Pass"},
                {"id": "EV-680", "ver": "v1.9.3", "when": "Yesterday 16:30", "cases": 100, "acc": "89.0%", "ground": "91.2%", "hall": "0.9%", "ref": "96%", "lat": "2.2s", "res": "Pass"}
            ],
            "versions": [
                {"v": "2.0.0", "ts": "Active Live", "author": "AI Engineering", "changes": "Groq openai/gpt-oss-120b bilingual English & Tamil synthesis", "score": "96.4", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"},
                {"v": "1.9.3", "ts": "21 days ago", "author": "AI Engineering", "changes": "Added tariff variance calculator", "score": "89.0", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-18  Nursing Handover Agent ─────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-18",
            "name": "Nursing Handover Agent",
            "name_ta": "செவிலியர் ஒப்படைப்பு முகவர்",
            "type": "Clinical Shift Co-Pilot",
            "version": "2.2.0",
            "owner": "Nursing Directorate & Clinical Quality",
            "risk_tier": "High",
            "status": "Published",
            "human_approval": "Mandatory • Registered Nurse Sign-off",
            "purpose": "Synthesize patient EMR vitals, MAR medication administration records, and clinical orders into structured SBAR shift handover notes with high-alert medication safety guardrails.",
            "last_run": "07:45 AM",
            "success_rate": "99.1%",
            "runs": 1240,
            "instructions": {
                "objective": "Synthesize shift EMR data, bedside vitals, and MAR charts into structured SBAR (Situation, Background, Assessment, Recommendation) clinical handovers for ward nurses.",
                "system": "You are the Meridian Hospital Nursing Handover Agent (AG-18 · செவிலியர் ஒப்படைப்பு முகவர்). You operate with clinical summarisation precision for registered nurses during ward shift changes. Clinical Governance SOPs in effect: Medication Safety — High-alert drugs v4.0 (Mandatory dual-nurse verification on Insulin, Heparin, Vancomycin, Narcotics), Medication Safety — Ward administration v3.2 (5 rights of drug administration & allergy cross-check), Standard SBAR Structure: Situation, Background, Assessment, Recommendation. Generate a structured, professional, concise clinical handover draft. Respond ONLY with a valid JSON object.",
                "rules": "Strict adherence to 4-part SBAR format. Highlight high-alert medications (Insulin, Heparin, Narcotics) with dual-sign-off warnings. Flag pending lab orders with critical timeline triggers. Output valid structured JSON.",
                "safety": "Never omit known allergies or abnormal Early Warning Scores (EWS). Require registered nurse sign-off before committing handover to EHR. Refuse alteration of doctor prescription orders.",
                "escalation": "Trigger immediate red-flag alert to Ward Nursing Supervisor and On-Call Medical Officer for deteriorating vitals (EWS >= 5 or SpO2 < 92%).",
                "refusal": "Insufficient shift vitals and EMR data to construct a safe SBAR handover note. Route to Ward In-Charge."
            },
            "tools": [
                {"tool": "Ward EMR & Bedside Vitals Engine", "perm": "Fetch real-time BP, HR, SpO2, Temp, RR & compute MEWS", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "MAR Pharmacy Verification API", "perm": "Cross-verify 5 rights of drug administration & dual-sign-off on high-alert meds", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "SBAR Handover Compiler", "perm": "Compile and commit structured clinical handover note to inpatient chart", "read": True, "write": True, "appr": "Nurse Sign-off", "enabled": True}
            ],
            "knowledge": [
                {"t": "Nursing Clinical Handover & SBAR SOP v4.2", "v": "4.2", "eff": "01 Jan 2026", "status": "Published"},
                {"t": "Medication Safety — High-Alert Drugs SOP v4.0", "v": "4.0", "eff": "15 Feb 2026", "status": "Published"},
                {"t": "Modified Early Warning Score (MEWS) Escalation Protocol", "v": "3.1", "eff": "01 Jun 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Encounter-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "Ward Nurses, Nursing Supervisors, Duty Doctors, Medical Officers", "departments": "All Inpatient Wards, ICUs, HDU, Post-Op", "patients": "Ward-assigned patients", "scopes": "Clinical read + Handover write", "env": "Production"},
            "model": {"model": "openai/gpt-oss-120b (Groq LPU Inference)", "temperature": 0.2, "tokens": 8000, "fallback": "gemini-3.5-flash-lite", "latency": "< 1.2 s p50", "cost": "₹12 / run"},
            "evals": [
                {"id": "EV-718", "ver": "v2.2.0", "when": "Today 07:45", "cases": 210, "acc": "99.1%", "ground": "99.6%", "hall": "0.0%", "ref": "100%", "lat": "1.1s", "res": "Pass"}
            ],
            "versions": [
                {"v": "2.2.0", "ts": "Today", "author": "Clinical Quality", "changes": "Added high-alert medication safety dual sign-off warnings and MEWS deterioration triggers", "score": "99.1", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-20  Claim Denial Agent ─────────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-20",
            "name": "Claim Denial Agent",
            "name_ta": "காப்பீட்டு மறுப்பு மேல்முறையீட்டு முகவர்",
            "type": "Revenue & Legal Appeal Agent",
            "version": "2.1.0",
            "owner": "Revenue Cycle & TPA Appeals",
            "risk_tier": "High",
            "status": "Published",
            "human_approval": "Mandatory • 1-Click Human Submission",
            "purpose": "Autonomous detection of claim deductions, EMR clinical proof extraction, IRDAI denial classification, and legal medical appeal dossier generation.",
            "last_run": "11:05 AM",
            "success_rate": "97.2%",
            "runs": 480,
            "instructions": {
                "objective": "Detect insurance claim shortfalls, extract clinical EMR evidence, classify denial reasons under IRDAI/ICD-10 standards, and generate legally rigorous reconsideration appeal dossiers.",
                "system": "You are the AG-20 Claim Denial & Shortfall Appeal Agent (காப்பீட்டு மறுப்பு மேல்முறையீட்டு முகவர்) for Meridian Hospital. Your role is to detect claim deductions and shortfalls, extract clinical evidence from patient EMR (operative notes, lab reports, vitals), classify denial codes under IRDAI/ICD-10 standards, and generate formal, legally rigorous medical appeal dossiers for 1-click submission to TPAs and insurers.",
                "rules": "Cite statutory IRDAI Master Circular clauses, policy terms, and NABH guidelines. Include itemized rejected line-item rebuttals. Generate bilingual summaries for hospital leadership and patients.",
                "safety": "Strictly prohibit fabrication of non-existent medical notes. Re-submission is strictly gated and blocked if required clinical evidence or doctor certifications are missing.",
                "escalation": "Escalate full claim rejections > ₹50,000 or contentious policy exclusions to Revenue Cycle Lead (R. Sundar) and TPA Liaison (L. Fathima).",
                "refusal": "Claim denial categorized as non-payable permanent exclusion under policy terms. Formal appeal not viable without new clinical indication."
            },
            "tools": [
                {"tool": "Insurance Claim Deduction Parser", "perm": "Detect rejected line items, shortfalls & deduction reason codes", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Clinical EMR Proof Retriever", "perm": "Extract intra-op notes, diagnostic findings & conservative therapy timelines", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "IRDAI Statutory Rules Classifier", "perm": "Map denial to statutory IRDAI clauses & policy exclusions", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Appeal Dossier Generator & TPA Dispatch Bus", "perm": "Draft formal appeal letters & 1-click submit to TPA portal", "read": True, "write": True, "appr": "1-Click Submission", "enabled": True}
            ],
            "knowledge": [
                {"t": "IRDAI Master Circular on Health Insurance Claims 2026", "v": "5.0", "eff": "01 Jan 2026", "status": "Published"},
                {"t": "Hospital Medical Appeal Precedents & Legal Rebuttals", "v": "3.2", "eff": "15 Mar 2026", "status": "Published"},
                {"t": "ICD-10-CM Medical Necessity Documentation Standard", "v": "2.6", "eff": "01 Jun 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Encounter-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "Revenue Cycle Lead, TPA Liaison, Hospital Billing, Finance Admin", "departments": "All Inpatient Wards, Billing, Legal", "patients": "Care-team relationship required", "scopes": "Revenue + clinical read + appeal write", "env": "Production"},
            "model": {"model": "openai/gpt-oss-120b (Groq LPU Inference)", "temperature": 0.1, "tokens": 8000, "fallback": "gemini-3.5-flash-lite", "latency": "< 1.6 s p50", "cost": "₹20 / run"},
            "evals": [
                {"id": "EV-720", "ver": "v2.1.0", "when": "Today 11:05", "cases": 160, "acc": "97.2%", "ground": "99.0%", "hall": "0.1%", "ref": "99%", "lat": "1.5s", "res": "Pass"}
            ],
            "versions": [
                {"v": "2.1.0", "ts": "Today", "author": "Revenue Engineering", "changes": "Added IRDAI 2026 master circular clauses & automatic clinical evidence retrieval", "score": "97.2", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-14  Analytics Agent ────────────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-14",
            "name": "Analytics Agent",
            "name_ta": "மேம்பட்ட பகுப்பாய்வு முகவர்",
            "type": "Summariser & Intelligence Agent",
            "version": "2.0.0",
            "owner": "Hospital Management & Operations Directorate",
            "risk_tier": "Medium",
            "status": "Published",
            "human_approval": "Selective",
            "purpose": "Synthesize enterprise hospital performance metrics, bed occupancy trends, revenue cycle velocity, and clinical quality KPIs into real-time executive briefings.",
            "last_run": "11:11 AM",
            "success_rate": "97.8%",
            "runs": 580,
            "instructions": {
                "objective": "Synthesize enterprise hospital performance metrics, bed occupancy trends, revenue cycle velocity, and clinical quality KPIs into real-time executive briefings.",
                "system": "You are the Meridian Hospital Analytics Agent (AG-14 · மேம்பட்ட பகுப்பாய்வு முகவர்). Your role is to synthesize enterprise hospital performance data from PostgreSQL and Gold Lakehouse tables (daily census, ward bed occupancy, ALOS, revenue cycle turnaround times, OPD doctor footfall, and clinical safety incident rates). Generate executive-grade daily briefings, identify operational bottlenecks, and formulate actionable management recommendations in English and Tamil (தமிழ்).",
                "rules": "Provide quantitative metrics with percentage trends and benchmark targets. Support dual-language English & Tamil executive summaries. Highlight operational variances exceeding +/- 10%. Include department-level drilldowns.",
                "safety": "Strictly read-only access to operational, financial, and anonymized clinical analytics. Mask patient PHI in management summaries. Never alter source transaction logs or bill records.",
                "escalation": "Escalate critical KPI breaches (e.g., Bed Occupancy > 92%, ER Wait Times > 90 mins, Claim Denial Rate > 8%) to Medical Director and Chief Operating Officer immediately.",
                "refusal": "Unable to compute executive analytics: Source lakehouse tables unverified or data refresh in progress. Escalating to Data Engineering Lead."
            },
            "tools": [
                {"tool": "Hospital Lakehouse Gold API", "perm": "Query aggregated daily census, admissions, discharges & ALOS metrics", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Revenue Cycle Analytics Engine", "perm": "Query billing velocity, claim denial rates & cash collection KPIs", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Executive Briefing Generator", "perm": "Assemble daily leadership briefing cards & PDF digest", "read": True, "write": True, "appr": "None", "enabled": True}
            ],
            "knowledge": [
                {"t": "Hospital Executive KPI Master Framework FY26-27", "v": "3.2", "eff": "01 Apr 2026", "status": "Published"},
                {"t": "NABH Clinical Quality & Safety Indicator SOP", "v": "4.0", "eff": "01 Jan 2026", "status": "Published"},
                {"t": "Tamil Management Terminology & Executive Digest Standard", "v": "1.5", "eff": "15 May 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Encounter-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "Management, Chief Medical Officer, Chief Operating Officer, Department Leads", "departments": "All Wards, ICUs, OPD, Finance, Operations", "patients": "Anonymized Aggregate Analytics", "scopes": "Operational + financial read (no clinical write)", "env": "Production"},
            "model": {"model": "meridian-llm-large", "temperature": 0.2, "tokens": 8000, "fallback": "meridian-llm-small", "latency": "< 2.0 s p50", "cost": "₹8 / run"},
            "evals": [
                {"id": "EV-714", "ver": "v2.0.0", "when": "Today 10:00", "cases": 120, "acc": "97.8%", "ground": "99.0%", "hall": "0.1%", "ref": "100%", "lat": "1.8s", "res": "Pass"}
            ],
            "versions": [
                {"v": "2.0.0", "ts": "Today", "author": "Operations Engineering", "changes": "Added Gold Lakehouse live telemetry sync and bilingual Tamil executive briefing generator", "score": "97.8", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"},
                {"v": "1.7.0", "ts": "21 days ago", "author": "Ops Product", "changes": "Executive KPI reporting", "score": "93.8", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        # ── AG-15  Forecasting Agent ──────────────────────────────────────────
        _insert_agent_seed(cur, {
            "agent_id": "AG-15",
            "name": "Forecasting Agent",
            "name_ta": "கணிப்பு முகவர்",
            "type": "Predictive Monitor & Planner",
            "version": "2.0.0",
            "owner": "Hospital Operations & Bed Management",
            "risk_tier": "Medium",
            "status": "Published",
            "human_approval": "Selective",
            "purpose": "Forecast 7-day inpatient bed demand, emergency inflow surges, and ward-specific capacity bottlenecks to optimize hospital admission flow and staffing.",
            "last_run": "06:00 AM",
            "success_rate": "98.2%",
            "runs": 310,
            "instructions": {
                "objective": "Forecast 7-day inpatient bed demand, emergency inflow surges, and ward-specific capacity bottlenecks to optimize hospital admission flow and staffing.",
                "system": "You are the Meridian Hospital Forecasting Agent (AG-15 · கணிப்பு முகவர்). Your role is to compute 7-day rolling inpatient census projections, predictive emergency/elective bed demand forecasts, and ward unit occupancy trends using PostgreSQL Gold tables (fact_bed_demand_forecast_7day_detailed) and historical admission patterns. Provide early warning alerts for impending ICU/HDU bed shortages and recommend proactive patient transfers and staffing reallocations.",
                "rules": "Generate 7-day rolling horizon projections categorized by ward (Cardiology, ICU, General, Maternity, Pediatric). Provide predicted occupancy percentages and confidence intervals. Flag predicted surge dates.",
                "safety": "Forecast models serve as decision support only. Do not autonomously reject emergency admissions or alter bed allocation without Bed Manager / Triage Physician approval.",
                "escalation": "Trigger High-Alert Surge Notification to Hospital Incident Commander and Ward Nursing Lead when forecasted bed occupancy exceeds 90% within 48 hours.",
                "refusal": "Historical admission variance too high or census telemetry unavailable to generate reliable 7-day forecast. Escalating to Bed Management Desk."
            },
            "tools": [
                {"tool": "fact_bed_demand_forecast_7day_detailed Engine", "perm": "Query 7-day predictive bed demand, emergency vs elective admissions & occupancy rates", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Bed Capacity & Surge Modeler", "perm": "Simulate ward capacity headroom and calculate bed crunch probabilities", "read": True, "write": False, "appr": "None", "enabled": True},
                {"tool": "Staffing Alignment Bus", "perm": "Push nurse-to-patient ratio recommendations to staff_rosters engine", "read": True, "write": True, "appr": "Nursing Supervisor", "enabled": True}
            ],
            "knowledge": [
                {"t": "Hospital Bed Surge Management & Capacity Planning Protocol", "v": "4.1", "eff": "01 Jan 2026", "status": "Published"},
                {"t": "Emergency Inflow Forecasting & Seasonal Surge Standard", "v": "2.8", "eff": "15 Mar 2026", "status": "Published"},
                {"t": "Inpatient Discharge & Turnaround SOP v3.1", "v": "3.1", "eff": "01 Jul 2026", "status": "Published"}
            ],
            "memory": {"session": "On · 30 min", "patient": "Encounter-scoped", "workflow": "On", "retention": "90 days (audit) · 0 days (conversation)", "sensitive": "No free-text PHI stored"},
            "access": {"roles": "Operations, Bed Management, Nursing Leadership, Emergency Dept Triage", "departments": "All Inpatient Wards, ICUs, Emergency, OT", "patients": "Aggregated Ward Cohorts", "scopes": "Operational predictive read/write", "env": "Production"},
            "model": {"model": "meridian-llm-large", "temperature": 0.1, "tokens": 8000, "fallback": "Clinical Census Predictor", "latency": "< 1.5 s p50", "cost": "₹6 / run"},
            "evals": [
                {"id": "EV-715", "ver": "v2.0.0", "when": "Today 06:00", "cases": 100, "acc": "98.2%", "ground": "99.4%", "hall": "0.0%", "ref": "100%", "lat": "1.3s", "res": "Pass"}
            ],
            "versions": [
                {"v": "2.0.0", "ts": "Today", "author": "Operations Engineering", "changes": "Integrated fact_bed_demand_forecast_7day_detailed 7-day rolling surge predictor", "score": "98.2", "state": "Published", "bg": "#dcfce7", "fg": "#15803d"},
                {"v": "1.0.6", "ts": "30 days ago", "author": "Operations", "changes": "Initial bed demand forecasting model", "score": "91.4", "state": "Archived", "bg": "#f1f5f9", "fg": "#475569"}
            ],
            "managed_state": "Configurable • Dynamic"
        })
        conn.commit()

        cur.close()
        conn.close()
    except Exception as e:
        print(f"[AGENT_CONFIG_INIT_ERR] {e}")


def _format_config_row(row):
    def parse_json(field):
        if isinstance(field, (dict, list)):
            return field
        try:
            return json.loads(field) if field else {}
        except Exception:
            return {}

    return {
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
        "last_run": row[19],
        "lastRun": row[19],
        "success_rate": row[20],
        "success": row[20],
        "runs": row[21],
        "updated_at": row[22].isoformat() if len(row) > 22 and row[22] else None
    }


@router.get("/config", summary="List all dynamic Agent Configurations")
def list_agent_configs():
    ensure_agent_config_table()
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT agent_id, name, name_ta, type, version, owner, risk_tier, status,
                   human_approval, purpose, instructions, tools, knowledge, memory, access,
                   model, evals, versions, managed_state, last_run, success_rate, runs, updated_at
            FROM agent_configurations
            ORDER BY agent_id ASC;
        """)
        rows = cur.fetchall()
        return {
            "success": True,
            "data": [_format_config_row(r) for r in rows]
        }
    finally:
        cur.close()
        conn.close()


@router.get("/config/{agent_id}", summary="Get dynamic Agent Configuration")
def get_agent_config(agent_id: str):
    ensure_agent_config_table()
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT agent_id, name, name_ta, type, version, owner, risk_tier, status,
                   human_approval, purpose, instructions, tools, knowledge, memory, access,
                   model, evals, versions, managed_state, last_run, success_rate, runs, updated_at
            FROM agent_configurations
            WHERE UPPER(agent_id) = UPPER(%s);
        """, (agent_id,))
        row = cur.fetchone()

        if not row:
            return {
                "success": False,
                "message": f"Agent {agent_id} configuration not found in database."
            }

        return {
            "success": True,
            "data": _format_config_row(row)
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
    valid_types = ("Workflow Agent", "Answerer", "Monitor", "Task Agent", "Drafter", "Summariser", "Extractor", "Predictor", "Router")
    if payload.type and payload.type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid agent type: {payload.type}")
    if payload.risk_tier and payload.risk_tier not in ("Low", "Medium", "High", "Critical"):
        raise HTTPException(status_code=400, detail=f"Invalid risk tier: {payload.risk_tier}")
    if payload.status and payload.status not in ("Draft", "Published", "Archived", "Testing", "Silent Validation", "Production-Pilot", "Disabled"):
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
                    last_run = COALESCE(%s, last_run),
                    success_rate = COALESCE(%s, success_rate),
                    runs = COALESCE(%s, runs),
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
                payload.last_run, payload.success_rate, payload.runs,
                agent_id
            ))
        else:
            cur.execute("""
                INSERT INTO agent_configurations (
                    agent_id, name, name_ta, type, version, owner, risk_tier, status,
                    human_approval, purpose, instructions, tools, knowledge, memory, access,
                    model, evals, versions, managed_state, last_run, success_rate, runs
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                agent_id, payload.name or "Agent", payload.name_ta or "",
                payload.type or "Monitor", payload.version or "1.0.0", payload.owner or "Quality",
                payload.risk_tier or "Medium", payload.status or "Published",
                payload.human_approval or "Selective", payload.purpose or "",
                json.dumps(payload.instructions or {}), json.dumps(payload.tools or []),
                json.dumps(payload.knowledge or []), json.dumps(payload.memory or {}),
                json.dumps(payload.access or {}), json.dumps(payload.model or {}),
                json.dumps(payload.evals or []), json.dumps(payload.versions or []),
                payload.managed_state or "Configurable • Dynamic",
                payload.last_run or "11:15", payload.success_rate or "95.0%", payload.runs or 0
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

