"""
contact-centre/main.py
======================
Main FastAPI application entrypoint for AG-12 Contact Centre Voice Agent.
Implements the telephony webhook endpoints, tool dispatch endpoints,
and real-time voice streaming WebSocket.
"""

import sys
import os
import json
import uuid
from typing import Dict, Any, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure current directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings
from voice.session_manager import session_manager, CallSession, CallStatus
from voice.call_handler import VoiceCallHandler
from voice.twilio_handler import TwilioVoiceHandler
from voice.exotel_handler import ExotelVoiceHandler
from agent.instructions import CONTACT_CENTRE_SYSTEM_PROMPT
from agent.tool_registry import ToolRegistry
from integrations.appointments import AppointmentsIntegration
from integrations.billing import BillingIntegration
from workflows.verification import CallerVerificationWorkflow
from workflows.routing import CallRoutingWorkflow
from workflows.escalation import EscalationWorkflow
from reporting.call_outcomes import call_reporting

# FastAPI Initialization
app = FastAPI(
    title="AG-12 Contact Centre Voice Agent (தொடர்பு மைய முகவர்)",
    description="Standalone Telephone Helpline & Natural Spoken Voice AI Service",
    version="2.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request & Response Models ---

class IncomingCallRequest(BaseModel):
    call_id: str = Field(..., description="Unique telephony call identifier from SIP trunk")
    caller_number: str = Field(..., description="Caller's phone number")
    trunk_id: Optional[str] = Field("TRUNK-IND-TN-044", description="Inbound SIP trunk ID")
    language: Optional[str] = Field("ta-IN", description="Preferred spoken voice language (ta-IN or en-IN)")


class CallStatusRequest(BaseModel):
    call_id: str
    event: str = Field(..., description="Status event (e.g. ringing, connected, call_ended, hangup)")
    duration_seconds: Optional[float] = None
    disposition: Optional[str] = "normal_clearing"
    transferred_to: Optional[str] = None


class AppointmentLookupRequest(BaseModel):
    call_id: Optional[str] = None
    doctor_name: Optional[str] = None
    department: Optional[str] = None
    date: Optional[str] = None


class AppointmentBookRequest(BaseModel):
    call_id: Optional[str] = None
    patient_phone: str
    doctor_name: str
    patient_name: Optional[str] = None
    preferred_time: Optional[str] = None
    reason_for_visit: Optional[str] = None


class CreateTicketRequest(BaseModel):
    call_id: Optional[str] = None
    caller_phone: str
    category: str = Field("GENERAL", description="BILLING, LAB_REPORTS, PHARMACY, FEEDBACK, GENERAL")
    subject: str
    details: str
    priority: str = Field("MEDIUM", description="LOW, MEDIUM, HIGH, URGENT")


# --- Health & Telemetry Routes ---

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AG-12 Contact Centre Voice Agent",
        "version": "2.2.0",
        "active_calls_count": len(session_manager.list_active_sessions())
    }


@app.get("/reporting/dashboard")
def get_telephony_dashboard():
    """Returns real-time KPI metrics and logs for hospital telephony administrators."""
    metrics = call_reporting.get_summary_metrics()
    active_sessions = session_manager.list_active_sessions()
    return {
        **metrics,
        "active_calls": [
            {
                "call_id": s.call_id,
                "caller_number": s.caller_number,
                "patient_name": s.patient_name,
                "language": s.language,
                "status": s.status.value,
                "sentiment": s.sentiment,
                "intent": s.intent,
                "duration_seconds": s.duration_seconds
            }
            for s in active_sessions
        ]
    }


# --- Middleware Endpoints ---

@app.post("/webhooks/voice/incoming")
def handle_incoming_call(req: IncomingCallRequest, request: Request):
    """
    POST /webhooks/voice/incoming
    Receive and validate an incoming-call event from the telephony provider (SIP/IVR).
    """
    payload = req.model_dump()
    signature = request.headers.get("X-Telephony-Signature")

    if not VoiceCallHandler.validate_inbound_webhook(payload, signature=signature):
        raise HTTPException(status_code=400, detail="Invalid call parameters or authentication signature")

    # 1. Initialize call session & welcome greeting
    call_resp = VoiceCallHandler.handle_incoming_call(payload)

    # 2. Execute verification workflow to match patient records
    verification = CallerVerificationWorkflow.verify_caller(
        call_id=req.call_id,
        raw_caller_number=req.caller_number
    )

    call_resp["caller_verification"] = verification
    return call_resp


@app.websocket("/voice/session")
async def voice_session_stream(websocket: WebSocket, call_id: Optional[str] = None):
    """
    WS /voice/session
    Handle the voice provider's real-time connection for bi-directional audio/text streaming.
    """
    await websocket.accept()

    session_id = call_id or str(uuid.uuid4())
    session = session_manager.get_session(session_id)
    if not session:
        session = session_manager.create_session(
            call_id=session_id,
            caller_number="Anonymous",
            language=settings.VOICE_DEFAULT_LANGUAGE
        )

    try:
        # Send initial session handshake
        await websocket.send_json({
            "event": "connected",
            "call_id": session.call_id,
            "language": session.language,
            "status": session.status.value
        })

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            event_type = message.get("event")

            if event_type == "media" or event_type == "transcript":
                # Received speech text chunk from ASR / STT provider
                caller_text = message.get("text", "")
                if caller_text:
                    session.add_transcript("caller", caller_text)
                    route_decision = CallRoutingWorkflow.determine_route(session.call_id, caller_text)

                    if route_decision["requires_immediate_transfer"]:
                        escalation_res = EscalationWorkflow.execute_escalation(
                            call_id=session.call_id,
                            target_desk=route_decision["transfer_target"],
                            reason=f"Urgent route triggered by: {caller_text}",
                            sentiment=route_decision["sentiment"]
                        )
                        await websocket.send_json({
                            "event": "transfer",
                            "call_id": session.call_id,
                            "announcement": escalation_res["spoken_announcement"],
                            "destination_sip": escalation_res["sip_destination_uri"],
                            "priority": escalation_res["priority"]
                        })
                    else:
                        # Process intent (e.g. check doctor, hospital info)
                        if route_decision["route"] == "APPOINTMENT_LOOKUP":
                            slots = await AppointmentsIntegration.lookup_slots()
                            reply_text = (
                                "டாக்டர் ஆனந்த் அவர்கள் இன்று மதியம் 01:00 மணி வரை அறை எண் 108-ல் நோயாளி பார்க்கிறார். "
                                "3 டோக்கன்கள் காலியாக உள்ளன. முன்பதிவு செய்யவா?"
                                if "ta" in session.language.lower() else
                                "Dr. Anand is consulting today until 01:00 PM in Room 108. 3 tokens are open. Shall I reserve one?"
                            )
                        else:
                            reply_text = (
                                "மெரிடியன் மருத்துவமனை உங்கள் சேவைக்கு எப்போதும் தயாராக உள்ளது. வேறு ஏதேனும் தகவல் தேவையா?"
                                if "ta" in session.language.lower() else
                                "Meridian Hospital is pleased to assist you. Is there anything else you need?"
                            )

                        session.add_transcript("agent", reply_text)
                        await websocket.send_json({
                            "event": "agent_response",
                            "call_id": session.call_id,
                            "text": reply_text,
                            "language": session.language,
                            "intent": route_decision["intent"],
                            "sentiment": route_decision["sentiment"]
                        })

            elif event_type == "hangup":
                session.close(disposition="caller_hangup")
                break

    except WebSocketDisconnect:
        session.close(disposition="client_disconnected")
    except Exception as e:
        session.close(disposition=f"error: {str(e)}")


@app.post("/tools/appointment-lookup")
async def tool_appointment_lookup(req: AppointmentLookupRequest):
    """
    POST /tools/appointment-lookup
    Run the authorized appointment lookup workflow to retrieve schedules & token availability.
    """
    result = await AppointmentsIntegration.lookup_slots(
        doctor_name=req.doctor_name,
        department=req.department,
        date_str=req.date
    )

    if req.call_id:
        session = session_manager.get_session(req.call_id)
        if session:
            session.intent = "APPOINTMENT_INQUIRY"

    return {
        "status": "success",
        "tool": "appointment_lookup",
        "data": result
    }


@app.post("/tools/appointment-book")
async def tool_appointment_book(req: AppointmentBookRequest):
    """
    POST /tools/appointment-book
    Execute a confirmed appointment booking and issue token number.
    """
    booking = await AppointmentsIntegration.book_appointment(
        patient_phone=req.patient_phone,
        doctor_name=req.doctor_name,
        patient_name=req.patient_name,
        preferred_time=req.preferred_time,
        reason=req.reason_for_visit
    )

    # Record interaction outcome
    call_id = req.call_id or f"CALL-BOOK-{uuid.uuid4().hex[:6]}"
    call_reporting.record_outcome(
        call_id=call_id,
        caller_number=req.patient_phone,
        outcome="APPOINTMENT_BOOKED",
        summary=f"Booked {booking['doctor_name']} for {req.patient_name or 'Caller'}. Token #{booking['token_number']}.",
        patient_name=req.patient_name
    )

    return {
        "status": "success",
        "tool": "appointment_book",
        "data": booking
    }


@app.post("/tools/create-ticket")
def tool_create_ticket(req: CreateTicketRequest):
    """
    POST /tools/create-ticket
    Create an authorized service request / follow-up ticket.
    """
    ticket_id = f"TKT-{uuid.uuid4().hex[:8].upper()}"

    # Record outcome
    call_id = req.call_id or f"CALL-TKT-{uuid.uuid4().hex[:6]}"
    call_reporting.record_outcome(
        call_id=call_id,
        caller_number=req.caller_phone,
        outcome="TICKET_CREATED",
        summary=f"Created [{req.category}] ticket #{ticket_id}: {req.subject}",
        intent="SERVICE_REQUEST"
    )

    return {
        "status": "success",
        "tool": "create_ticket",
        "data": {
            "ticket_id": ticket_id,
            "caller_phone": req.caller_phone,
            "category": req.category,
            "subject": req.subject,
            "priority": req.priority,
            "status": "OPEN",
            "routing_department": req.category,
            "sla_hours": 24 if req.priority != "URGENT" else 4,
            "confirmation_message": f"Support ticket #{ticket_id} created. Hospital staff will follow up within our SLA."
        }
    }


@app.post("/webhooks/voice/status")
def handle_call_status(req: CallStatusRequest):
    """
    POST /webhooks/voice/status
    Process call completion and status events from telephony provider.
    """
    status_res = VoiceCallHandler.handle_call_status(req.model_dump())

    session = session_manager.get_session(req.call_id)
    if session and req.event in ("call_ended", "hangup", "completed"):
        # Auto-commit outcome report if not already registered
        outcome = "TRANSFERRED_TO_HUMAN" if session.transferred_to else "AI_RESOLVED"
        call_reporting.record_outcome(
            call_id=session.call_id,
            caller_number=session.caller_number,
            outcome=outcome,
            summary=f"Call completed with status: {req.disposition}. Transcripts: {len(session.transcripts)}",
            language=session.language,
            duration=session.duration_seconds,
            intent=session.intent,
            sentiment=session.sentiment,
            patient_name=session.patient_name
        )

    return status_res


# =====================================================================
# TWILIO TELEPHONY ROUTES
# =====================================================================

@app.post("/webhooks/twilio/voice")
async def twilio_inbound_voice_webhook(request: Request):
    """
    POST /webhooks/twilio/voice
    Twilio voice webhook for inbound calls.
    Returns TwiML with voice greeting and speech gather in Tamil/English.
    """
    form_data = {}
    try:
        form = await request.form()
        form_data = dict(form)
    except Exception:
        form_data = dict(request.query_params)

    twiml_xml = TwilioVoiceHandler.handle_inbound_call(form_data)
    return Response(content=twiml_xml, media_type="application/xml")


@app.post("/webhooks/twilio/gather")
async def twilio_gather_speech_webhook(request: Request):
    """
    POST /webhooks/twilio/gather
    Twilio speech recognition callback.
    Processes caller speech, runs clinical/booking workflows, and responds with spoken TwiML.
    """
    form_data = {}
    try:
        form = await request.form()
        form_data = dict(form)
    except Exception:
        form_data = dict(request.query_params)

    twiml_xml = await TwilioVoiceHandler.handle_gather(form_data)
    return Response(content=twiml_xml, media_type="application/xml")


@app.post("/webhooks/twilio/status")
async def twilio_status_callback(request: Request):
    """
    POST /webhooks/twilio/status
    Twilio call completion, disconnection, and duration recording.
    """
    form_data = {}
    try:
        form = await request.form()
        form_data = dict(form)
    except Exception:
        form_data = dict(request.query_params)

    return TwilioVoiceHandler.handle_status_callback(form_data)


# =====================================================================
# EXOTEL TELEPHONY ROUTES (INDIA)
# =====================================================================

@app.api_route("/webhooks/exotel/passthru", methods=["GET", "POST"])
async def exotel_passthru_webhook(request: Request):
    """
    GET/POST /webhooks/exotel/passthru
    Exotel Passthru applet callback for inbound calls to virtual 044 landline / mobile number.
    """
    params = dict(request.query_params)
    if request.method == "POST":
        try:
            form = await request.form()
            params.update(dict(form))
        except Exception:
            pass

    return ExotelVoiceHandler.handle_passthru(params)


@app.post("/webhooks/exotel/status")
async def exotel_status_webhook(request: Request):
    """
    POST /webhooks/exotel/status
    Exotel call completion status and call recording webhook.
    """
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        form = await request.form()
        payload = dict(form)

    return ExotelVoiceHandler.handle_status_callback(payload)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
