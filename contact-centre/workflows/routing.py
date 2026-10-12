"""
workflows/routing.py
====================
Intent classification, sentiment evaluation, and routing orchestration
for telephone inquiries.
"""

from typing import Dict, Any, Tuple
from agent.instructions import INTENT_DETECTION_RULES
from voice.session_manager import session_manager


class CallRoutingWorkflow:
    """Evaluates caller input and routes call to the appropriate workflow or escalation path."""

    EMERGENCY_KEYWORDS = [
        "chest pain", "heart attack", "unconscious", "heavy bleeding", "collapse",
        "நெஞ்சு வலி", "மயக்கம்", "மூச்சுத் திணறல்", "அவசரம்", "ஆம்புலன்ஸ்"
    ]

    FRUSTRATION_KEYWORDS = [
        "useless", "angry", "stupid", "complaint", "waiting forever",
        "மோசம்", "கோபம்", "யாரும் எடுக்கல", "சண்டை"
    ]

    @classmethod
    def analyze_caller_intent_and_sentiment(cls, user_text: str) -> Tuple[str, str]:
        """
        Extracts high-level intent and emotional sentiment from caller speech.
        Returns: (intent, sentiment)
        """
        text_lower = user_text.lower()

        # 1. Emergency safety check
        if any(w in text_lower for w in cls.EMERGENCY_KEYWORDS):
            return "EMERGENCY", "Anxious"

        # 2. Sentiment check
        sentiment = "Neutral"
        if any(w in text_lower for w in cls.FRUSTRATION_KEYWORDS):
            sentiment = "Frustrated"
        elif any(w in text_lower for w in ["thank you", "thanks", "நன்றி", "super"]):
            sentiment = "Calm"

        # 3. Rule-based intent matching
        matched_intent = "GENERAL_INQUIRY"
        for intent, patterns in INTENT_DETECTION_RULES.items():
            if any(p in text_lower for p in patterns):
                matched_intent = intent
                break

        return matched_intent, sentiment

    @classmethod
    def determine_route(cls, call_id: str, caller_text: str) -> Dict[str, Any]:
        """
        Determines the execution path for the incoming caller utterance.
        """
        intent, sentiment = cls.analyze_caller_intent_and_sentiment(caller_text)
        session_manager.set_sentiment_and_intent(call_id, intent, sentiment)

        if intent == "EMERGENCY":
            return {
                "route": "EMERGENCY_ESCALATION",
                "intent": intent,
                "sentiment": sentiment,
                "requires_immediate_transfer": True,
                "transfer_target": "EMERGENCY_CASUALTY"
            }
        elif intent == "HUMAN_HANDOFF" or sentiment == "Frustrated":
            return {
                "route": "HUMAN_ESCALATION",
                "intent": intent,
                "sentiment": sentiment,
                "requires_immediate_transfer": True,
                "transfer_target": "HUMAN_OPERATOR"
            }
        elif intent == "APPOINTMENT_BOOKING":
            return {
                "route": "APPOINTMENT_BOOKING",
                "intent": intent,
                "sentiment": sentiment,
                "requires_immediate_transfer": False
            }
        elif intent == "APPOINTMENT_INQUIRY":
            return {
                "route": "APPOINTMENT_LOOKUP",
                "intent": intent,
                "sentiment": sentiment,
                "requires_immediate_transfer": False
            }
        else:
            return {
                "route": "VOICE_RESOLVE",
                "intent": intent,
                "sentiment": sentiment,
                "requires_immediate_transfer": False
            }
