"""
queue_service.py
================
AG-06 Queue / Flow Agent — Core Queue Engine.

Provides ALL deterministic queue calculations:
- Queue session management
- Patient check-in and token assignment
- Queue position calculation
- Estimated wait time calculation
- Queue state transitions (call, start, complete, pause, resume, cancel)
- Doctor delay detection

CRITICAL RULES (from AG-06 specification):
- LLM MUST NOT calculate token numbers, positions, or ETAs
- All values come from backend/database state
- Token assignment is transaction-safe with row-level locking
- No two patients may receive the same token
- WhatsApp failure MUST NOT corrupt queue state

Integrates with:
- db_config.get_db_connection() — existing PostgreSQL pool
- appointment_service.py — existing appointment validation helpers
- voice/whatsapp_client.py — via queue_notification_service (NOT directly)

Step: AG-06 Phase 4-7
"""

import datetime
import psycopg2
import traceback
from typing import Optional, Dict, Any, List

import db_config
from appointment_service import (
    validate_patient, validate_doctor, validate_department,
    AppointmentError, EntityNotFoundError
)


# ─── Custom Queue Exceptions ───────────────────────────────────────────────────

class QueueError(Exception):
    def __init__(self, message: str, error_code: str = "QUEUE_ERROR"):
        super().__init__(message)
        self.message = message
        self.error_code = error_code

class DuplicateCheckInError(QueueError):
    pass

class AppointmentNotEligibleError(QueueError):
    pass

class QueueSessionNotFoundError(QueueError):
    pass

class QueueEntryNotFoundError(QueueError):
    pass

class InvalidQueueStatusTransitionError(QueueError):
    pass


# ─── Eligible appointment statuses for check-in ───────────────────────────────
ELIGIBLE_APPOINTMENT_STATUSES = frozenset(['BOOKED', 'CONFIRMED'])

# ─── Queue session init / get ──────────────────────────────────────────────────

def get_or_create_queue_session(
    conn,
    doctor_id: int,
    department_id: int,
    queue_date: datetime.date,
    room_number: Optional[str] = None,
    created_by_user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Get existing queue session for doctor/date or create a new one.
    Safe for concurrent check-ins (SELECT FOR UPDATE).
    """
    cur = conn.cursor()
    try:
        # Try to get existing session first
        cur.execute("""
            SELECT id, doctor_id, department_id, queue_date, room_number,
                   status, current_token_number, started_at, created_at
            FROM queue_sessions
            WHERE doctor_id = %s AND queue_date = %s
            FOR UPDATE;
        """, (doctor_id, queue_date))
        row = cur.fetchone()

        if row:
            # Session exists — validate it's usable
            session_id, dr_id, dept_id, q_date, room, status, curr_token, started_at, created_at = row
            if status == 'CANCELLED':
                raise QueueError(
                    f"Queue for Dr. {doctor_id} on {queue_date} has been cancelled.",
                    "QUEUE_CANCELLED"
                )
            return {
                "id": session_id,
                "doctor_id": dr_id,
                "department_id": dept_id,
                "queue_date": q_date,
                "room_number": room,
                "status": status,
                "current_token_number": curr_token,
                "started_at": started_at,
                "created_at": created_at,
                "is_new": False
            }

        # Create new session
        cur.execute("""
            INSERT INTO queue_sessions (
                doctor_id, department_id, queue_date, room_number,
                status, current_token_number, created_by_user_id, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, 'OPEN', 0, %s, NOW(), NOW())
            RETURNING id, status, current_token_number, created_at;
        """, (doctor_id, department_id, queue_date, room_number, created_by_user_id))
        session_id, status, curr_token, created_at = cur.fetchone()

        print(f"[QUEUE] New queue session created: id={session_id} doctor={doctor_id} date={queue_date}")
        return {
            "id": session_id,
            "doctor_id": doctor_id,
            "department_id": department_id,
            "queue_date": queue_date,
            "room_number": room_number,
            "status": status,
            "current_token_number": curr_token,
            "started_at": None,
            "created_at": created_at,
            "is_new": True
        }
    finally:
        cur.close()


def get_slot_duration_minutes(conn, doctor_id: int, queue_date: datetime.date) -> int:
    """
    Retrieve the configured slot duration for this doctor on this date.
    Uses doctor_schedules.slot_duration_minutes — real data, not hardcoded.
    Falls back to 10 minutes if schedule not found (still configurable via DB).
    """
    cur = conn.cursor()
    try:
        day_name = queue_date.strftime('%A').upper()  # e.g. 'MONDAY'
        cur.execute("""
            SELECT slot_duration_minutes
            FROM doctor_schedules
            WHERE doctor_id = %s
              AND day_of_week = %s
              AND status = 'ACTIVE'
              AND effective_from <= %s
              AND (effective_to IS NULL OR effective_to >= %s)
            ORDER BY effective_from DESC
            LIMIT 1;
        """, (doctor_id, day_name, queue_date, queue_date))
        row = cur.fetchone()
        if row and row[0] and row[0] > 0:
            return row[0]
        # If no schedule found, use 10 as a reasonable minimum default
        # This is the ONLY place a default value is used, and it's documented here
        return 10
    finally:
        cur.close()


# ─── Check-in & Token Assignment ──────────────────────────────────────────────

def patient_check_in(
    appointment_id: int,
    room_number: Optional[str] = None,
    created_by_user_id: Optional[int] = None,
    expected_doctor_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Full patient check-in workflow:
    1. Validate appointment eligibility
    2. Get or create queue session
    3. Assign next token (transaction-safe)
    4. Create queue entry
    5. Calculate position and ETA
    6. Return complete queue entry for AG-06 notification

    This is the primary entry point for AG-06 TOKEN_ASSIGNED event.
    """
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # ── Step 1: Validate and fetch appointment ────────────────────────────
        cur.execute("""
            SELECT id, patient_id, doctor_id, department_id,
                   appointment_date, appointment_time, status
            FROM appointments
            WHERE id = %s
            FOR UPDATE;
        """, (appointment_id,))
        appt_row = cur.fetchone()

        if not appt_row:
            raise EntityNotFoundError(
                f"Appointment ID {appointment_id} not found.", "APPOINTMENT_NOT_FOUND"
            )

        appt_id, patient_id, doctor_id, department_id, appt_date, appt_time, appt_status = appt_row

        if expected_doctor_id is not None and doctor_id != expected_doctor_id:
            raise AppointmentNotEligibleError(
                f"Appointment {appointment_id} belongs to doctor ID {doctor_id}, not expected doctor ID {expected_doctor_id}.",
                "WRONG_DOCTOR"
            )

        # ── Step 2: Check for existing check-in (Idempotency) ─────────────────
        cur.execute("""
            SELECT id, token_number, queue_status, queue_session_id, position, patients_ahead, estimated_wait_minutes, checked_in_at
            FROM queue_entries
            WHERE appointment_id = %s;
        """, (appointment_id,))
        existing_entry = cur.fetchone()
        if existing_entry:
            entry_id, token_num, q_status, session_id, pos, ahead, est_wait, checked_in_at = existing_entry
            patient_info = validate_patient(cur, patient_id)
            doctor_info = validate_doctor(cur, doctor_id)
            dept_name = validate_department(cur, department_id)
            conn.commit()
            return {
                "success": True,
                "is_duplicate": True,
                "entry_id": entry_id,
                "queue_session_id": session_id,
                "appointment_id": appointment_id,
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "department_id": department_id,
                "token_number": token_num,
                "queue_status": q_status,
                "position": pos,
                "patients_ahead": ahead,
                "estimated_wait_minutes": est_wait,
                "patient_name": patient_info.get("name"),
                "whatsapp_number": patient_info.get("whatsapp_number") or patient_info.get("phone"),
                "doctor_name": doctor_info.get("name"),
                "department_name": dept_name,
                "queue_date": str(appt_date),
                "checked_in_at": checked_in_at.isoformat() if checked_in_at else None,
                "message": f"Appointment {appointment_id} already checked in. Token #{token_num} retained."
            }

        # Validate status if not already checked in
        if appt_status not in ELIGIBLE_APPOINTMENT_STATUSES:
            raise AppointmentNotEligibleError(
                f"Appointment {appointment_id} has status '{appt_status}' and cannot be queued. "
                f"Only {', '.join(ELIGIBLE_APPOINTMENT_STATUSES)} appointments are eligible.",
                "APPOINTMENT_NOT_ELIGIBLE"
            )

        today = datetime.date.today()
        if appt_date != today:
            raise AppointmentNotEligibleError(
                f"Appointment {appointment_id} is for {appt_date}, not today ({today}).",
                "APPOINTMENT_WRONG_DATE"
            )

        # ── Step 4: Validate patient, doctor, department ──────────────────────
        patient_info = validate_patient(cur, patient_id)
        doctor_info = validate_doctor(cur, doctor_id)
        dept_name = validate_department(cur, department_id)

        # ── Step 5: Get or create queue session ───────────────────────────────
        session = get_or_create_queue_session(
            conn=conn,
            doctor_id=doctor_id,
            department_id=department_id,
            queue_date=appt_date,
            room_number=room_number,
            created_by_user_id=created_by_user_id
        )
        session_id = session["id"]

        # If room_number provided and session exists without room, update it
        if room_number and not session.get("room_number"):
            cur.execute("""
                UPDATE queue_sessions SET room_number = %s, updated_at = NOW()
                WHERE id = %s;
            """, (room_number, session_id))
            session["room_number"] = room_number

        # ── Step 6: Assign next token (atomic increment with row lock) ────────
        cur.execute("""
            UPDATE queue_sessions
            SET current_token_number = current_token_number + 1,
                status = CASE WHEN status = 'OPEN' THEN 'ACTIVE' ELSE status END,
                started_at = CASE WHEN started_at IS NULL THEN NOW() ELSE started_at END,
                updated_at = NOW()
            WHERE id = %s
            RETURNING current_token_number;
        """, (session_id,))
        token_number = cur.fetchone()[0]

        # ── Step 7: Calculate position and ETA before insert ─────────────────
        slot_duration = get_slot_duration_minutes(conn, doctor_id, appt_date)

        # Count waiting patients in this session (those before this token)
        cur.execute("""
            SELECT COUNT(*)
            FROM queue_entries
            WHERE queue_session_id = %s
              AND queue_status IN ('WAITING', 'CALLED', 'NEXT')
              AND token_number < %s;
        """, (session_id, token_number))
        patients_ahead = cur.fetchone()[0]
        position = patients_ahead + 1  # 1-based
        estimated_wait = patients_ahead * slot_duration

        # ── Step 8: Create queue entry and update appointment status ────────
        cur.execute("""
            INSERT INTO queue_entries (
                queue_session_id, appointment_id, patient_id, doctor_id, department_id,
                token_number, queue_status, position, patients_ahead, estimated_wait_minutes,
                checked_in_at, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, 'WAITING', %s, %s, %s, NOW(), NOW(), NOW())
            RETURNING id, created_at;
        """, (
            session_id, appointment_id, patient_id, doctor_id, department_id,
            token_number, position, patients_ahead, estimated_wait
        ))
        entry_id, created_at = cur.fetchone()

        cur.execute("""
            UPDATE appointments
            SET status = 'CHECKED_IN', updated_at = NOW()
            WHERE id = %s;
        """, (appointment_id,))

        # ── Step 9: Log audit event ───────────────────────────────────────────
        _log_audit(cur,
            user_id=created_by_user_id,
            action='TOKEN_ASSIGNED',
            entity_type='queue_entries',
            entity_id=entry_id,
            new_values={
                "token_number": token_number,
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "session_id": session_id
            }
        )

        conn.commit()

        print(f"[QUEUE] Check-in complete: entry_id={entry_id} token=#{token_number} "
              f"patient={patient_id} doctor={doctor_id} position={position} "
              f"patients_ahead={patients_ahead} ETA={estimated_wait}min")

        return {
            "success": True,
            "entry_id": entry_id,
            "queue_session_id": session_id,
            "appointment_id": appointment_id,
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "department_id": department_id,
            "token_number": token_number,
            "queue_status": "WAITING",
            "position": position,
            "patients_ahead": patients_ahead,
            "estimated_wait_minutes": estimated_wait,
            "room_number": session.get("room_number"),
            "patient_name": patient_info.get("name"),
            "whatsapp_number": patient_info.get("whatsapp_number") or patient_info.get("phone"),
            "doctor_name": doctor_info.get("name"),
            "department_name": dept_name,
            "queue_date": str(appt_date),
            "checked_in_at": created_at.isoformat() if created_at else None
        }

    except (QueueError, AppointmentError, EntityNotFoundError):
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        raise QueueError(f"Unexpected error during check-in: {str(e)}", "CHECK_IN_FAILED")
    finally:
        cur.close()
        conn.close()


# ─── Queue Position Recalculation ─────────────────────────────────────────────

def recalculate_queue_positions(conn, queue_session_id: int) -> List[Dict[str, Any]]:
    """
    Recalculate position, patients_ahead, and estimated_wait for ALL waiting
    patients in a session after any state change.

    Called after:
    - CONSULTATION_COMPLETED
    - QUEUE_ENTRY_CANCELLED
    - NO_SHOW
    - QUEUE_RESUMED

    Returns: list of updated entry dicts for AG-06 notification decisions.
    """
    cur = conn.cursor()
    try:
        # Fetch session for slot duration
        cur.execute("""
            SELECT doctor_id, queue_date FROM queue_sessions WHERE id = %s;
        """, (queue_session_id,))
        session_row = cur.fetchone()
        if not session_row:
            return []
        doctor_id, queue_date = session_row

        slot_duration = get_slot_duration_minutes(conn, doctor_id, queue_date)

        # Fetch all active waiting entries ordered by token
        cur.execute("""
            SELECT id, token_number, patient_id, patients_ahead, estimated_wait_minutes
            FROM queue_entries
            WHERE queue_session_id = %s
              AND queue_status IN ('WAITING', 'NEXT')
            ORDER BY token_number ASC;
        """, (queue_session_id,))
        waiting_entries = cur.fetchall()

        updated = []
        for idx, (entry_id, token_num, patient_id, old_ahead, old_eta) in enumerate(waiting_entries):
            new_position = idx + 1
            new_patients_ahead = idx
            new_eta = new_patients_ahead * slot_duration

            # Only update if something changed
            if new_patients_ahead != old_ahead or new_eta != old_eta:
                cur.execute("""
                    UPDATE queue_entries
                    SET position = %s,
                        patients_ahead = %s,
                        estimated_wait_minutes = %s,
                        updated_at = NOW()
                    WHERE id = %s;
                """, (new_position, new_patients_ahead, new_eta, entry_id))

                updated.append({
                    "entry_id": entry_id,
                    "token_number": token_num,
                    "patient_id": patient_id,
                    "position": new_position,
                    "patients_ahead": new_patients_ahead,
                    "estimated_wait_minutes": new_eta,
                    "position_changed": True,
                    "old_patients_ahead": old_ahead,
                    "old_eta": old_eta
                })
            else:
                updated.append({
                    "entry_id": entry_id,
                    "token_number": token_num,
                    "patient_id": patient_id,
                    "position": new_position,
                    "patients_ahead": new_patients_ahead,
                    "estimated_wait_minutes": new_eta,
                    "position_changed": False
                })

        return updated
    finally:
        cur.close()


# ─── Queue State Transitions ──────────────────────────────────────────────────

def call_next_patient(queue_session_id: int, called_by_user_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Call the next waiting patient (lowest token number with WAITING status).
    Updates status to CALLED and records called_at timestamp.
    Returns full entry info for AG-06 PROCEED_TO_ROOM notification.
    """
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        # Get session
        cur.execute("""
            SELECT status, room_number, doctor_id
            FROM queue_sessions
            WHERE id = %s FOR UPDATE;
        """, (queue_session_id,))
        session = cur.fetchone()
        if not session:
            raise QueueSessionNotFoundError(f"Queue session {queue_session_id} not found.", "SESSION_NOT_FOUND")
        session_status, room_number, doctor_id = session

        if session_status == 'PAUSED':
            raise QueueError("Queue is paused. Resume before calling next patient.", "QUEUE_PAUSED")
        if session_status in ('CLOSED', 'CANCELLED'):
            raise QueueError(f"Queue session is {session_status}.", "QUEUE_CLOSED")

        # Mark current NEXT/CALLED entry as IN_CONSULTATION first (if any)
        # (Only one patient can be IN_CONSULTATION at a time — this is a doctor workflow constraint)

        # Get next WAITING patient (lowest token)
        cur.execute("""
            SELECT qe.id, qe.token_number, qe.patient_id, qe.appointment_id, qe.department_id,
                   p.first_name, p.last_name, p.whatsapp_number, p.phone,
                   d.display_name AS doctor_name, dept.department_name
            FROM queue_entries qe
            JOIN patients p ON p.id = qe.patient_id
            JOIN doctors d ON d.id = qe.doctor_id
            JOIN departments dept ON dept.id = qe.department_id
            WHERE qe.queue_session_id = %s
              AND qe.queue_status IN ('WAITING', 'NEXT')
            ORDER BY qe.token_number ASC
            LIMIT 1
            FOR UPDATE OF qe;
        """, (queue_session_id,))
        entry_row = cur.fetchone()

        if not entry_row:
            raise QueueError("No more waiting patients in this queue.", "NO_WAITING_PATIENTS")

        (entry_id, token_number, patient_id, appointment_id, dept_id,
         first_name, last_name, whatsapp_number, phone,
         doctor_name, department_name) = entry_row

        patient_name = f"{first_name or ''} {last_name or ''}".strip() or f"Patient #{patient_id}"
        wa_number = whatsapp_number or phone

        # Update to CALLED
        cur.execute("""
            UPDATE queue_entries
            SET queue_status = 'CALLED',
                called_at = NOW(),
                updated_at = NOW()
            WHERE id = %s;
        """, (entry_id,))

        # Audit
        _log_audit(cur, user_id=called_by_user_id, action='PATIENT_CALLED',
                   entity_type='queue_entries', entity_id=entry_id,
                   new_values={"token_number": token_number, "patient_id": patient_id})

        conn.commit()

        print(f"[QUEUE] Patient called: entry_id={entry_id} token=#{token_number} patient={patient_name}")

        return {
            "success": True,
            "entry_id": entry_id,
            "queue_session_id": queue_session_id,
            "token_number": token_number,
            "patient_id": patient_id,
            "appointment_id": appointment_id,
            "patient_name": patient_name,
            "whatsapp_number": wa_number,
            "doctor_name": doctor_name,
            "department_name": department_name,
            "room_number": room_number,
            "queue_status": "CALLED"
        }

    except (QueueError, QueueSessionNotFoundError):
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        raise QueueError(f"Error calling next patient: {str(e)}", "CALL_NEXT_FAILED")
    finally:
        cur.close()
        conn.close()


def start_consultation(queue_entry_id: int, started_by_user_id: Optional[int] = None) -> Dict[str, Any]:
    """Mark a WAITING, CALLED, or NEXT entry as IN_CONSULTATION."""
    return _update_entry_status(
        queue_entry_id=queue_entry_id,
        from_statuses=['WAITING', 'CALLED', 'NEXT'],
        to_status='IN_CONSULTATION',
        timestamp_col='consultation_started_at',
        audit_action='CONSULTATION_STARTED',
        user_id=started_by_user_id
    )


def complete_consultation(queue_entry_id: int, completed_by_user_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Mark IN_CONSULTATION entry as COMPLETED.
    Also triggers queue recalculation for remaining patients.
    Returns updated entries for AG-06 position change notifications.
    """
    result = _update_entry_status(
        queue_entry_id=queue_entry_id,
        from_statuses=['IN_CONSULTATION'],
        to_status='COMPLETED',
        timestamp_col='consultation_completed_at',
        audit_action='CONSULTATION_COMPLETED',
        user_id=completed_by_user_id
    )

    # Recalculate positions for remaining patients
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute("SELECT queue_session_id FROM queue_entries WHERE id = %s;", (queue_entry_id,))
        session_row = cur.fetchone()
        if session_row:
            session_id = session_row[0]
            updated_entries = recalculate_queue_positions(conn, session_id)
            conn.commit()
            result["recalculated_entries"] = updated_entries
    except Exception as e:
        conn.rollback()
        print(f"[QUEUE_WARN] Position recalculation failed after completion: {e}")
        result["recalculated_entries"] = []
    finally:
        cur.close()
        conn.close()

    return result


def cancel_queue_entry(queue_entry_id: int, reason: Optional[str] = None, cancelled_by_user_id: Optional[int] = None) -> Dict[str, Any]:
    """Cancel a WAITING or CALLED queue entry."""
    result = _update_entry_status(
        queue_entry_id=queue_entry_id,
        from_statuses=['WAITING', 'NEXT', 'CALLED'],
        to_status='CANCELLED',
        timestamp_col='cancelled_at',
        audit_action='QUEUE_ENTRY_CANCELLED',
        user_id=cancelled_by_user_id
    )

    # Recalculate remaining
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute("SELECT queue_session_id FROM queue_entries WHERE id = %s;", (queue_entry_id,))
        session_row = cur.fetchone()
        if session_row:
            updated_entries = recalculate_queue_positions(conn, session_row[0])
            conn.commit()
            result["recalculated_entries"] = updated_entries
    except Exception as e:
        conn.rollback()
        print(f"[QUEUE_WARN] Position recalculation failed after cancellation: {e}")
        result["recalculated_entries"] = []
    finally:
        cur.close()
        conn.close()

    return result


def mark_no_show(queue_entry_id: int, by_user_id: Optional[int] = None) -> Dict[str, Any]:
    """Mark a waiting patient as NO_SHOW."""
    result = _update_entry_status(
        queue_entry_id=queue_entry_id,
        from_statuses=['WAITING', 'NEXT', 'CALLED'],
        to_status='NO_SHOW',
        timestamp_col='cancelled_at',
        audit_action='QUEUE_NO_SHOW',
        user_id=by_user_id
    )

    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute("SELECT queue_session_id FROM queue_entries WHERE id = %s;", (queue_entry_id,))
        session_row = cur.fetchone()
        if session_row:
            updated_entries = recalculate_queue_positions(conn, session_row[0])
            conn.commit()
            result["recalculated_entries"] = updated_entries
    except Exception as e:
        conn.rollback()
        result["recalculated_entries"] = []
    finally:
        cur.close()
        conn.close()

    return result


def pause_queue(queue_session_id: int, reason: Optional[str] = None, paused_by_user_id: Optional[int] = None) -> Dict[str, Any]:
    """Pause an active queue session. AG-06 will notify affected patients."""
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE queue_sessions
            SET status = 'PAUSED',
                paused_at = NOW(),
                paused_reason = %s,
                updated_at = NOW()
            WHERE id = %s AND status = 'ACTIVE'
            RETURNING id, doctor_id, department_id;
        """, (reason, queue_session_id))
        row = cur.fetchone()
        if not row:
            raise QueueError(
                f"Cannot pause session {queue_session_id}: not in ACTIVE status.",
                "SESSION_NOT_ACTIVE"
            )

        # Get affected waiting patients for notification
        cur.execute("""
            SELECT qe.id, qe.patient_id, qe.token_number,
                   p.first_name, p.last_name, p.whatsapp_number, p.phone
            FROM queue_entries qe
            JOIN patients p ON p.id = qe.patient_id
            WHERE qe.queue_session_id = %s
              AND qe.queue_status IN ('WAITING', 'NEXT');
        """, (queue_session_id,))
        affected_patients = [
            {
                "entry_id": r[0], "patient_id": r[1], "token_number": r[2],
                "patient_name": f"{r[3] or ''} {r[4] or ''}".strip(),
                "whatsapp_number": r[5] or r[6]
            }
            for r in cur.fetchall()
        ]

        _log_audit(cur, user_id=paused_by_user_id, action='QUEUE_SESSION_PAUSED',
                   entity_type='queue_sessions', entity_id=queue_session_id,
                   new_values={"reason": reason})

        conn.commit()
        print(f"[QUEUE] Session {queue_session_id} PAUSED. Affected patients: {len(affected_patients)}")
        return {
            "success": True,
            "session_id": queue_session_id,
            "status": "PAUSED",
            "affected_patients": affected_patients
        }

    except QueueError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        raise QueueError(f"Failed to pause queue: {str(e)}", "PAUSE_FAILED")
    finally:
        cur.close()
        conn.close()


def resume_queue(queue_session_id: int, resumed_by_user_id: Optional[int] = None) -> Dict[str, Any]:
    """Resume a paused queue session. Recalculates positions and notifies patients."""
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE queue_sessions
            SET status = 'ACTIVE',
                paused_at = NULL,
                paused_reason = NULL,
                updated_at = NOW()
            WHERE id = %s AND status = 'PAUSED'
            RETURNING id;
        """, (queue_session_id,))
        row = cur.fetchone()
        if not row:
            raise QueueError(
                f"Cannot resume session {queue_session_id}: not in PAUSED status.",
                "SESSION_NOT_PAUSED"
            )

        # Recalculate after resume
        updated_entries = recalculate_queue_positions(conn, queue_session_id)

        _log_audit(cur, user_id=resumed_by_user_id, action='QUEUE_SESSION_RESUMED',
                   entity_type='queue_sessions', entity_id=queue_session_id, new_values={})

        conn.commit()
        print(f"[QUEUE] Session {queue_session_id} RESUMED. Updated {len(updated_entries)} entries.")
        return {
            "success": True,
            "session_id": queue_session_id,
            "status": "ACTIVE",
            "updated_entries": updated_entries
        }

    except QueueError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        raise QueueError(f"Failed to resume queue: {str(e)}", "RESUME_FAILED")
    finally:
        cur.close()
        conn.close()


def cancel_queue_session(queue_session_id: int, reason: Optional[str] = None, cancelled_by_user_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Cancel entire queue session.
    Marks all WAITING/NEXT/CALLED entries as CANCELLED.
    Returns affected patients for AG-06 QUEUE_CANCELLED notification.
    """
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE queue_sessions
            SET status = 'CANCELLED',
                closed_at = NOW(),
                updated_at = NOW()
            WHERE id = %s AND status IN ('OPEN', 'ACTIVE', 'PAUSED')
            RETURNING id;
        """, (queue_session_id,))
        row = cur.fetchone()
        if not row:
            raise QueueError(
                f"Cannot cancel session {queue_session_id}: already closed or cancelled.",
                "SESSION_NOT_CANCELLABLE"
            )

        # Get affected patients BEFORE cancelling entries
        cur.execute("""
            SELECT qe.id, qe.patient_id, qe.token_number,
                   p.first_name, p.last_name, p.whatsapp_number, p.phone
            FROM queue_entries qe
            JOIN patients p ON p.id = qe.patient_id
            WHERE qe.queue_session_id = %s
              AND qe.queue_status IN ('WAITING', 'NEXT', 'CALLED');
        """, (queue_session_id,))
        affected_patients = [
            {
                "entry_id": r[0], "patient_id": r[1], "token_number": r[2],
                "patient_name": f"{r[3] or ''} {r[4] or ''}".strip(),
                "whatsapp_number": r[5] or r[6]
            }
            for r in cur.fetchall()
        ]

        # Cancel all pending entries
        cur.execute("""
            UPDATE queue_entries
            SET queue_status = 'CANCELLED',
                cancelled_at = NOW(),
                updated_at = NOW()
            WHERE queue_session_id = %s
              AND queue_status IN ('WAITING', 'NEXT', 'CALLED');
        """, (queue_session_id,))

        _log_audit(cur, user_id=cancelled_by_user_id, action='QUEUE_SESSION_CANCELLED',
                   entity_type='queue_sessions', entity_id=queue_session_id,
                   new_values={"reason": reason, "affected_count": len(affected_patients)})

        conn.commit()
        print(f"[QUEUE] Session {queue_session_id} CANCELLED. Affected: {len(affected_patients)} patients.")
        return {
            "success": True,
            "session_id": queue_session_id,
            "status": "CANCELLED",
            "affected_patients": affected_patients
        }

    except QueueError:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        raise QueueError(f"Failed to cancel queue session: {str(e)}", "CANCEL_SESSION_FAILED")
    finally:
        cur.close()
        conn.close()


# ─── Queue State Queries ──────────────────────────────────────────────────────

def get_queue_session(queue_session_id: int) -> Dict[str, Any]:
    """Fetch full queue session state with all entries."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT qs.id, qs.doctor_id, qs.department_id, qs.queue_date,
                   qs.room_number, qs.status, qs.current_token_number,
                   qs.started_at, qs.closed_at, qs.paused_at, qs.paused_reason,
                   d.display_name AS doctor_name, dept.department_name
            FROM queue_sessions qs
            JOIN doctors d ON d.id = qs.doctor_id
            JOIN departments dept ON dept.id = qs.department_id
            WHERE qs.id = %s;
        """, (queue_session_id,))
        session_row = cur.fetchone()
        if not session_row:
            raise QueueSessionNotFoundError(
                f"Queue session {queue_session_id} not found.", "SESSION_NOT_FOUND"
            )

        session_id, doctor_id, dept_id, q_date, room, status, curr_token, \
            started_at, closed_at, paused_at, paused_reason, doctor_name, dept_name = session_row

        # Fetch all entries
        cur.execute("""
            SELECT qe.id, qe.token_number, qe.patient_id, qe.queue_status,
                   qe.position, qe.patients_ahead, qe.estimated_wait_minutes,
                   qe.checked_in_at, qe.called_at, qe.consultation_started_at,
                   qe.consultation_completed_at,
                   p.first_name, p.last_name, p.phone, p.whatsapp_number,
                   a.appointment_time, a.booking_id
            FROM queue_entries qe
            JOIN patients p ON p.id = qe.patient_id
            JOIN appointments a ON a.id = qe.appointment_id
            WHERE qe.queue_session_id = %s
            ORDER BY qe.token_number ASC;
        """, (queue_session_id,))
        entries = []
        for r in cur.fetchall():
            entries.append({
                "entry_id": r[0], "token_number": r[1], "patient_id": r[2],
                "queue_status": r[3], "position": r[4], "patients_ahead": r[5],
                "estimated_wait_minutes": r[6],
                "checked_in_at": r[7].isoformat() if r[7] else None,
                "called_at": r[8].isoformat() if r[8] else None,
                "consultation_started_at": r[9].isoformat() if r[9] else None,
                "consultation_completed_at": r[10].isoformat() if r[10] else None,
                "patient_name": f"{r[11] or ''} {r[12] or ''}".strip(),
                "phone": r[13],
                "whatsapp_number": r[14] or r[13],
                "appointment_time": str(r[15]) if r[15] else None,
                "booking_id": r[16]
            })

        # Derive statistics
        waiting_count = sum(1 for e in entries if e["queue_status"] in ("WAITING", "NEXT"))
        current_entry = next((e for e in entries if e["queue_status"] == "IN_CONSULTATION"), None)
        next_entry = next((e for e in entries if e["queue_status"] in ("CALLED", "NEXT")), None)

        return {
            "session_id": session_id,
            "doctor_id": doctor_id,
            "department_id": dept_id,
            "doctor_name": doctor_name,
            "department_name": dept_name,
            "queue_date": str(q_date),
            "room_number": room,
            "status": status,
            "current_token_number": curr_token,
            "started_at": started_at.isoformat() if started_at else None,
            "closed_at": closed_at.isoformat() if closed_at else None,
            "paused_at": paused_at.isoformat() if paused_at else None,
            "paused_reason": paused_reason,
            "waiting_count": waiting_count,
            "current_patient": current_entry,
            "next_patient": next_entry,
            "entries": entries
        }
    finally:
        cur.close()
        conn.close()


def get_doctor_queue_today(doctor_id: int) -> Dict[str, Any]:
    """Get today's queue session for a doctor. Used by Doctor Portal."""
    today = datetime.date.today()
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT d.id, d.display_name, d.department_id, dept.department_name
            FROM doctors d
            LEFT JOIN departments dept ON dept.id = d.department_id
            WHERE d.id = %s;
        """, (doctor_id,))
        doc_row = cur.fetchone()
        doc_info = {
            "doctor_id": doc_row[0] if doc_row else doctor_id,
            "doctor_name": doc_row[1] if doc_row else f"Doctor #{doctor_id}",
            "department_id": doc_row[2] if doc_row else None,
            "department_name": doc_row[3] if doc_row else "General Medicine"
        } if doc_row else {"doctor_id": doctor_id, "doctor_name": f"Doctor #{doctor_id}", "department_name": "General Medicine"}

        cur.execute("""
            SELECT id FROM queue_sessions
            WHERE doctor_id = %s AND queue_date = %s;
        """, (doctor_id, today))
        row = cur.fetchone()
        session_data = get_queue_session(row[0]) if row else None

        return {
            "success": True,
            "doctor_info": doc_info,
            "queue_date": str(today),
            "session": session_data,
            "message": "Queue data retrieved successfully."
        }
    finally:
        cur.close()
        conn.close()


def get_active_queues(queue_date: Optional[datetime.date] = None) -> List[Dict[str, Any]]:
    """
    Get all active queue sessions for a given date (Admin view).
    Returns summary per session.
    """
    target_date = queue_date or datetime.date.today()
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT qs.id, qs.doctor_id, qs.department_id, qs.queue_date,
                   qs.room_number, qs.status, qs.current_token_number,
                   d.display_name AS doctor_name, dept.department_name,
                   qs.started_at,
                   COUNT(qe_waiting.id) AS waiting_count,
                   COUNT(qe_consult.id) AS in_consultation_count
            FROM queue_sessions qs
            JOIN doctors d ON d.id = qs.doctor_id
            JOIN departments dept ON dept.id = qs.department_id
            LEFT JOIN queue_entries qe_waiting ON
                qe_waiting.queue_session_id = qs.id
                AND qe_waiting.queue_status IN ('WAITING', 'NEXT', 'CALLED')
            LEFT JOIN queue_entries qe_consult ON
                qe_consult.queue_session_id = qs.id
                AND qe_consult.queue_status = 'IN_CONSULTATION'
            WHERE qs.queue_date = %s
              AND qs.status NOT IN ('CANCELLED')
            GROUP BY qs.id, d.display_name, dept.department_name
            ORDER BY qs.id ASC;
        """, (target_date,))

        sessions = []
        for row in cur.fetchall():
            sessions.append({
                "session_id": row[0],
                "doctor_id": row[1],
                "department_id": row[2],
                "queue_date": str(row[3]),
                "room_number": row[4],
                "status": row[5],
                "current_token_number": row[6],
                "doctor_name": row[7],
                "department_name": row[8],
                "started_at": row[9].isoformat() if row[9] else None,
                "waiting_count": row[10],
                "in_consultation_count": row[11]
            })
        return sessions
    finally:
        cur.close()
        conn.close()


def get_queue_entry(queue_entry_id: int) -> Dict[str, Any]:
    """Fetch a single queue entry with full patient/doctor info."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT qe.id, qe.queue_session_id, qe.appointment_id, qe.patient_id,
                   qe.doctor_id, qe.department_id, qe.token_number, qe.queue_status,
                   qe.position, qe.patients_ahead, qe.estimated_wait_minutes,
                   qe.checked_in_at, qe.called_at,
                   qe.consultation_started_at, qe.consultation_completed_at,
                   p.first_name, p.last_name, p.whatsapp_number, p.phone,
                   d.display_name AS doctor_name, dept.department_name,
                   qs.room_number, qs.queue_date
            FROM queue_entries qe
            JOIN patients p ON p.id = qe.patient_id
            JOIN doctors d ON d.id = qe.doctor_id
            JOIN departments dept ON dept.id = qe.department_id
            JOIN queue_sessions qs ON qs.id = qe.queue_session_id
            WHERE qe.id = %s;
        """, (queue_entry_id,))
        row = cur.fetchone()
        if not row:
            raise QueueEntryNotFoundError(
                f"Queue entry {queue_entry_id} not found.", "ENTRY_NOT_FOUND"
            )
        return {
            "entry_id": row[0], "queue_session_id": row[1], "appointment_id": row[2],
            "patient_id": row[3], "doctor_id": row[4], "department_id": row[5],
            "token_number": row[6], "queue_status": row[7],
            "position": row[8], "patients_ahead": row[9], "estimated_wait_minutes": row[10],
            "checked_in_at": row[11].isoformat() if row[11] else None,
            "called_at": row[12].isoformat() if row[12] else None,
            "consultation_started_at": row[13].isoformat() if row[13] else None,
            "consultation_completed_at": row[14].isoformat() if row[14] else None,
            "patient_name": f"{row[15] or ''} {row[16] or ''}".strip(),
            "whatsapp_number": row[17] or row[18],
            "doctor_name": row[19], "department_name": row[20],
            "room_number": row[21],
            "queue_date": str(row[22]) if row[22] else None
        }
    finally:
        cur.close()
        conn.close()


def get_patient_queue_status(patient_id: int) -> Dict[str, Any]:
    """
    Get active queue entry and status for a patient today.
    Returns token_number, position, patients_ahead, estimated_wait_minutes, room_number.
    """
    today = datetime.date.today()
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT qe.id, qe.queue_session_id, qe.appointment_id, qe.doctor_id,
                   qe.department_id, qe.token_number, qe.queue_status,
                   qe.position, qe.patients_ahead, qe.estimated_wait_minutes,
                   qs.room_number, d.display_name AS doctor_name, dept.department_name
            FROM queue_entries qe
            JOIN queue_sessions qs ON qs.id = qe.queue_session_id
            JOIN doctors d ON d.id = qe.doctor_id
            JOIN departments dept ON dept.id = qe.department_id
            WHERE qe.patient_id = %s
              AND qs.queue_date = %s
              AND qe.queue_status IN ('WAITING', 'NEXT', 'CALLED', 'IN_CONSULTATION')
            ORDER BY qe.created_at DESC
            LIMIT 1;
        """, (patient_id, today))
        row = cur.fetchone()
        if not row:
            return {"success": False, "message": "No active queue entry for patient today."}
        return {
            "success": True,
            "entry_id": row[0],
            "queue_session_id": row[1],
            "appointment_id": row[2],
            "doctor_id": row[3],
            "department_id": row[4],
            "token_number": row[5],
            "queue_status": row[6],
            "position": row[7],
            "patients_ahead": row[8],
            "estimated_wait_minutes": row[9],
            "room_number": row[10],
            "doctor_name": row[11],
            "department_name": row[12]
        }
    finally:
        cur.close()
        conn.close()


def get_active_session_for_doctor(doctor_id: int, queue_date: Optional[datetime.date] = None) -> Optional[Dict[str, Any]]:
    """Get active/open queue session for a doctor on a specific date."""
    target_date = queue_date or datetime.date.today()
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT id, doctor_id, department_id, queue_date, room_number, status, current_token_number
            FROM queue_sessions
            WHERE doctor_id = %s AND queue_date = %s AND status IN ('OPEN', 'ACTIVE', 'PAUSED');
        """, (doctor_id, target_date))
        row = cur.fetchone()
        if not row:
            return None
        return {
            "id": row[0], "doctor_id": row[1], "department_id": row[2],
            "queue_date": row[3], "room_number": row[4], "status": row[5],
            "current_token_number": row[6]
        }
    finally:
        cur.close()
        conn.close()


def get_patient_language(patient_id: int) -> str:
    """
    Retrieve patient's preferred language from their active conversation.
    Falls back to ENGLISH if not found.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT language FROM conversations
            WHERE patient_id = %s
              AND conversation_status = 'ACTIVE'
            ORDER BY last_message_at DESC
            LIMIT 1;
        """, (patient_id,))
        row = cur.fetchone()
        if row and row[0]:
            return row[0].upper()
        # Check any recent conversation
        cur.execute("""
            SELECT language FROM conversations
            WHERE patient_id = %s
            ORDER BY last_message_at DESC
            LIMIT 1;
        """, (patient_id,))
        row = cur.fetchone()
        return (row[0].upper() if row and row[0] else "ENGLISH")
    finally:
        cur.close()
        conn.close()


# ─── Doctor Delay Detection ───────────────────────────────────────────────────

def detect_doctor_delay(queue_session_id: int, delay_threshold_minutes: int = 15) -> Optional[Dict[str, Any]]:
    """
    Detect if the current consultation is running significantly over time.
    Returns delay info if delay exceeds threshold, None otherwise.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT qe.id, qe.patient_id, qe.consultation_started_at,
                   qs.doctor_id, qs.department_id
            FROM queue_entries qe
            JOIN queue_sessions qs ON qs.id = qe.queue_session_id
            WHERE qe.queue_session_id = %s
              AND qe.queue_status = 'IN_CONSULTATION'
            LIMIT 1;
        """, (queue_session_id,))
        row = cur.fetchone()
        if not row:
            return None

        entry_id, patient_id, consult_started, doctor_id, dept_id = row
        if not consult_started:
            return None

        slot_duration = get_slot_duration_minutes(conn, doctor_id, datetime.date.today())
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        if consult_started and consult_started.tzinfo is None:
            now_dt = datetime.datetime.now()
        elapsed_minutes = (now_dt - consult_started).total_seconds() / 60
        overrun_minutes = elapsed_minutes - slot_duration

        if overrun_minutes >= delay_threshold_minutes:
            return {
                "delay_detected": True,
                "entry_id": entry_id,
                "overrun_minutes": round(overrun_minutes),
                "elapsed_minutes": round(elapsed_minutes),
                "slot_duration": slot_duration
            }
        return None
    finally:
        cur.close()
        conn.close()


# ─── Internal Helpers ─────────────────────────────────────────────────────────

def _update_entry_status(
    queue_entry_id: int,
    from_statuses: List[str],
    to_status: str,
    timestamp_col: str,
    audit_action: str,
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """Generic queue entry status transition."""
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        placeholders = ','.join(['%s'] * len(from_statuses))
        cur.execute(f"""
            UPDATE queue_entries
            SET queue_status = %s,
                {timestamp_col} = NOW(),
                updated_at = NOW()
            WHERE id = %s AND queue_status IN ({placeholders})
            RETURNING id, queue_session_id, patient_id, token_number;
        """, [to_status, queue_entry_id] + list(from_statuses))
        row = cur.fetchone()
        if not row:
            raise InvalidQueueStatusTransitionError(
                f"Cannot transition queue entry {queue_entry_id} to {to_status}: "
                f"entry not found or not in {from_statuses}.",
                "INVALID_STATUS_TRANSITION"
            )
        entry_id, session_id, patient_id, token_number = row

        _log_audit(cur, user_id=user_id, action=audit_action,
                   entity_type='queue_entries', entity_id=entry_id,
                   new_values={"to_status": to_status, "token_number": token_number})

        conn.commit()
        print(f"[QUEUE] Entry {entry_id} status: {from_statuses} -> {to_status}")
        return {
            "success": True,
            "entry_id": entry_id,
            "queue_session_id": session_id,
            "patient_id": patient_id,
            "token_number": token_number,
            "queue_status": to_status
        }
    except (QueueError, InvalidQueueStatusTransitionError):
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        raise QueueError(f"Status transition failed: {str(e)}", "STATUS_TRANSITION_FAILED")
    finally:
        cur.close()
        conn.close()


def _log_audit(cur, user_id, action: str, entity_type: str, entity_id: int,
               new_values: Optional[dict] = None, old_values: Optional[dict] = None):
    """Write queue event to audit_logs. Non-fatal — errors are logged but not raised."""
    import json as _json
    try:
        cur.execute("""
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, old_values, created_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, NOW())
            ON CONFLICT DO NOTHING;
        """, (
            user_id, action, entity_type, entity_id,
            _json.dumps(new_values) if new_values else None,
            _json.dumps(old_values) if old_values else None
        ))
    except Exception as audit_err:
        # Audit errors must never break queue operations
        print(f"[QUEUE_AUDIT_WARN] Failed to write audit log for {action}: {audit_err}")
