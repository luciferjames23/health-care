"""
phone_utils.py
==============
Authoritative phone number normalization, validation, and querying service for Hospital.
Uses Google's libphonenumber (via phonenumbers Python package) for robust, country-aware parsing.

Guarantees:
1. International-aware: Handles Indian (+91) as default hospital region, but cleanly supports US (+1), UK (+44), UAE (+971), Singapore (+65), etc.
2. Prevents double country codes (e.g. +91919876543210 -> +919876543210).
3. Preserves national significant digits and valid country codes.
4. Provides canonical E.164 format (+<country><national>) for DB storage.
5. Provides digits-only format (<country><national>) for Meta WhatsApp API dispatch.
6. Multi-variant querying matches legacy records (+91..., 91..., and 10 digits) without duplicate collisions.
"""

import re
from typing import Optional, Tuple, List, Dict, Any

try:
    import phonenumbers
except ImportError:
    phonenumbers = None


def parse_and_normalize_phone(
    phone_input: Optional[str],
    default_region: str = "IN"
) -> Tuple[Optional[str], Optional[str], bool]:
    """
    Parses and normalizes a phone number into:
    (canonical_e164, meta_digits, is_valid)

    Examples:
        '9876543210'        -> ('+919876543210', '919876543210', True)
        '+919876543210'     -> ('+919876543210', '919876543210', True)
        '919876543210'      -> ('+919876543210', '919876543210', True)
        '09876543210'       -> ('+919876543210', '919876543210', True)
        '+91 98765 43210'   -> ('+919876543210', '919876543210', True)
        '+91919876543210'   -> ('+919876543210', '919876543210', True)  # Double CC stripped
        '+14155552671'      -> ('+14155552671', '14155552671', True)    # US preserved
        '447911123456'      -> ('+447911123456', '447911123456', True)  # UK preserved
        'invalid'           -> (None, None, False)
    """
    if not phone_input:
        return (None, None, False)

    s = str(phone_input).strip()
    digits = re.sub(r"\D", "", s)
    if not digits:
        return (None, None, False)

    # 1. Detect and repair accidental double country code (e.g. +9191[6-9]..., 9191[6-9]...)
    if len(digits) == 14 and digits.startswith("9191") and digits[4] in "6789":
        digits = digits[2:]
        s = "+" + digits
    elif len(digits) == 12 and digits.startswith("91") and s.startswith("+91") and digits[2:4] == "91" and digits[4] in "6789":
        digits = digits[2:]
        s = "+" + digits

    if phonenumbers is None:
        if len(digits) == 10:
            return (f"+91{digits}", f"91{digits}", True)
        elif len(digits) == 12 and digits.startswith("91"):
            return (f"+{digits}", digits, True)
        elif s.startswith("+") and 10 <= len(digits) <= 15:
            return (f"+{digits}", digits, True)
        elif 10 <= len(digits) <= 15:
            return (f"+{digits}", digits, True)
        return (None, None, False)

    parsed = None

    # 2. If starts with '+', parse directly with international rule
    if s.startswith("+"):
        try:
            p = phonenumbers.parse(s, None)
            if phonenumbers.is_valid_number(p):
                parsed = p
        except Exception:
            pass

    # 3. If starts with '00' (international trunk prefix e.g. 0091...), convert to '+'
    if not parsed and digits.startswith("00") and len(digits) > 4:
        try:
            p = phonenumbers.parse("+" + digits[2:], None)
            if phonenumbers.is_valid_number(p):
                parsed = p
        except Exception:
            pass

    # 4. If starts with '0' (local trunk prefix), parse with default region
    if not parsed and digits.startswith("0") and len(digits) > 1:
        try:
            p = phonenumbers.parse(digits, default_region)
            if phonenumbers.is_valid_number(p):
                parsed = p
        except Exception:
            pass

    # 5. If digits length > 10 without '+', try parsing as international number with '+' prepended
    if not parsed and len(digits) > 10:
        try:
            p = phonenumbers.parse("+" + digits, None)
            if phonenumbers.is_valid_number(p):
                parsed = p
        except Exception:
            pass

    # 6. Parse with default hospital region (e.g. 10-digit Indian numbers)
    if not parsed:
        try:
            p = phonenumbers.parse(s, default_region)
            if phonenumbers.is_valid_number(p):
                parsed = p
        except Exception:
            pass

    # 7. Check if number is possible if not strictly valid (lenient fallback for local numbering variations)
    if not parsed:
        try:
            p = phonenumbers.parse("+" + digits if len(digits) > 10 else digits, default_region)
            if phonenumbers.is_possible_number(p):
                parsed = p
        except Exception:
            pass

    if parsed and (phonenumbers.is_valid_number(parsed) or phonenumbers.is_possible_number(parsed)):
        e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        meta_digits = e164.lstrip("+")
        return (e164, meta_digits, True)

    return (None, None, False)


def to_canonical_e164(phone_input: Optional[str], default_region: str = "IN") -> str:
    """
    Returns canonical E.164 phone string (e.g. '+919876543210') or empty string if invalid.
    """
    e164, _, valid = parse_and_normalize_phone(phone_input, default_region)
    return e164 if valid and e164 else ""


def to_meta_digits(phone_input: Optional[str], default_region: str = "IN") -> str:
    """
    Returns provider-ready phone digits without '+' for Meta WhatsApp Cloud API dispatch.
    Example: '+919876543210' -> '919876543210'
    """
    _, digits, valid = parse_and_normalize_phone(phone_input, default_region)
    if valid and digits:
        return digits
    # Fallback to stripped digits if library could not validate completely
    raw_digits = re.sub(r"\D", "", str(phone_input or ""))
    if len(raw_digits) == 10:
        return f"91{raw_digits}"
    return raw_digits


def normalize_phone(phone_str: Optional[str]) -> str:
    """
    Backward-compatible normalization function used across existing services and cache keys.
    Returns 10-digit national number for Indian numbers or normalized digits for international numbers.
    """
    if not phone_str:
        return ""
    e164, digits, valid = parse_and_normalize_phone(phone_str)
    if valid and digits:
        if digits.startswith("91") and len(digits) == 12:
            return digits[2:]  # 10 digits for Indian mobile
        return digits
    # Fallback to legacy regex if unparseable
    d = re.sub(r"\D", "", str(phone_str))
    if len(d) >= 10:
        return d[-10:]
    return d


def clean_whatsapp_number(to_number: str) -> str:
    """
    Alias for to_meta_digits. Ensures phone number has country code for Meta Cloud API dispatch
    without blindly hardcoding '91' to non-Indian numbers.
    """
    return to_meta_digits(to_number)


def get_phone_lookup_variants(phone_str: Optional[str]) -> List[str]:
    """
    Generates all canonical and legacy variations of a phone number for comprehensive database lookup.
    Example for '9876543210' / '+919876543210':
      ['+919876543210', '919876543210', '9876543210']
    """
    if not phone_str:
        return []
    raw = str(phone_str).strip()
    e164, digits, valid = parse_and_normalize_phone(raw)
    variants = set()
    if raw:
        variants.add(raw)
    if valid and e164:
        variants.add(e164)
    if valid and digits:
        variants.add(digits)
        if digits.startswith("91") and len(digits) == 12:
            variants.add(digits[2:])
    norm_10 = normalize_phone(raw)
    if norm_10:
        variants.add(norm_10)
        variants.add(f"+91{norm_10}")
        variants.add(f"91{norm_10}")
    return [v for v in variants if v]


def get_phone_query_condition() -> str:
    """
    Returns SQL WHERE fragment for matching phone or whatsapp_number.
    Covers exact matches on raw, canonical E.164, meta digits, and 10-digit suffixes.
    Expects 8 parameters matching get_phone_query_params().
    """
    return """(
        phone = %s OR whatsapp_number = %s OR
        phone = %s OR whatsapp_number = %s OR
        phone = %s OR whatsapp_number = %s OR
        RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = %s OR
        RIGHT(REGEXP_REPLACE(COALESCE(whatsapp_number, ''), '[^0-9]', '', 'g'), 10) = %s
    )"""


def get_phone_query_params(phone_str: Optional[str]) -> Tuple[str, str, str, str, str, str, str, str]:
    """
    Builds the 8-tuple parameter for get_phone_query_condition().
    Parameters:
      (raw, raw, e164, e164, meta_digits, meta_digits, norm_10, norm_10)
    """
    raw = str(phone_str or "").strip()
    e164, digits, valid = parse_and_normalize_phone(raw)
    e164_val = e164 or raw
    digits_val = digits or raw
    norm_10 = normalize_phone(raw) or raw
    return (raw, raw, e164_val, e164_val, digits_val, digits_val, norm_10, norm_10)


def extract_whatsapp_number(conversation_code: str, state: Optional[dict] = None) -> str:
    """
    Extracts the verified WhatsApp mobile number from state, conversation record, or session code.
    Normalizes it into canonical E.164 or digits.
    Filters out default placeholder '919999999999'.
    """
    raw_found = None
    if state:
        wn = state.get("whatsapp_number") or state.get("whatsapp_phone") or state.get("phone")
        if wn and str(wn).strip() and str(wn).strip() not in ("919999999999", "+919999999999"):
            raw_found = str(wn).strip()

    if not raw_found and conversation_code:
        if conversation_code.startswith("WA_"):
            raw_num = conversation_code[3:].split("_")[0]
            if raw_num and raw_num not in ("919999999999", "+919999999999"):
                raw_found = raw_num
        elif "_" in conversation_code:
            parts = conversation_code.split("_")
            for p in parts:
                digits = re.sub(r"\D", "", p)
                if len(digits) >= 7 and p not in ("919999999999", "+919999999999"):
                    raw_found = p
                    break
        else:
            digits = re.sub(r"\D", "", str(conversation_code))
            if len(digits) >= 7 and digits not in ("919999999999", "+919999999999"):
                raw_found = digits

    if raw_found:
        e164, digits, valid = parse_and_normalize_phone(raw_found)
        if valid and digits:
            return digits
        return raw_found

    return "919999999999"
