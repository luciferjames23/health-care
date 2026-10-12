"""
config.py
=========
Central configuration management for the AG-12 Contact Centre Voice Agent.
Loads settings from environment variables with safe defaults.
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load local .env if present
load_dotenv()


class Settings:
    PORT: int = int(os.getenv("PORT", "8012"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")
    PUBLIC_BASE_URL: str = os.getenv("PUBLIC_BASE_URL", "http://localhost:8012")

    # API Security
    API_SECRET_KEY: str = os.getenv("API_SECRET_KEY", "dev-contact-centre-secret-key-12345")
    WEBHOOK_SIGNATURE_SECRET: str = os.getenv("WEBHOOK_SIGNATURE_SECRET", "dev-webhook-secret-98765")

    # Hospital REST API Integration
    HOSPITAL_API_BASE_URL: str = os.getenv("HOSPITAL_API_BASE_URL", "http://localhost:8000")
    HOSPITAL_API_TIMEOUT_SECONDS: float = float(os.getenv("HOSPITAL_API_TIMEOUT_SECONDS", "10.0"))
    HOSPITAL_API_KEY: str = os.getenv("HOSPITAL_API_KEY", "hospital-internal-service-token")

    # Voice / Telephony Provider Selection: "twilio", "exotel", "generic_sip"
    TELEPHONY_PROVIDER: str = os.getenv("TELEPHONY_PROVIDER", "twilio")
    SIP_INBOUND_TRUNK_ID: str = os.getenv("SIP_INBOUND_TRUNK_ID", "TRUNK-IND-TN-044")
    VOICE_DEFAULT_LANGUAGE: str = os.getenv("VOICE_DEFAULT_LANGUAGE", "ta-IN")  # Tamil
    VOICE_FALLBACK_LANGUAGE: str = os.getenv("VOICE_FALLBACK_LANGUAGE", "en-IN")  # Indian English

    # --- Twilio Telephony Configuration ---
    TWILIO_ACCOUNT_SID: str = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_AUTH_TOKEN: str = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_PHONE_NUMBER: str = os.getenv("TWILIO_PHONE_NUMBER", "+18005550199")

    # --- Exotel Telephony Configuration (India) ---
    EXOTEL_ACCOUNT_SID: str = os.getenv("EXOTEL_ACCOUNT_SID", "")
    EXOTEL_API_KEY: str = os.getenv("EXOTEL_API_KEY", "")
    EXOTEL_API_TOKEN: str = os.getenv("EXOTEL_API_TOKEN", "")
    EXOTEL_VIRTUAL_NUMBER: str = os.getenv("EXOTEL_VIRTUAL_NUMBER", "04466669000")
    EXOTEL_SUB_DOMAIN: str = os.getenv("EXOTEL_SUB_DOMAIN", "api.exotel.com")

    # SIP Routing Extensions / Fallback Numbers
    EMERGENCY_DESK_SIP: str = os.getenv("EMERGENCY_DESK_SIP", "sip:casualty-desk@hospital.local")
    EMERGENCY_DESK_PHONE: str = os.getenv("EMERGENCY_DESK_PHONE", "+914466669999")
    BILLING_DESK_SIP: str = os.getenv("BILLING_DESK_SIP", "sip:billing-help@hospital.local")
    HUMAN_AGENT_POOL_SIP: str = os.getenv("HUMAN_AGENT_POOL_SIP", "sip:contact-queue@hospital.local")
    HUMAN_OPERATOR_PHONE: str = os.getenv("HUMAN_OPERATOR_PHONE", "+919876543210")


settings = Settings()
