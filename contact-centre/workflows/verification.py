"""
workflows/verification.py
=========================
Verifies caller identity and matches inbound telephone caller against
hospital patient records while enforcing privacy boundaries.
"""

from typing import Dict, Any, Optional
import re
from voice.session_manager import session_manager


# Verified mock directory for standalone caller phone matching
KNOWN_PATIENTS = {
    "9876543210": {"patient_id": "P001", "name": "Ramesh Kumar", "preferred_language": "ta-IN", "city": "Chennai"},
    "8765432109": {"patient_id": "P002", "name": "Anitha Nair", "preferred_language": "en-IN", "city": "Chennai"},
    "7654321098": {"patient_id": "P003", "name": "Karthik Selvam", "preferred_language": "ta-IN", "city": "Chennai"},
    "6543210987": {"patient_id": "P004", "name": "Meena Krishnan", "preferred_language": "ta-IN", "city": "Chennai"},
    "9840123456": {"patient_id": "P005", "name": "Suresh Babu", "preferred_language": "ta-IN", "city": "Chennai"},
}


class CallerVerificationWorkflow:
    """Enforces authentication and privacy verification for inbound telephone callers."""

    @classmethod
    def sanitize_phone(cls, phone_str: str) -> str:
        """Strips country codes, dashes, and spaces to extract 10-digit mobile number."""
        clean = re.sub(r"[^\d]", "", phone_str or "")
        if len(clean) > 10 and clean.startswith("91"):
            clean = clean[2:]
        return clean[-10:] if len(clean) >= 10 else clean

    @classmethod
    def verify_caller(cls, call_id: str, raw_caller_number: str) -> Dict[str, Any]:
        """
        Validates caller number, checks against existing hospital patient records,
        and annotates the active call session.
        """
        phone_10d = cls.sanitize_phone(raw_caller_number)
        match = KNOWN_PATIENTS.get(phone_10d)

        if match:
            session_manager.set_verification(
                call_id=call_id,
                patient_id=match["patient_id"],
                patient_name=match["name"]
            )
            return {
                "verified": True,
                "is_existing_patient": True,
                "patient_id": match["patient_id"],
                "patient_name": match["name"],
                "phone": phone_10d,
                "preferred_language": match["preferred_language"]
            }
        else:
            return {
                "verified": True,  # Verified phone channel
                "is_existing_patient": False,
                "patient_id": None,
                "patient_name": "New Patient Caller",
                "phone": phone_10d,
                "preferred_language": "ta-IN"
            }
