"""
voice/exotel_handler.py
=======================
Native Exotel Cloud Telephony integration for India (PSTN Virtual Numbers).
Handles Exotel Passthru applet callbacks, IVR speech interactions,
and call completion status reporting.
"""

from typing import Dict, Any, Optional
from config import settings
from .session_manager import session_manager, CallSession, CallStatus
from workflows.verification import CallerVerificationWorkflow
from workflows.routing import CallRoutingWorkflow
from workflows.escalation import EscalationWorkflow
from reporting.call_outcomes import call_reporting


class ExotelVoiceHandler:
    """Handles Exotel Inbound Applet Webhooks and status events."""

    @classmethod
    def handle_passthru(cls, query_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        GET/POST /webhooks/exotel/passthru
        Called by Exotel's Passthru Applet during an incoming phone call.
        """
        call_sid = query_params.get("CallSid") or query_params.get("CallUUID", f"EXO-{id(query_params)}")
        from_number = query_params.get("From", query_params.get("Caller", "Anonymous"))
        to_number = query_params.get("To", settings.EXOTEL_VIRTUAL_NUMBER)

        # 1. Register active session
        session = session_manager.create_session(
            call_id=call_sid,
            caller_number=from_number,
            trunk_id="EXOTEL-INBOUND",
            language="ta-IN"
        )

        # 2. Verify caller & check patient records
        verification = CallerVerificationWorkflow.verify_caller(call_sid, from_number)
        language = verification.get("preferred_language", "ta-IN")
        session.language = language

        greeting = (
            "வணக்கம்! மெரிடியன் மருத்துவமனை உதவி மையத்திற்கு வரவேற்கிறோம். "
            "நான் உங்கள் குரல் உதவியாளர். டாக்டர் ஆலோசனைக்கு 1-ஐ அழுத்தவும் அல்லது பேசவும்."
            if "ta" in language.lower() else
            "Welcome to Hospital helpline. How may I help you today?"
        )
        session.add_transcript("agent", greeting, language)

        # Return Exotel Passthru response instructions
        return {
            "status": "success",
            "call_sid": call_sid,
            "session_status": session.status.value,
            "caller_name": session.patient_name,
            "language": session.language,
            "greeting_text": greeting,
            "action": "play_and_gather",
            "redirect_url": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/voice/session"
        }

    @classmethod
    def handle_status_callback(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        POST /webhooks/exotel/status
        Called by Exotel when call is disconnected, answered, or failed.
        """
        call_sid = payload.get("CallSid") or payload.get("CallUUID", "")
        status = payload.get("Status", "completed")
        duration = float(payload.get("Duration", payload.get("Legs", [{}])[0].get("Duration", 0.0) if isinstance(payload.get("Legs"), list) else 0.0) or 0.0)
        recording_url = payload.get("RecordingUrl")

        session = session_manager.get_session(call_sid)
        if session:
            session.close(disposition=status)
            session.duration_seconds = duration
            if recording_url:
                session.metadata["recording_url"] = recording_url

            outcome = "TRANSFERRED_TO_HUMAN" if session.transferred_to else "AI_RESOLVED"
            call_reporting.record_outcome(
                call_id=session.call_id,
                caller_number=session.caller_number,
                outcome=outcome,
                summary=f"Exotel call finished ({status}). Duration: {duration}s. Rec: {bool(recording_url)}",
                language=session.language,
                duration=duration,
                intent=session.intent,
                sentiment=session.sentiment,
                patient_name=session.patient_name
            )

        return {
            "status": "recorded",
            "call_sid": call_sid,
            "call_status": status,
            "duration": duration
        }
