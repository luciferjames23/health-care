"""
phone_utils.py
==============
Utility functions for parsing, normalizing, and querying phone & WhatsApp numbers.
"""

import re

def normalize_phone(phone_str: str) -> str:
    """Strips all non-numeric characters from a phone number string."""
    if not phone_str:
        return ""
    digits = re.sub(r"\D", "", str(phone_str))
    return digits


def get_phone_query_condition(phone_col: str = "phone", wa_col: str = "whatsapp_number") -> str:
    """Returns SQL query condition for matching phone numbers across multiple formats."""
    return f"({phone_col} = %s OR {wa_col} = %s OR REPLACE(REPLACE(REPLACE({phone_col}, '+', ''), ' ', ''), '-', '') = %s)"


def get_phone_query_params(phone_number: str) -> tuple:
    """Returns parameter tuple matching the placeholders in get_phone_query_condition."""
    clean = normalize_phone(phone_number)
    raw = str(phone_number).strip() if phone_number else ""
    return (raw, raw, clean)
