"""
phone_utils.py
==============
Utilities for phone number normalization and PostgreSQL queries.
Handles 10-digit national numbers (e.g. 9876543210), international format (e.g. 919876543210),
and formatted phone strings (e.g. +91 98765 43210).
"""

import re
from typing import Optional, Tuple


def normalize_phone(phone_str: Optional[str]) -> str:
    """
    Extracts the last 10 digits of a phone string for consistent lookup.
    Example:
        '919876543210' -> '9876543210'
        '+91 98765 43210' -> '9876543210'
        '09876543210' -> '9876543210'
        '9876543210' -> '9876543210'
    """
    if not phone_str:
        return ""
    digits = re.sub(r"\D", "", str(phone_str))
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def get_phone_query_condition() -> str:
    """
    Returns SQL WHERE fragment for matching phone or whatsapp_number
    by exact string match OR 10-digit normalized suffix match.
    Expects 4 parameters: (raw_phone, raw_phone, last_10_digits, last_10_digits)
    """
    return """(
        phone = %s OR whatsapp_number = %s OR
        RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = %s OR
        RIGHT(REGEXP_REPLACE(COALESCE(whatsapp_number, ''), '[^0-9]', '', 'g'), 10) = %s
    )"""


def get_phone_query_params(phone_str: Optional[str]) -> Tuple[str, str, str, str]:
    """
    Builds the 4-tuple parameter for get_phone_query_condition().
    """
    raw = str(phone_str or "").strip()
    norm = normalize_phone(raw)
    return (raw, raw, norm, norm)


def extract_whatsapp_number(conversation_code: str, state: Optional[dict] = None) -> str:
    """
    Extracts the best valid WhatsApp mobile number from state, conversation record, or session code.
    Filters out default placeholder '919999999999'.
    """
    if state:
        wn = state.get("whatsapp_number") or state.get("whatsapp_phone") or state.get("phone")
        if wn and str(wn).strip() and str(wn).strip() != "919999999999":
            return str(wn).strip()

    if conversation_code:
        if conversation_code.startswith("WA_"):
            raw_num = conversation_code[3:].split("_")[0]
            if raw_num and raw_num != "919999999999":
                return raw_num
        elif "_" in conversation_code:
            parts = conversation_code.split("_")
            for p in parts:
                digits = re.sub(r"\D", "", p)
                if len(digits) >= 7 and p != "919999999999":
                    return p
        else:
            digits = re.sub(r"\D", "", str(conversation_code))
            if len(digits) >= 7 and digits != "919999999999":
                return digits

    return "919999999999"

