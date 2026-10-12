"""
voice/session_manager.py
========================
State machine and session tracking for active telephone calls.
Maintains in-memory real-time state for telephone audio channels.
"""

import time
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class CallStatus(str, Enum):
    INITIATED = "initiated"
    RINGING = "ringing"
    CONNECTED = "connected"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    TRANSFERRING = "transferring"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptEntry(BaseModel):
    speaker: str  # "caller" or "agent"
    text: str
    timestamp: float = Field(default_factory=time.time)
    language: Optional[str] = None


class CallSession(BaseModel):
    call_id: str
    caller_number: str
    trunk_id: str = "DEFAULT-TRUNK"
    language: str = "ta-IN"  # Default Tamil, fallback English
    status: CallStatus = CallStatus.INITIATED
    start_time: float = Field(default_factory=time.time)
    end_time: Optional[float] = None
    duration_seconds: float = 0.0

    # Verification & Context
    is_verified: bool = False
    patient_id: Optional[str] = None
    patient_name: Optional[str] = None

    # Telemetry
    intent: Optional[str] = None
    sentiment: str = "Neutral"  # "Calm", "Neutral", "Anxious", "Frustrated"
    transcripts: List[TranscriptEntry] = Field(default_factory=list)
    transferred_to: Optional[str] = None
    disposition: Optional[str] = None
    metadata: Dict = Field(default_factory=dict)

    def add_transcript(self, speaker: str, text: str, lang: Optional[str] = None):
        self.transcripts.append(TranscriptEntry(
            speaker=speaker,
            text=text,
            language=lang or self.language
        ))

    def close(self, disposition: str = "normal_hangup"):
        self.status = CallStatus.COMPLETED
        self.end_time = time.time()
        self.duration_seconds = max(0.0, round(self.end_time - self.start_time, 1))
        self.disposition = disposition


class VoiceSessionManager:
    """Thread-safe state manager for all active call sessions."""

    def __init__(self):
        self._sessions: Dict[str, CallSession] = {}

    def create_session(
        self,
        call_id: str,
        caller_number: str,
        trunk_id: str = "DEFAULT-TRUNK",
        language: str = "ta-IN"
    ) -> CallSession:
        session = CallSession(
            call_id=call_id,
            caller_number=caller_number,
            trunk_id=trunk_id,
            language=language,
            status=CallStatus.CONNECTED
        )
        self._sessions[call_id] = session
        return session

    def get_session(self, call_id: str) -> Optional[CallSession]:
        return self._sessions.get(call_id)

    def update_status(self, call_id: str, status: CallStatus) -> Optional[CallSession]:
        session = self.get_session(call_id)
        if session:
            session.status = status
        return session

    def record_transcript(self, call_id: str, speaker: str, text: str, lang: Optional[str] = None):
        session = self.get_session(call_id)
        if session:
            session.add_transcript(speaker, text, lang)

    def set_verification(self, call_id: str, patient_id: str, patient_name: str):
        session = self.get_session(call_id)
        if session:
            session.is_verified = True
            session.patient_id = patient_id
            session.patient_name = patient_name

    def set_sentiment_and_intent(self, call_id: str, intent: Optional[str], sentiment: str):
        session = self.get_session(call_id)
        if session:
            if intent:
                session.intent = intent
            session.sentiment = sentiment

    def terminate_session(self, call_id: str, disposition: str = "completed") -> Optional[CallSession]:
        session = self.get_session(call_id)
        if session:
            session.close(disposition)
        return session

    def list_active_sessions(self) -> List[CallSession]:
        return [
            s for s in self._sessions.values()
            if s.status not in (CallStatus.COMPLETED, CallStatus.FAILED)
        ]

    def list_all_sessions(self) -> List[CallSession]:
        return list(self._sessions.values())


# Global singleton instance
session_manager = VoiceSessionManager()
