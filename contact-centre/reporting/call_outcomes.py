"""
reporting/call_outcomes.py
==========================
Records interaction outcomes, analytics, and metrics for
Hospital Telephony Administrators.
"""

import time
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class CallOutcomeRecord(BaseModel):
    call_id: str
    caller_number: str
    patient_name: Optional[str] = "Caller"
    language: str = "ta-IN"
    duration_seconds: float = 0.0
    intent: Optional[str] = "GENERAL"
    sentiment: str = "Neutral"
    outcome: str  # "AI_RESOLVED", "APPOINTMENT_BOOKED", "TRANSFERRED_TO_HUMAN", "EMERGENCY_ESCALATED"
    summary: str
    timestamp: float = Field(default_factory=time.time)


class CallOutcomeReporting:
    """Stores interaction logs and generates telemetry analytics."""

    def __init__(self):
        self._records: List[CallOutcomeRecord] = [
            # Seed with realistic baseline records for immediate dashboard clarity
            CallOutcomeRecord(
                call_id="CALL-801",
                caller_number="9876543210",
                patient_name="Ramesh Kumar",
                language="ta-IN",
                duration_seconds=78.5,
                intent="APPOINTMENT_BOOKING",
                sentiment="Calm",
                outcome="APPOINTMENT_BOOKED",
                summary="Dr. Anand slot booked in Room 108. Token #14 reserved."
            ),
            CallOutcomeRecord(
                call_id="CALL-802",
                caller_number="8765432109",
                patient_name="Anitha Nair",
                language="en-IN",
                duration_seconds=42.0,
                intent="HOSPITAL_INFO",
                sentiment="Calm",
                outcome="AI_RESOLVED",
                summary="Provided surgical ward visiting hours (05:00 PM - 07:00 PM)."
            ),
            CallOutcomeRecord(
                call_id="CALL-803",
                caller_number="9840123456",
                patient_name="Suresh Babu",
                language="ta-IN",
                duration_seconds=125.0,
                intent="BILLING_INQUIRY",
                sentiment="Frustrated",
                outcome="TRANSFERRED_TO_HUMAN",
                summary="Billing variance dispute. Transferred with full transcript to Billing desk."
            ),
            CallOutcomeRecord(
                call_id="CALL-804",
                caller_number="9444012345",
                patient_name="Dinesh Chandra",
                language="ta-IN",
                duration_seconds=35.0,
                intent="EMERGENCY",
                sentiment="Anxious",
                outcome="EMERGENCY_ESCALATED",
                summary="Severe chest pain. Emergency warm transfer executed to Casualty."
            )
        ]

    def record_outcome(
        self,
        call_id: str,
        caller_number: str,
        outcome: str,
        summary: str,
        language: str = "ta-IN",
        duration: float = 0.0,
        intent: Optional[str] = None,
        sentiment: str = "Neutral",
        patient_name: Optional[str] = None
    ) -> CallOutcomeRecord:
        record = CallOutcomeRecord(
            call_id=call_id,
            caller_number=caller_number,
            patient_name=patient_name or "Caller",
            language=language,
            duration_seconds=duration,
            intent=intent or "GENERAL",
            sentiment=sentiment,
            outcome=outcome,
            summary=summary
        )
        self._records.insert(0, record)
        return record

    def get_summary_metrics(self) -> Dict[str, Any]:
        """Calculates live KPI metrics for telephony dashboard."""
        total = len(self._records)
        if total == 0:
            return {
                "total_calls": 0,
                "ai_resolved_percentage": 0.0,
                "transferred_percentage": 0.0,
                "language_distribution": {},
                "sentiment_distribution": {},
                "recent_logs": []
            }

        ai_resolved = sum(1 for r in self._records if r.outcome in ("AI_RESOLVED", "APPOINTMENT_BOOKED"))
        transferred = sum(1 for r in self._records if r.outcome in ("TRANSFERRED_TO_HUMAN", "EMERGENCY_ESCALATED"))
        tamil_calls = sum(1 for r in self._records if "ta" in r.language.lower())
        english_calls = total - tamil_calls

        sentiments = {}
        for r in self._records:
            sentiments[r.sentiment] = sentiments.get(r.sentiment, 0) + 1

        return {
            "total_calls": total,
            "ai_resolved_count": ai_resolved,
            "ai_resolved_percentage": round((ai_resolved / total) * 100, 1),
            "transferred_to_human_count": transferred,
            "transferred_percentage": round((transferred / total) * 100, 1),
            "language_distribution": {
                "Tamil (தமிழ்)": tamil_calls,
                "English": english_calls
            },
            "sentiment_distribution": sentiments,
            "recent_logs": [r.model_dump() for r in self._records[:15]]
        }


# Global singleton instance
call_reporting = CallOutcomeReporting()
