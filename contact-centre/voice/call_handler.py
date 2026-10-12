"""
voice/call_handler.py
=====================
Handles incoming voice call webhooks, SIP events, audio stream handoffs,
and voice session lifecycles.
"""

from typing import Dict, Any, Optional
from config import settings
from .session_manager import session_manager, CallSession, CallStatus


class VoiceCallHandler:
    """Manages telephone provider call events and voice stream negotiations."""

    GREETING_TAMIL = (
        "வணக்கம்! மெரிடியன் மருத்துவமனை தொலைபேசி உதவி மையத்திற்கு வரவேற்கிறோம். "
        "நான் உங்கள் குரல் உதவியாளர். உங்களுக்கு இன்று எவ்வாறு உதவ முடியும்?"
    )
    GREETING_ENGLISH = (
        "Welcome to Meridian Hospital helpline. I am your voice assistant. "
        "How may I help you today?"
    )

    @classmethod
    def validate_inbound_webhook(cls, payload: Dict[str, Any], signature: Optional[str] = None) -> bool:
        """
        Validates incoming telephony webhook authenticity and required fields.
        """
        if not payload.get("call_id") or not payload.get("caller_number"):
            return False
        # Optional signature check in production mode
        if not settings.DEBUG and signature:
            # Check secret or HMAC signature
            if signature != settings.WEBHOOK_SIGNATURE_SECRET:
                return False
        return True

    @classmethod
    def handle_incoming_call(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes an incoming call event:
        1. Creates/initializes session
        2. Selects default greeting language (Tamil / English)
        3. Returns telephony response instructions (TwiML / SIP prompt instructions)
        """
        call_id = payload.get("call_id")
        caller_number = payload.get("caller_number")
        trunk_id = payload.get("trunk_id", settings.SIP_INBOUND_TRUNK_ID)
        language = payload.get("language", settings.VOICE_DEFAULT_LANGUAGE)

        session = session_manager.create_session(
            call_id=call_id,
            caller_number=caller_number,
            trunk_id=trunk_id,
            language=language
        )

        initial_greeting = cls.GREETING_TAMIL if "ta" in language.lower() else cls.GREETING_ENGLISH
        session.add_transcript("agent", initial_greeting, language)

        return {
            "status": "accepted",
            "call_id": session.call_id,
            "session_status": session.status.value,
            "greeting_text": initial_greeting,
            "language": session.language,
            "media_stream_url": f"/voice/session?call_id={session.call_id}",
            "telephony_action": {
                "action": "play_and_listen",
                "text": initial_greeting,
                "voice": "ta-IN-Standard-A" if "ta" in language.lower() else "en-IN-Standard-B",
                "barge_in": True,
                "timeout_seconds": 5
            }
        }

    @classmethod
    def handle_call_status(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles status updates from the voice provider (e.g. ringing, answered, completed).
        """
        call_id = payload.get("call_id")
        event = payload.get("event", "status_update")
        disposition = payload.get("disposition", "normal_clearing")
        duration = payload.get("duration_seconds")

        session = session_manager.get_session(call_id)
        if not session:
            return {"status": "not_found", "call_id": call_id}

        if event in ("call_ended", "hangup", "completed", "busy", "no_answer"):
            session.close(disposition=disposition)
            if duration is not None:
                session.duration_seconds = float(duration)
        elif event == "transfer":
            session.status = CallStatus.TRANSFERRING
            session.transferred_to = payload.get("transferred_to")

        return {
            "status": "updated",
            "call_id": session.call_id,
            "call_status": session.status.value,
            "duration_seconds": session.duration_seconds,
            "disposition": session.disposition
        }
