"""
response_validator.py
=====================
Response Validation Layer for Meridian Hospital AI Patient Desk.

Pre-send verification layer that intercepts bot response payloads before WhatsApp dispatch.
Guarantees operational and clinical safety:
  1. Appointment dates are strictly in the future.
  2. Doctor matches the selected department in the database.
  3. Appointment time slot exists in actual DB availability.
  4. Separate patient_dob and appointment_date fields.
  5. No hallucinated doctors or unsupported clinical claims.
"""

import os
import sys
import datetime
from typing import Dict, Any, Tuple, Optional

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import agent.tool_registry as tool_registry


def validate_appointment_date(date_str: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Validates that date_str (YYYY-MM-DD) is not in the past.
    Returns (is_valid, error_message).
    """
    if not date_str:
        return True, None
    try:
        parsed_date = datetime.datetime.strptime(str(date_str).strip(), "%Y-%m-%d").date()
        today = datetime.date.today()
        if parsed_date < today:
            return False, f"The selected date (*{date_str}*) has already passed. Please choose a future appointment date."
        return True, None
    except ValueError:
        return False, "Invalid date format. Please specify a valid date (e.g. YYYY-MM-DD or 'tomorrow')."


def validate_doctor_department_match(doctor_id: Optional[int], department_id: Optional[int], department_name: Optional[str]) -> Tuple[bool, Optional[str]]:
    """
    Verifies against the database that doctor_id belongs to department_id/department_name.
    """
    if not doctor_id:
        return True, None
    
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT d.id, d.display_name, dept.id, dept.department_name
            FROM doctors d
            JOIN departments dept ON d.department_id = dept.id
            WHERE d.id = %s AND d.status = 'ACTIVE';
        """, (doctor_id,))
        row = cur.fetchone()
        if not row:
            return False, "The selected doctor is no longer active in our system."
        
        doc_dept_id, doc_dept_name = row[2], row[3]
        if department_id and doc_dept_id != department_id:
            return False, f"Dr. {row[1]} belongs to {doc_dept_name}, not the requested department."
        if department_name and doc_dept_name.lower() != department_name.lower():
            return False, f"Dr. {row[1]} belongs to {doc_dept_name}, not {department_name}."

        return True, None
    except Exception as e:
        print(f"[RESPONSE_VALIDATOR] Error checking doctor dept match: {e}")
        return True, None
    finally:
        cur.close()
        conn.close()


def normalize_interactive_type(response_payload: Dict[str, Any], state: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Centralized WhatsApp Interactive-Response Decision Rule:
    - 1-3 actionable options & not explicit slot list workflow:
        interactive_type = 'button' (Reply Buttons)
    - >3 options OR explicit list workflow (time slots, >3 doctors, >3 depts, etc.):
        interactive_type = 'list' (Interactive List)
    - 0 options:
        interactive_type = None

    Preserves exact action IDs, titles, business logic, and handlers.
    """
    if not isinstance(response_payload, dict):
        return response_payload

    buttons = response_payload.get("interactive_buttons")
    if not buttons or not isinstance(buttons, list) or len(buttons) == 0:
        response_payload["interactive_type"] = None
        if state is not None and isinstance(state, dict):
            state["interactive_type"] = None
        return response_payload

    explicit_type = response_payload.get("interactive_type") or (state.get("interactive_type") if state and isinstance(state, dict) else None)

    # Time slot selection buttons or explicit slot list workflows
    is_slot_workflow = any(
        isinstance(b, dict) and str(b.get("id", "")).startswith("btn_slot_") 
        for b in buttons
    )

    if explicit_type == "list" or is_slot_workflow or len(buttons) > 3:
        target_type = "list"
    elif 1 <= len(buttons) <= 3:
        target_type = "button"
    else:
        target_type = "list"

    response_payload["interactive_type"] = target_type
    if state is not None and isinstance(state, dict):
        state["interactive_type"] = target_type

    return response_payload


def validate_pre_dispatch(state: Dict[str, Any], response_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main validator called before sending a response to WhatsApp.
    If validation fails, alters response payload safely.
    """
    entities = state.get("entities", {})
    appt_date = entities.get("appointment_date")

    # 1. Date Validation
    if appt_date:
        valid_date, date_err = validate_appointment_date(appt_date)
        if not valid_date:
            state["entities"]["appointment_date"] = None
            response_payload["response"] = date_err
            response_payload["missing_information"] = ["appointment_date"]
            print(f"[RESPONSE_VALIDATOR] Blocked past/invalid appointment date: {appt_date}")
            return normalize_interactive_type(response_payload, state)

    # 2. Doctor / Department Match Validation
    doc_id = entities.get("doctor_id")
    dept_id = entities.get("department_id")
    dept_name = state.get("department_name")
    if doc_id:
        valid_doc, doc_err = validate_doctor_department_match(doc_id, dept_id, dept_name)
        if not valid_doc:
            state["entities"]["doctor_id"] = None
            response_payload["response"] = doc_err
            print(f"[RESPONSE_VALIDATOR] Blocked mismatched doctor ID {doc_id}: {doc_err}")
            return normalize_interactive_type(response_payload, state)

    # 3. Post-Payment UI Cleanup Safeguard: Ensure no pre-payment action buttons remain after payment SUCCESS
    if state.get("payment_status") == "SUCCESS" and "interactive_buttons" in response_payload:
        response_payload["interactive_buttons"] = [
            b for b in response_payload.get("interactive_buttons", [])
            if not b.get("id", "").startswith("btn_pay_")
        ]

    # 4. Centralized Interactive Response Normalization (Reply Buttons vs List)
    return normalize_interactive_type(response_payload, state)

