"""
voice/twilio_handler.py
=======================
Native Twilio Voice integration generating TwiML for telephone calls.
Handles inbound calls, speech recognition (Tamil & Indian English),
interactive voice dialogues, live transfers, and call completion events.
"""

from typing import Dict, Any, Optional
import xml.etree.ElementTree as ET
from config import settings
from .session_manager import session_manager, CallSession, CallStatus
from workflows.verification import CallerVerificationWorkflow
from workflows.routing import CallRoutingWorkflow
from workflows.escalation import EscalationWorkflow
from integrations.appointments import AppointmentsIntegration
from reporting.call_outcomes import call_reporting


class TwilioVoiceHandler:
    """Handles Twilio Voice webhooks and generates standard TwiML XML responses."""

    GREETING_TAMIL = (
        "வணக்கம்! மெரிடியன் மருத்துவமனை தொலைபேசி உதவி மையத்திற்கு வரவேற்கிறோம். "
        "நான் உங்கள் குரல் உதவியாளர். உங்களுக்கு இன்று எவ்வாறு உதவ முடியும்?"
    )
    GREETING_ENGLISH = (
        "Welcome to Meridian Hospital helpline. I am your voice assistant. "
        "How may I help you today?"
    )

    @classmethod
    def build_twiml_response(cls, elements: list) -> str:
        """Helper to build XML string from XML elements."""
        root = ET.Element("Response")
        for el in elements:
            root.append(el)
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="unicode")

    @classmethod
    def handle_inbound_call(cls, form_data: Dict[str, Any]) -> str:
        """
        POST /webhooks/twilio/voice
        Invoked by Twilio when a caller dials the Twilio phone number.
        Returns TwiML with a greeting and <Gather input="speech">.
        """
        call_sid = form_data.get("CallSid", f"TW-{id(form_data)}")
        from_number = form_data.get("From", "Anonymous")
        to_number = form_data.get("To", settings.TWILIO_PHONE_NUMBER)

        # 1. Verify caller & detect language preference
        verification = CallerVerificationWorkflow.verify_caller(call_sid, from_number)
        language = verification.get("preferred_language", settings.VOICE_DEFAULT_LANGUAGE)

        # 2. Initialize call session
        session = session_manager.create_session(
            call_id=call_sid,
            caller_number=from_number,
            trunk_id="TWILIO-VOICE",
            language=language
        )

        greeting = cls.GREETING_TAMIL if "ta" in language.lower() else cls.GREETING_ENGLISH
        session.add_transcript("agent", greeting, language)

        # 3. Construct TwiML XML
        gather_el = ET.Element("Gather", {
            "input": "speech",
            "action": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/webhooks/twilio/gather",
            "method": "POST",
            "language": "ta-IN" if "ta" in language.lower() else "en-IN",
            "speechTimeout": "auto",
            "bargeIn": "true"
        })

        say_el = ET.SubElement(gather_el, "Say", {
            "language": "ta-IN" if "ta" in language.lower() else "en-IN"
        })
        say_el.text = greeting

        # If caller says nothing, redirect back to gather
        redirect_el = ET.Element("Redirect")
        redirect_el.text = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/webhooks/twilio/gather"

        return cls.build_twiml_response([gather_el, redirect_el])

    @classmethod
    async def handle_gather(cls, form_data: Dict[str, Any]) -> str:
        """
        POST /webhooks/twilio/gather
        Invoked by Twilio when caller finishes speaking. Contains speech transcription.
        """
        call_sid = form_data.get("CallSid", "")
        speech_result = form_data.get("SpeechResult", "").strip()
        confidence = float(form_data.get("Confidence", 0.0) or 0.0)

        session = session_manager.get_session(call_sid)
        if not session:
            # Fallback session if expired
            from_number = form_data.get("From", "Unknown")
            session = session_manager.create_session(call_sid, from_number)

        # If no speech was detected
        if not speech_result:
            reprompt = (
                "மன்னிக்கவும், உங்கள் குரல் கேட்கவில்லை. டாக்டர் ஆலோசனை அல்லது டோக்கன் முன்பதிவு வேண்டுமா?"
                if "ta" in session.language.lower() else
                "Sorry, I did not catch that. Would you like to check doctor schedules or book a token?"
            )
            session.add_transcript("agent", reprompt)

            gather_el = ET.Element("Gather", {
                "input": "speech",
                "action": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/webhooks/twilio/gather",
                "method": "POST",
                "language": session.language,
                "speechTimeout": "auto"
            })
            say_el = ET.SubElement(gather_el, "Say", {"language": session.language})
            say_el.text = reprompt
            return cls.build_twiml_response([gather_el])

        # Record caller speech
        session.add_transcript("caller", speech_result)

        # 1. Evaluate route & safety guardrails
        route = CallRoutingWorkflow.determine_route(call_sid, speech_result)

        # 2. EMERGENCY ESCALATION
        if route["requires_immediate_transfer"] and route["intent"] == "EMERGENCY":
            announcement = (
                "தயவுசெய்து பதற்றப்பட வேண்டாம். நோயாளியை ஓய்வெடுக்கச் சொல்லுங்கள். உடனடியாக எங்கள் அவசர சிகிச்சைப் பிரிவிற்கு இணைக்கிறேன்."
                if "ta" in session.language.lower() else
                "Please stay calm and keep the patient resting. Connecting you to our Emergency Casualty desk immediately."
            )
            session.add_transcript("agent", announcement)
            session.status = CallStatus.TRANSFERRING
            session.transferred_to = settings.EMERGENCY_DESK_PHONE

            say_el = ET.Element("Say", {"language": session.language})
            say_el.text = announcement
            dial_el = ET.Element("Dial")
            dial_el.text = settings.EMERGENCY_DESK_PHONE
            return cls.build_twiml_response([say_el, dial_el])

        # 3. HUMAN OPERATOR ESCALATION (Frustration or direct request)
        if route["requires_immediate_transfer"] and route["route"] == "HUMAN_ESCALATION":
            announcement = (
                "எங்கள் உதவி மைய அலுவலருக்கு உங்கள் அழைப்பை மாற்றுகிறேன். சற்று காத்திருக்கவும்."
                if "ta" in session.language.lower() else
                "Transferring your call to our hospital customer desk. Please hold for a moment."
            )
            session.add_transcript("agent", announcement)
            session.status = CallStatus.TRANSFERRING
            session.transferred_to = settings.HUMAN_OPERATOR_PHONE

            say_el = ET.Element("Say", {"language": session.language})
            say_el.text = announcement
            dial_el = ET.Element("Dial")
            dial_el.text = settings.HUMAN_OPERATOR_PHONE
            return cls.build_twiml_response([say_el, dial_el])

        # 4. APPOINTMENT LOOKUP / SCHEDULES
        if route["route"] in ("APPOINTMENT_LOOKUP", "APPOINTMENT_BOOKING"):
            slots_data = await AppointmentsIntegration.lookup_slots()
            first_doc = slots_data["results"][0] if slots_data.get("results") else None

            if first_doc:
                agent_reply = (
                    f"{first_doc['doctor_name']} அவர்கள் இன்று மதியம் {first_doc['opd_timings'].split(' - ')[1]} வரை "
                    f"{first_doc['room_number']}-ல் நோயாளி பார்க்கிறார். {first_doc['open_tokens_today']} டோக்கன்கள் காலியாக உள்ளன. "
                    f"முன்பதிவு செய்யவா?"
                    if "ta" in session.language.lower() else
                    f"{first_doc['doctor_name']} is consulting today in {first_doc['room_number']} until 01:00 PM. "
                    f"{first_doc['open_tokens_today']} tokens are open. Shall I reserve a slot for you?"
                )
            else:
                agent_reply = "இன்று அனைத்து மருத்தவர்களும் பணியில் உள்ளனர். உங்களுக்கு எந்த துறை தேவை?"
        else:
            agent_reply = (
                "மெரிடியன் மருத்துவமனை உங்கள் சேவைக்கு எப்போதும் தயாராக உள்ளது. வேறு ஏதேனும் தகவல் தேவையா?"
                if "ta" in session.language.lower() else
                "Meridian Hospital is at your service. How else may I assist you?"
            )

        session.add_transcript("agent", agent_reply)

        # Continued conversation loop
        gather_el = ET.Element("Gather", {
            "input": "speech",
            "action": f"{settings.PUBLIC_BASE_URL.rstrip('/')}/webhooks/twilio/gather",
            "method": "POST",
            "language": session.language,
            "speechTimeout": "auto",
            "bargeIn": "true"
        })
        say_el = ET.SubElement(gather_el, "Say", {"language": session.language})
        say_el.text = agent_reply

        # Closing hangup if caller is finished
        hangup_el = ET.Element("Hangup")

        return cls.build_twiml_response([gather_el, hangup_el])

    @classmethod
    def handle_status_callback(cls, form_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        POST /webhooks/twilio/status
        Called by Twilio when call is completed, failed, or disconnected.
        """
        call_sid = form_data.get("CallSid", "")
        call_status = form_data.get("CallStatus", "completed")
        duration = float(form_data.get("CallDuration", 0.0) or 0.0)

        session = session_manager.get_session(call_sid)
        if session:
            session.close(disposition=call_status)
            session.duration_seconds = duration

            outcome = "TRANSFERRED_TO_HUMAN" if session.transferred_to else "AI_RESOLVED"
            call_reporting.record_outcome(
                call_id=session.call_id,
                caller_number=session.caller_number,
                outcome=outcome,
                summary=f"Twilio call ended with status '{call_status}'. Transcripts: {len(session.transcripts)}",
                language=session.language,
                duration=duration,
                intent=session.intent,
                sentiment=session.sentiment,
                patient_name=session.patient_name
            )

        return {"status": "recorded", "call_sid": call_sid, "call_status": call_status}
