"""
queue.py
========
AG-06 Queue / Flow Agent — FastAPI REST API Router.

Provides:
- Patient check-in endpoint (triggers TOKEN_ASSIGNED notification)
- Queue session management (create, get, pause, resume, cancel)
- Queue entry state transitions (call, start, complete, no-show)
- Admin view: all active queues for today
- Doctor view: today's queue for the logged-in doctor
- Query endpoints for frontend queue management UIs

Auth:
- Admin endpoints require: get_current_user (ADMIN or DOCTOR roles)
- Doctor endpoints require: get_current_user (scoped by doctor_id from JWT)
- Check-in is admin/front-desk operation: require_doctor_or_admin

Integration:
- ALL business logic is in services/queue_service.py
- ALL notifications are in services/queue_notification_service.py
- Auth uses existing api/auth_helper.py
- DB uses existing db_config.get_db_connection()

Step: AG-06 Phase 13 (REST API Router)
"""

import datetime
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from pydantic import BaseModel, validator

import db_config
from api.auth_helper import get_current_user, require_doctor_or_admin, require_admin
from services import queue_service, queue_notification_service

router = APIRouter(prefix="/api/queue", tags=["AG-06 Queue Agent"])


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class CheckInRequest(BaseModel):
    appointment_id: int
    doctor_id: Optional[int] = None
    room_number: Optional[str] = None


class CreateSessionRequest(BaseModel):
    doctor_id: int
    department_id: int
    queue_date: Optional[str] = None  # YYYY-MM-DD, defaults to today
    room_number: Optional[str] = None


class UpdateRoomRequest(BaseModel):
    room_number: str


class PauseRequest(BaseModel):
    reason: Optional[str] = None


class CancelSessionRequest(BaseModel):
    reason: Optional[str] = None


class CancelEntryRequest(BaseModel):
    reason: Optional[str] = None


# ─── Authorization Helpers ───────────────────────────────────────────────────

def resolve_doctor_id(user: dict) -> Optional[int]:
    """Resolves authenticated doctor_id from user context or DB lookup."""
    user_doctor_id = user.get("doctor_id")
    if user_doctor_id:
        return int(user_doctor_id)
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        user_id = user.get("user_id")
        if user_id:
            cur.execute("SELECT id FROM doctors WHERE user_id = %s LIMIT 1;", (user_id,))
            row = cur.fetchone()
            if row:
                return row[0]
        email = user.get("email")
        if email:
            cur.execute("SELECT id FROM doctors WHERE email = %s LIMIT 1;", (email,))
            row = cur.fetchone()
            if row:
                return row[0]
        return None
    finally:
        cur.close()
        conn.close()

def verify_session_doctor_access(user: dict, session_id: int):
    """Enforce doctor isolation: Doctor role can only manage their own queue session."""
    user_role = (user.get("role") or "").upper()
    if user_role == "DOCTOR":
        user_doctor_id = resolve_doctor_id(user)
        if not user_doctor_id:
            raise HTTPException(status_code=403, detail={"error": "UNAUTHORIZED_DOCTOR_ACCESS", "message": "Doctor ID missing from credentials."})
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT doctor_id FROM queue_sessions WHERE id = %s;", (session_id,))
            row = cur.fetchone()
            if row and int(row[0]) != int(user_doctor_id):
                raise HTTPException(status_code=403, detail={"error": "UNAUTHORIZED_DOCTOR_ACCESS", "message": "You are not authorized to access another doctor's queue session."})
        finally:
            cur.close()
            conn.close()

def verify_entry_doctor_access(user: dict, entry_id: int):
    """Enforce doctor isolation: Doctor role can only manage their own queue entries."""
    user_role = (user.get("role") or "").upper()
    if user_role == "DOCTOR":
        user_doctor_id = resolve_doctor_id(user)
        if not user_doctor_id:
            raise HTTPException(status_code=403, detail={"error": "UNAUTHORIZED_DOCTOR_ACCESS", "message": "Doctor ID missing from credentials."})
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT doctor_id FROM queue_entries WHERE id = %s;", (entry_id,))
            row = cur.fetchone()
            if row and int(row[0]) != int(user_doctor_id):
                raise HTTPException(status_code=403, detail={"error": "UNAUTHORIZED_DOCTOR_ACCESS", "message": "You are not authorized to access another doctor's queue entry."})
        finally:
            cur.close()
            conn.close()

def verify_patient_access(user: dict, patient_id: int):
    """Enforce patient isolation: Patient role can only access their own queue details."""
    user_role = (user.get("role") or "").upper()
    if user_role == "PATIENT":
        user_patient_id = user.get("patient_id")
        if user_patient_id and int(user_patient_id) != int(patient_id):
            raise HTTPException(status_code=403, detail={"error": "UNAUTHORIZED_PATIENT_ACCESS", "message": "You are not authorized to access another patient's queue data."})


# ─── Patient Check-In ─────────────────────────────────────────────────────────

@router.post(
    "/check-in",
    summary="Patient Check-In — Assign token and send WhatsApp notification",
    description=(
        "Check in a patient for their appointment. Assigns a queue token, "
        "calculates position and ETA, and sends a WhatsApp notification via AG-06. "
        "Requires BOOKED or CONFIRMED appointment status for today."
    )
)
def check_in_patient(
    payload: CheckInRequest,
    user: dict = Depends(get_current_user)
):
    """AG-06 Entry Point — Token Assignment + Notification."""
    try:
        expected_doc_id = payload.doctor_id
        user_role = (user.get("role") or "").upper()
        if user_role == "DOCTOR":
            user_doc_id = resolve_doctor_id(user)
            if user_doc_id:
                expected_doc_id = user_doc_id

        # 1. Execute check-in (assigns token, calculates position/ETA)
        result = queue_service.patient_check_in(
            appointment_id=payload.appointment_id,
            room_number=payload.room_number,
            created_by_user_id=user.get("user_id"),
            expected_doctor_id=expected_doc_id
        )

        # 2. Dispatch WhatsApp TOKEN_ASSIGNED notification (non-blocking)
        # WhatsApp failure must NOT fail the API response
        notification_result = {"success": True, "skipped": True}
        try:
            notification_result = queue_notification_service.process_token_assigned(result)
        except Exception as notif_err:
            print(f"[QUEUE_API] Token assigned notification failed (non-fatal): {notif_err}")

        return {
            "success": True,
            "message": result.get("message") or f"Patient checked in. Token #{result['token_number']} assigned.",
            "data": result,
            "notification": {
                "sent": notification_result.get("success", False),
                "notification_id": notification_result.get("notification_id"),
                "skipped_duplicate": notification_result.get("skipped_duplicate", False)
            }
        }

    except queue_service.DuplicateCheckInError as e:
        raise HTTPException(status_code=409, detail={"error": e.error_code, "message": e.message})
    except queue_service.AppointmentNotEligibleError as e:
        raise HTTPException(status_code=422, detail={"error": e.error_code, "message": e.message})
    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail={"error": "CHECK_IN_FAILED", "message": str(e)})


# ─── Queue Session Management ─────────────────────────────────────────────────

@router.post(
    "/sessions",
    summary="Create a queue session for a doctor on a given date"
)
def create_queue_session(
    payload: CreateSessionRequest,
    user: dict = Depends(get_current_user)
):
    """Create a new queue session (Admin / Front Desk)."""
    try:
        queue_date_parsed = (
            datetime.date.fromisoformat(payload.queue_date)
            if payload.queue_date
            else datetime.date.today()
        )
        conn = db_config.get_db_connection()
        conn.autocommit = False
        try:
            session = queue_service.get_or_create_queue_session(
                conn=conn,
                doctor_id=payload.doctor_id,
                department_id=payload.department_id,
                queue_date=queue_date_parsed,
                room_number=payload.room_number,
                created_by_user_id=user.get("user_id")
            )
            conn.commit()
        finally:
            conn.close()

        return {"success": True, "data": session}

    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/sessions",
    summary="Get all active queue sessions for today (Admin view)"
)
def get_active_queues(
    queue_date: Optional[str] = Query(None, description="Date YYYY-MM-DD, defaults to today"),
    user: dict = Depends(get_current_user)
):
    """Admin: get all queue sessions for a given date."""
    try:
        date_obj = (
            datetime.date.fromisoformat(queue_date)
            if queue_date
            else datetime.date.today()
        )
        sessions = queue_service.get_active_queues(date_obj)
        return {
            "success": True,
            "queue_date": str(date_obj),
            "total": len(sessions),
            "data": sessions
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/sessions/{session_id}",
    summary="Get full queue session state with all entries"
)
def get_queue_session(
    session_id: int,
    user: dict = Depends(get_current_user)
):
    """Get a single queue session with all entries and patient details."""
    try:
        session = queue_service.get_queue_session(session_id)
        return {"success": True, "data": session}
    except queue_service.QueueSessionNotFoundError as e:
        raise HTTPException(status_code=404, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch(
    "/sessions/{session_id}/room",
    summary="Update room number for an existing session"
)
def update_session_room(
    session_id: int,
    payload: UpdateRoomRequest,
    user: dict = Depends(get_current_user)
):
    """Update the room number of a queue session."""
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE queue_sessions
            SET room_number = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id;
        """, (payload.room_number, session_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Queue session not found.")
        conn.commit()
        return {"success": True, "session_id": session_id, "room_number": payload.room_number}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post(
    "/sessions/{session_id}/pause",
    summary="Pause a queue session — notifies waiting patients via WhatsApp"
)
def pause_queue(
    session_id: int,
    payload: PauseRequest = Body(default=PauseRequest()),
    user: dict = Depends(get_current_user)
):
    """Pause queue session. AG-06 sends QUEUE_PAUSED notification to all waiting patients."""
    try:
        result = queue_service.pause_queue(
            queue_session_id=session_id,
            reason=payload.reason,
            paused_by_user_id=user.get("user_id")
        )

        # Notify all affected patients
        session_data = {"doctor_name": "", "room_number": ""}
        notif_results = []
        try:
            # Fetch session context for notifications
            conn = db_config.get_db_connection()
            cur = conn.cursor()
            try:
                cur.execute("""
                    SELECT d.display_name, qs.room_number
                    FROM queue_sessions qs JOIN doctors d ON d.id = qs.doctor_id
                    WHERE qs.id = %s;
                """, (session_id,))
                row = cur.fetchone()
                if row:
                    session_data = {"doctor_name": row[0] or "", "room_number": row[1] or ""}
            finally:
                cur.close()
                conn.close()

            notif_results = queue_notification_service.process_queue_paused(
                session_id=session_id,
                affected_patients=result.get("affected_patients", []),
                session_data=session_data
            )
        except Exception as notif_err:
            print(f"[QUEUE_API] Pause notification failed (non-fatal): {notif_err}")

        return {
            "success": True,
            "message": "Queue paused successfully.",
            "data": result,
            "notifications_sent": len([r for r in notif_results if r.get("success")])
        }

    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/sessions/{session_id}/resume",
    summary="Resume a paused queue session — recalculates positions and notifies patients"
)
def resume_queue(
    session_id: int,
    user: dict = Depends(get_current_user)
):
    """Resume queue. AG-06 sends QUEUE_RESUMED with updated positions to all waiting patients."""
    try:
        result = queue_service.resume_queue(
            queue_session_id=session_id,
            resumed_by_user_id=user.get("user_id")
        )

        session_data = {"doctor_name": "", "room_number": ""}
        notif_results = []
        try:
            conn = db_config.get_db_connection()
            cur = conn.cursor()
            try:
                cur.execute("""
                    SELECT d.display_name, qs.room_number
                    FROM queue_sessions qs JOIN doctors d ON d.id = qs.doctor_id
                    WHERE qs.id = %s;
                """, (session_id,))
                row = cur.fetchone()
                if row:
                    session_data = {"doctor_name": row[0] or "", "room_number": row[1] or ""}
            finally:
                cur.close()
                conn.close()

            notif_results = queue_notification_service.process_queue_resumed(
                session_id=session_id,
                updated_entries=result.get("updated_entries", []),
                session_data=session_data
            )
        except Exception as notif_err:
            print(f"[QUEUE_API] Resume notification failed (non-fatal): {notif_err}")

        return {
            "success": True,
            "message": "Queue resumed. Positions recalculated.",
            "data": result,
            "notifications_sent": len([r for r in notif_results if r.get("success")])
        }

    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/sessions/{session_id}/cancel",
    summary="Cancel entire queue session — notifies all waiting patients via WhatsApp"
)
def cancel_queue_session(
    session_id: int,
    payload: CancelSessionRequest = Body(default=CancelSessionRequest()),
    user: dict = Depends(get_current_user)
):
    """Cancel session. AG-06 sends QUEUE_CANCELLED to all still-waiting patients."""
    try:
        result = queue_service.cancel_queue_session(
            queue_session_id=session_id,
            reason=payload.reason,
            cancelled_by_user_id=user.get("user_id")
        )

        session_data = {"doctor_name": "", "room_number": ""}
        notif_results = []
        try:
            conn = db_config.get_db_connection()
            cur = conn.cursor()
            try:
                cur.execute("""
                    SELECT d.display_name, qs.room_number
                    FROM queue_sessions qs JOIN doctors d ON d.id = qs.doctor_id
                    WHERE qs.id = %s;
                """, (session_id,))
                row = cur.fetchone()
                if row:
                    session_data = {"doctor_name": row[0] or "", "room_number": row[1] or ""}
            finally:
                cur.close()
                conn.close()

            notif_results = queue_notification_service.process_queue_cancelled(
                session_id=session_id,
                affected_patients=result.get("affected_patients", []),
                session_data=session_data
            )
        except Exception as notif_err:
            print(f"[QUEUE_API] Cancel notification failed (non-fatal): {notif_err}")

        return {
            "success": True,
            "message": "Queue session cancelled. Patients notified.",
            "data": result,
            "notifications_sent": len([r for r in notif_results if r.get("success")])
        }

    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Queue Entry Transitions ──────────────────────────────────────────────────

@router.post(
    "/sessions/{session_id}/call-next",
    summary="Call next waiting patient — sends PROCEED_TO_ROOM notification"
)
def call_next_patient(
    session_id: int,
    user: dict = Depends(get_current_user)
):
    """Call the next patient. AG-06 sends PROCEED_TO_ROOM via WhatsApp."""
    try:
        result = queue_service.call_next_patient(
            queue_session_id=session_id,
            called_by_user_id=user.get("user_id")
        )

        # Dispatch notification (non-fatal)
        notification_result = {"success": False}
        try:
            notification_result = queue_notification_service.process_proceed_to_room(
                entry_id=result["entry_id"],
                entry_data=result
            )
        except Exception as notif_err:
            print(f"[QUEUE_API] Proceed notification failed (non-fatal): {notif_err}")

        return {
            "success": True,
            "message": f"Token #{result['token_number']} called — {result['patient_name']}",
            "data": result,
            "notification": {
                "sent": notification_result.get("success", False),
                "notification_id": notification_result.get("notification_id")
            }
        }

    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except queue_service.QueueSessionNotFoundError as e:
        raise HTTPException(status_code=404, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/entries/{entry_id}/start",
    summary="Mark patient consultation as started"
)
def start_consultation(
    entry_id: int,
    user: dict = Depends(get_current_user)
):
    """Mark patient as IN_CONSULTATION. AG-06 sends CONSULTATION_STARTED."""
    try:
        result = queue_service.start_consultation(
            queue_entry_id=entry_id,
            started_by_user_id=user.get("user_id")
        )

        # Send CONSULTATION_STARTED notification (non-fatal)
        try:
            entry_data = queue_service.get_queue_entry(entry_id)
            queue_notification_service.process_consultation_started(entry_id, entry_data)
        except Exception as notif_err:
            print(f"[QUEUE_API] Consultation started notification failed (non-fatal): {notif_err}")

        return {"success": True, "message": "Consultation started.", "data": result}

    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/entries/{entry_id}/complete",
    summary="Mark consultation completed — recalculates queue positions and notifies next patients"
)
def complete_consultation(
    entry_id: int,
    user: dict = Depends(get_current_user)
):
    """
    Mark patient's consultation as completed.
    Triggers queue position recalculation + YOU_ARE_NEXT / POSITION_UPDATED notifications.
    """
    try:
        result = queue_service.complete_consultation(
            queue_entry_id=entry_id,
            completed_by_user_id=user.get("user_id")
        )

        # Send position updates to remaining patients (non-fatal)
        notifications_sent = 0
        try:
            session_id = result.get("queue_session_id")
            if session_id:
                # Fetch session context for notifications
                conn = db_config.get_db_connection()
                cur = conn.cursor()
                session_data = {}
                try:
                    cur.execute("""
                        SELECT d.display_name, qs.room_number
                        FROM queue_sessions qs JOIN doctors d ON d.id = qs.doctor_id
                        WHERE qs.id = %s;
                    """, (session_id,))
                    row = cur.fetchone()
                    if row:
                        session_data = {"doctor_name": row[0] or "", "room_number": row[1] or ""}
                finally:
                    cur.close()
                    conn.close()

                for updated_entry in result.get("recalculated_entries", []):
                    if not updated_entry.get("position_changed"):
                        continue
                    e_id = updated_entry["entry_id"]
                    e_data = {**updated_entry, **session_data}

                    if updated_entry.get("patients_ahead") == 0:
                        # This patient is now next
                        notif = queue_notification_service.process_you_are_next(e_id, e_data)
                    else:
                        notif = queue_notification_service.process_position_update(e_id, e_data)

                    if notif.get("success") and not notif.get("skipped_duplicate"):
                        notifications_sent += 1
        except Exception as notif_err:
            print(f"[QUEUE_API] Post-completion notifications failed (non-fatal): {notif_err}")

        return {
            "success": True,
            "message": "Consultation completed. Queue positions updated.",
            "data": result,
            "notifications_sent": notifications_sent
        }

    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/entries/{entry_id}/no-show",
    summary="Mark patient as no-show — removes from queue and recalculates positions"
)
def mark_no_show(
    entry_id: int,
    user: dict = Depends(get_current_user)
):
    """Mark a patient as no-show. Queue positions recalculated and patients notified."""
    verify_entry_doctor_access(user, entry_id)
    try:
        result = queue_service.mark_no_show(
            queue_entry_id=entry_id,
            by_user_id=user.get("user_id")
        )

        notifications_sent = 0
        try:
            session_id = result.get("queue_session_id")
            if session_id:
                conn = db_config.get_db_connection()
                cur = conn.cursor()
                session_data = {}
                try:
                    cur.execute("""
                        SELECT d.display_name, qs.room_number
                        FROM queue_sessions qs JOIN doctors d ON d.id = qs.doctor_id
                        WHERE qs.id = %s;
                    """, (session_id,))
                    row = cur.fetchone()
                    if row:
                        session_data = {"doctor_name": row[0] or "", "room_number": row[1] or ""}
                finally:
                    cur.close()
                    conn.close()

                for updated_entry in result.get("recalculated_entries", []):
                    if not updated_entry.get("position_changed"):
                        continue
                    e_id = updated_entry["entry_id"]
                    e_data = {**updated_entry, **session_data}

                    if updated_entry.get("patients_ahead") == 0:
                        notif = queue_notification_service.process_you_are_next(e_id, e_data)
                    else:
                        notif = queue_notification_service.process_position_update(e_id, e_data)

                    if notif.get("success") and not notif.get("skipped_duplicate"):
                        notifications_sent += 1
        except Exception as notif_err:
            print(f"[QUEUE_API] Post-no-show notifications failed (non-fatal): {notif_err}")

        return {
            "success": True,
            "message": "Patient marked as no-show. Queue recalculated.",
            "data": result,
            "notifications_sent": notifications_sent
        }
    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/entries/{entry_id}/cancel",
    summary="Cancel a queue entry — removes patient from queue"
)
def cancel_entry(
    entry_id: int,
    payload: CancelEntryRequest = Body(default=CancelEntryRequest()),
    user: dict = Depends(get_current_user)
):
    """Cancel a queue entry. Queue positions recalculated."""
    verify_entry_doctor_access(user, entry_id)
    try:
        result = queue_service.cancel_queue_entry(
            queue_entry_id=entry_id,
            reason=payload.reason,
            cancelled_by_user_id=user.get("user_id")
        )

        notifications_sent = 0
        try:
            session_id = result.get("queue_session_id")
            if session_id:
                conn = db_config.get_db_connection()
                cur = conn.cursor()
                session_data = {}
                try:
                    cur.execute("""
                        SELECT d.display_name, qs.room_number
                        FROM queue_sessions qs JOIN doctors d ON d.id = qs.doctor_id
                        WHERE qs.id = %s;
                    """, (session_id,))
                    row = cur.fetchone()
                    if row:
                        session_data = {"doctor_name": row[0] or "", "room_number": row[1] or ""}
                finally:
                    cur.close()
                    conn.close()

                for updated_entry in result.get("recalculated_entries", []):
                    if not updated_entry.get("position_changed"):
                        continue
                    e_id = updated_entry["entry_id"]
                    e_data = {**updated_entry, **session_data}

                    if updated_entry.get("patients_ahead") == 0:
                        notif = queue_notification_service.process_you_are_next(e_id, e_data)
                    else:
                        notif = queue_notification_service.process_position_update(e_id, e_data)

                    if notif.get("success") and not notif.get("skipped_duplicate"):
                        notifications_sent += 1
        except Exception as notif_err:
            print(f"[QUEUE_API] Post-cancellation notifications failed (non-fatal): {notif_err}")

        return {
            "success": True,
            "message": "Queue entry cancelled. Queue recalculated.",
            "data": result,
            "notifications_sent": notifications_sent
        }
    except queue_service.QueueError as e:
        raise HTTPException(status_code=400, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/entries/{entry_id}",
    summary="Get a single queue entry with full patient and session details"
)
def get_queue_entry(
    entry_id: int,
    user: dict = Depends(get_current_user)
):
    try:
        entry = queue_service.get_queue_entry(entry_id)
        return {"success": True, "data": entry}
    except queue_service.QueueEntryNotFoundError as e:
        raise HTTPException(status_code=404, detail={"error": e.error_code, "message": e.message})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Doctor Portal Endpoints ──────────────────────────────────────────────────

@router.get(
    "/doctor/today",
    summary="Doctor: Get today's queue for the logged-in doctor or specified doctor_id"
)
def get_my_queue_today(
    doctor_id: Optional[int] = Query(None, description="Optional doctor ID override for Admin or Doctor selection"),
    user: dict = Depends(get_current_user)
):
    """
    Doctor Portal: returns today's queue session.
    If doctor_id query param is provided (or if user is Admin), uses that doctor_id.
    Otherwise resolves doctor_id from user JWT / DB context.
    """
    target_doctor_id = doctor_id
    if not target_doctor_id:
        target_doctor_id = resolve_doctor_id(user)

    # Fallback for Admin or unassigned users: pick doctor with appointments today or first active doctor
    if not target_doctor_id:
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("""
                SELECT doctor_id FROM appointments 
                WHERE appointment_date = CURRENT_DATE 
                LIMIT 1;
            """)
            row = cur.fetchone()
            if row:
                target_doctor_id = row[0]
            else:
                cur.execute("SELECT id FROM doctors LIMIT 1;")
                row = cur.fetchone()
                if row:
                    target_doctor_id = row[0]
        finally:
            cur.close()
            conn.close()

    if not target_doctor_id:
        raise HTTPException(status_code=400, detail={"error": "DOCTOR_ID_NOT_RESOLVED", "message": "No doctor ID available."})

    try:
        result = queue_service.get_doctor_queue_today(int(target_doctor_id))
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Admin Notification Insights ─────────────────────────────────────────────

@router.get(
    "/notifications",
    summary="Admin: Get recent queue notifications with delivery status"
)
def get_queue_notifications(
    queue_date: Optional[str] = Query(None, description="Date YYYY-MM-DD, defaults to today"),
    session_id: Optional[int] = Query(None, description="Filter by queue session"),
    notification_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(get_current_user)
):
    """Admin view of queue notification delivery status."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        date_filter = (
            datetime.date.fromisoformat(queue_date)
            if queue_date
            else datetime.date.today()
        )
        date_start = datetime.datetime.combine(date_filter, datetime.time.min)
        date_end = datetime.datetime.combine(date_filter, datetime.time.max)

        where_clauses = ["qn.created_at BETWEEN %s AND %s"]
        params = [date_start, date_end]

        if session_id:
            where_clauses.append("qe.queue_session_id = %s")
            params.append(session_id)
        if notification_type:
            where_clauses.append("qn.notification_type = %s")
            params.append(notification_type.upper())

        params.append(limit)
        where_sql = " AND ".join(where_clauses)

        cur.execute(f"""
            SELECT qn.id, qn.queue_entry_id, qn.patient_id, qn.notification_type,
                   qn.language, qn.whatsapp_number, qn.status, qn.attempt_count,
                   qn.sent_at, qn.delivered_at, qn.read_at, qn.failed_at,
                   qn.last_error, qn.created_at,
                   p.first_name, p.last_name,
                   qe.token_number, qe.queue_session_id
            FROM queue_notifications qn
            JOIN patients p ON p.id = qn.patient_id
            JOIN queue_entries qe ON qe.id = qn.queue_entry_id
            WHERE {where_sql}
            ORDER BY qn.created_at DESC
            LIMIT %s;
        """, params)

        rows = cur.fetchall()
        data = []
        for r in rows:
            data.append({
                "notification_id": r[0],
                "queue_entry_id": r[1],
                "patient_id": r[2],
                "notification_type": r[3],
                "language": r[4],
                "whatsapp_number": r[5],
                "status": r[6],
                "attempt_count": r[7],
                "sent_at": r[8].isoformat() if r[8] else None,
                "delivered_at": r[9].isoformat() if r[9] else None,
                "read_at": r[10].isoformat() if r[10] else None,
                "failed_at": r[11].isoformat() if r[11] else None,
                "last_error": r[12],
                "created_at": r[13].isoformat() if r[13] else None,
                "patient_name": f"{r[14] or ''} {r[15] or ''}".strip(),
                "token_number": r[16],
                "queue_session_id": r[17]
            })

        return {
            "success": True,
            "queue_date": str(date_filter),
            "total": len(data),
            "data": data
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


# ─── Queue Statistics Summary ─────────────────────────────────────────────────

@router.get(
    "/stats/today",
    summary="Admin: Queue statistics summary for today"
)
def get_queue_stats_today(user: dict = Depends(get_current_user)):
    """Summary stats: total sessions, patients waiting, completed, notifications sent."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        today = datetime.date.today()
        cur.execute("""
            SELECT
                COUNT(DISTINCT qs.id) AS total_sessions,
                COUNT(DISTINCT CASE WHEN qs.status = 'ACTIVE' THEN qs.id END) AS active_sessions,
                COUNT(DISTINCT CASE WHEN qs.status = 'PAUSED' THEN qs.id END) AS paused_sessions,
                COUNT(DISTINCT CASE WHEN qs.status = 'CLOSED' THEN qs.id END) AS closed_sessions,
                COUNT(DISTINCT CASE WHEN qe.queue_status IN ('WAITING','NEXT','CALLED') THEN qe.id END) AS patients_waiting,
                COUNT(DISTINCT CASE WHEN qe.queue_status = 'IN_CONSULTATION' THEN qe.id END) AS in_consultation,
                COUNT(DISTINCT CASE WHEN qe.queue_status = 'COMPLETED' THEN qe.id END) AS completed,
                COUNT(DISTINCT CASE WHEN qe.queue_status = 'NO_SHOW' THEN qe.id END) AS no_shows,
                COUNT(DISTINCT CASE WHEN qe.queue_status = 'CANCELLED' THEN qe.id END) AS cancelled
            FROM queue_sessions qs
            LEFT JOIN queue_entries qe ON qe.queue_session_id = qs.id
            WHERE qs.queue_date = %s;
        """, (today,))
        row = cur.fetchone()

        # Notification stats
        cur.execute("""
            SELECT
                COUNT(*) AS total_sent,
                COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) AS delivered,
                COUNT(CASE WHEN status = 'READ' THEN 1 END) AS read_by_patient,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed
            FROM queue_notifications
            WHERE created_at::date = %s;
        """, (today,))
        notif_row = cur.fetchone()

        return {
            "success": True,
            "date": str(today),
            "sessions": {
                "total": row[0] or 0,
                "active": row[1] or 0,
                "paused": row[2] or 0,
                "closed": row[3] or 0
            },
            "patients": {
                "waiting": row[4] or 0,
                "in_consultation": row[5] or 0,
                "completed": row[6] or 0,
                "no_shows": row[7] or 0,
                "cancelled": row[8] or 0
            },
            "notifications": {
                "total_sent": notif_row[0] or 0,
                "delivered": notif_row[1] or 0,
                "read_by_patient": notif_row[2] or 0,
                "failed": notif_row[3] or 0
            }
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


# ─── Patient Queue Status ─────────────────────────────────────────────────────

@router.get(
    "/patient/{patient_id}",
    summary="Patient: Get active queue status for today"
)
def get_patient_queue_status_api(
    patient_id: int,
    user: dict = Depends(get_current_user)
):
    """
    Returns active queue status for patient today.
    Enforces patient authorization (patient can only view their own queue).
    """
    verify_patient_access(user, patient_id)
    try:
        result = queue_service.get_patient_queue_status(patient_id)
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
