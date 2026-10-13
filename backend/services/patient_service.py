"""
patient_service.py
==================
Authoritative Central Patient Registration & ID Generation Service for Meridian Hospital.
Shared across both Portal (Web/Admin) and WhatsApp AI Patient Desk.

Key Guarantees:
1. Multiple different patients (family members/dependents) can share the same contact/phone number.
2. Phone number match alone NEVER treats a new patient as an existing patient.
3. Every newly registered patient receives an atomic, unique canonical UHID: MER-PAT-{id.zfill(7)}.
4. Concurrency-safe ID allocation backed by PostgreSQL sequence 'patients_id_seq'.
5. Legacy patient IDs (e.g. P000..., older formats) are preserved without modification.
6. Central cache invalidation on any patient registration or contact update.
"""

import sys
import os
import re
from datetime import datetime, date
from typing import Optional, Dict, Any, Tuple

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import utils.cache_service as cache_service
from utils.phone_utils import normalize_phone, to_canonical_e164, get_phone_query_condition, get_phone_query_params


def get_next_canonical_patient_id(cur) -> Tuple[int, str]:
    """
    Atomically allocates the next patient ID and canonical UHID code from PostgreSQL sequence.
    Guarantees no race condition or collision between concurrent registrations across Portal and WhatsApp.
    Format: MER-PAT-{str(next_id).zfill(7)} (e.g. MER-PAT-1004510)
    """
    # 1. Ensure sequence is synchronized at or above MAX(id) in patients table
    cur.execute("""
        SELECT setval(
            'patients_id_seq', 
            GREATEST(
                COALESCE((SELECT MAX(id) FROM patients), 0), 
                (SELECT last_value FROM patients_id_seq)
            )
        );
    """)
    
    # 2. Allocate next sequence value
    cur.execute("SELECT nextval('patients_id_seq');")
    next_id = cur.fetchone()[0]
    
    # 3. Check for any collision with legacy/existing patient_code and advance if needed
    canonical_code = f"MER-PAT-{str(next_id).zfill(7)}"
    while True:
        cur.execute("SELECT 1 FROM patients WHERE id = %s OR patient_code = %s;", (next_id, canonical_code))
        if not cur.fetchone():
            break
        cur.execute("SELECT nextval('patients_id_seq');")
        next_id = cur.fetchone()[0]
        canonical_code = f"MER-PAT-{str(next_id).zfill(7)}"
        
    return next_id, canonical_code


def find_identical_registered_patient(
    cur,
    first_name: str,
    last_name: str,
    date_of_birth: str,
    phone: str
) -> Optional[Tuple[int, str]]:
    """
    Checks if this EXACT individual (same person: matching name, DOB, and phone)
    is already actively registered.
    
    CRITICAL: A phone number match alone NEVER constitutes an existing patient match!
    Different family members with different names or DOBs sharing the phone number
    will return None, allowing a separate patient record to be registered.
    """
    fn = (first_name or "").strip()
    ln = (last_name or "").strip()
    dob_str = str(date_of_birth or "").strip()
    ph = (phone or "").strip()
    
    if not fn or not dob_str or not ph:
        return None
        
    phone_cond = get_phone_query_condition()
    phone_params = get_phone_query_params(ph)

    query = f"""
        SELECT id, patient_code, first_name, last_name, date_of_birth
        FROM patients
        WHERE LOWER(TRIM(first_name)) = LOWER(TRIM(%s))
          AND (
              (last_name IS NOT NULL AND %s != '' AND LOWER(TRIM(last_name)) = LOWER(TRIM(%s)))
              OR (%s = '' AND (last_name IS NULL OR last_name = '' OR last_name = '.'))
          )
          AND date_of_birth = %s
          AND {phone_cond}
          AND status = 'ACTIVE'
        ORDER BY id ASC
        LIMIT 1;
    """
    params = (fn, ln, ln, ln, dob_str) + phone_params
    cur.execute(query, params)
    row = cur.fetchone()
    if row:
        return (row[0], row[1])
    return None


def register_new_patient(
    first_name: str,
    last_name: str = "",
    date_of_birth: Optional[str] = None,
    gender: str = "Male",
    phone: str = "",
    whatsapp_number: Optional[str] = None,
    email: Optional[str] = None,
    address: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    pincode: Optional[str] = None,
    blood_group: Optional[str] = "O+",
    preferred_language: Optional[str] = "English",
    emergency_contact_name: Optional[str] = None,
    emergency_contact_phone: Optional[str] = None,
    guardian_patient_id: Optional[int] = None,
    guardian_phone: Optional[str] = None,
    relationship_to_contact: Optional[str] = None,
    is_dependent: bool = False,
    marital_status: Optional[str] = None,
    conn=None
) -> Dict[str, Any]:
    """
    Atomically registers a new patient in PostgreSQL with a canonical UHID.
    Can be called within an existing transaction (if conn provided) or manages its own.
    
    Guarantees:
    - Multiple different patients sharing the same phone number each receive unique IDs.
    - Invalidates phone-to-patient lookup caches.
    - Returns the saved database record.
    """
    should_close_conn = False
    if conn is None:
        conn = db_config.get_db_connection()
        should_close_conn = True
        
    cur = conn.cursor()
    try:
        fn = (first_name or "").strip()
        ln = (last_name or "").strip()
        if not fn:
            raise ValueError("Patient first name is required")
            
        gen = (gender or "Male").capitalize()
        if gen.lower().startswith("f"): gen = "Female"
        elif gen.lower().startswith("o"): gen = "Other"
        else: gen = "Male"
        
        dob_val = str(date_of_birth or "2000-01-01").strip()
        ph_val = (phone or "").strip()
        wa_val = (whatsapp_number or ph_val).strip()

        # Canonicalize to E.164 for uniform DB storage
        ph_canon = to_canonical_e164(ph_val) or ph_val
        wa_canon = to_canonical_e164(wa_val) or wa_val

        # 1. Allocate next canonical patient ID and code
        new_id, canonical_code = get_next_canonical_patient_id(cur)

        # 2. Insert into patients table
        insert_sql = """
            INSERT INTO patients (
                id, patient_code, first_name, last_name, date_of_birth, gender,
                phone, whatsapp_number, email, address, city, state, pincode,
                emergency_contact_name, emergency_contact_phone, blood_group,
                preferred_language, marital_status, guardian_patient_id, guardian_phone,
                relationship_to_contact, is_dependent, status, registration_date,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, 'ACTIVE', CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id, patient_code, first_name, last_name, date_of_birth, gender, phone, whatsapp_number;
        """
        cur.execute(insert_sql, (
            new_id, canonical_code, fn, ln, dob_val, gen,
            ph_canon, wa_canon, email, address or "Chennai Metropolitan Area",
            city or "Chennai", state or "Tamil Nadu", pincode or "600001",
            emergency_contact_name, emergency_contact_phone, blood_group or "O+",
            preferred_language or "English", marital_status, guardian_patient_id, guardian_phone,
            relationship_to_contact, is_dependent
        ))
        row = cur.fetchone()
        saved_id, saved_code = row[0], row[1]

        if should_close_conn:
            conn.commit()

        # Invalidate cache for all phone variations
        for p in [ph_val, wa_val, ph_canon, wa_canon]:
            norm = normalize_phone(p)
            if norm:
                cache_service.invalidate_cache(f"pat_phone_{norm}")
        cache_service.invalidate_cache("pat_phone_")
        
        return {
            "success": True,
            "id": saved_id,
            "patient_id": saved_id,
            "patient_code": saved_code,
            "uhid": saved_code,
            "first_name": row[2],
            "last_name": row[3],
            "name": f"{row[2] or ''} {row[3] or ''}".strip(),
            "patient_name": f"{row[2] or ''} {row[3] or ''}".strip(),
            "date_of_birth": str(row[4]) if row[4] else None,
            "gender": row[5],
            "phone": row[6],
            "whatsapp_number": row[7]
        }
    except Exception as e:
        if should_close_conn:
            conn.rollback()
        raise e
    finally:
        cur.close()
        if should_close_conn:
            conn.close()
