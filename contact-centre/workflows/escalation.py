"""
workflows/escalation.py
=======================
Handles live call transfers, emergency clinical escalations,
and compilation of handoff context packets for receiving human operators.
"""

from typing import Dict, Any
from config import settings
from voice.session_manager import session_manager, CallStatus


class EscalationWorkflow:
    """Orchestrates warm handoffs and SIP line transfers."""

    @classmethod
    def execute_escalation(
        cls,
        call_id: str,
        target_desk: str,
        reason: str,
        sentiment: str = "Neutral"
    ) -> Dict[str, Any]:
        """
        Prepares a live SIP call transfer and formats contextual handoff data.
        """
        session = session_manager.get_session(call_id)
        lang = session.language if session else "ta-IN"

        # Determine destination SIP URI
        if target_desk == "EMERGENCY_CASUALTY":
            sip_target = settings.EMERGENCY_DESK_SIP
            transfer_msg_ta = (
                "தயவுசெய்து பதற்றப்பட வேண்டாம். நோயாளியை அமர வைத்து ஓய்வெடுக்கச் சொல்லுங்கள். "
                "நான் உடனடியாக உங்கள் அழைப்பை அவசர சிகிச்சைப் பிரிவிற்கு இணைக்கிறேன்."
            )
            transfer_msg_en = (
                "Please stay calm and keep the patient resting. I am transferring your call "
                "to our Emergency Trauma Desk right now."
            )
            priority = "URGENT_EMERGENCY"
        elif target_desk == "BILLING_DESK":
            sip_target = settings.BILLING_DESK_SIP
            transfer_msg_ta = "உங்கள் கட்டண விவரங்களை சரிபார்க்க கட்டணப் பிரிவு அலுவலருக்கு இணைக்கிறேன்."
            transfer_msg_en = "Connecting you to our Billing Support desk to verify your details."
            priority = "NORMAL"
        else:
            sip_target = settings.HUMAN_AGENT_POOL_SIP
            transfer_msg_ta = "உங்களுக்கு உதவ எங்கள் உதவி மைய அலுவலருக்கு அழைப்பை மாற்றுகிறேன். சற்று காத்திருக்கவும்."
            transfer_msg_en = "Transferring you to a hospital executive now. Please hold for a moment."
            priority = "HIGH" if sentiment == "Frustrated" else "NORMAL"

        spoken_announcement = transfer_msg_ta if "ta" in lang.lower() else transfer_msg_en

        if session:
            session.status = CallStatus.TRANSFERRING
            session.transferred_to = sip_target
            session.add_transcript("agent", spoken_announcement, lang)

        return {
            "status": "escalated",
            "call_id": call_id,
            "target_desk": target_desk,
            "sip_destination_uri": sip_target,
            "spoken_announcement": spoken_announcement,
            "priority": priority,
            "handoff_context": {
                "caller_number": session.caller_number if session else "Unknown",
                "patient_name": session.patient_name if session else "Unverified",
                "sentiment": sentiment,
                "reason": reason,
                "recent_transcript_count": len(session.transcripts) if session else 0
            }
        }
