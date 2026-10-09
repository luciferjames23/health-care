"""
queue_scheduler.py
==================
AG-06 Queue / Flow Agent — Background Monitor.

Runs as an async background task on FastAPI startup.
Monitors active queue sessions and dispatches notifications for:
- Doctor delay detection (when consultation is overrunning)
- You-are-next notifications (when patient reaches position 1)
- Position update notifications (when patient queue moves)

CRITICAL RULES:
- Does NOT use while True: sleep(...) — uses asyncio.sleep() pattern
- Does NOT calculate queue positions or tokens (that is queue_service.py's job)
- Does NOT touch queue state — READ ONLY monitor
- Does NOT use LLM for any calculations
- Idempotency is enforced by queue_notification_service (via DB unique keys)
- Follows EXACT SAME PATTERN as post_discharge_feedback_scheduler.py

Architecture:
    FastAPI startup → start_queue_scheduler() → asyncio loop → _queue_monitor_loop()
    Every MONITOR_INTERVAL seconds:
        1. Find all ACTIVE queue sessions for today
        2. For each session, check for delay indicators
        3. For each waiting patient: check if YOU_ARE_NEXT should be sent
        4. For each position change: send QUEUE_POSITION_UPDATED

Step: AG-06 Phase 11 (Background Monitor)
"""

import sys
import os
import asyncio
import datetime
import traceback
from typing import List, Dict, Any

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from services import queue_service, queue_notification_service

# Monitor interval (seconds) — how often the monitor loop runs
# Default: 60 seconds — enough for real-time feel without overloading DB
MONITOR_INTERVAL = int(os.getenv("AG06_MONITOR_INTERVAL", "60"))

# Delay detection threshold (minutes overrun before notifying patients)
DELAY_THRESHOLD_MINUTES = int(os.getenv("AG06_DELAY_THRESHOLD_MINUTES", "15"))

_scheduler_running = False


def _get_active_sessions_for_monitor() -> List[Dict[str, Any]]:
    """
    Fetch all active queue sessions for today that need monitoring.
    Returns minimal data needed for loop iteration.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        today = datetime.date.today()
        cur.execute("""
            SELECT qs.id, qs.doctor_id, qs.room_number,
                   d.display_name AS doctor_name, dept.department_name
            FROM queue_sessions qs
            JOIN doctors d ON d.id = qs.doctor_id
            JOIN departments dept ON dept.id = qs.department_id
            WHERE qs.queue_date = %s
              AND qs.status = 'ACTIVE';
        """, (today,))
        return [
            {
                "session_id": r[0],
                "doctor_id": r[1],
                "room_number": r[2],
                "doctor_name": r[3],
                "department_name": r[4]
            }
            for r in cur.fetchall()
        ]
    except Exception as e:
        print(f"[AG-06_MONITOR] Failed to fetch active sessions: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def _get_waiting_patients_for_session(session_id: int) -> List[Dict[str, Any]]:
    """
    Get all waiting patients in a session with their current position data.
    These are the patients who need position-based notifications.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT qe.id, qe.patient_id, qe.token_number, qe.queue_status,
                   qe.position, qe.patients_ahead, qe.estimated_wait_minutes,
                   qe.appointment_id,
                   p.first_name, p.last_name, p.whatsapp_number, p.phone,
                   qs.room_number, qs.doctor_id,
                   d.display_name AS doctor_name, dept.department_name
            FROM queue_entries qe
            JOIN patients p ON p.id = qe.patient_id
            JOIN queue_sessions qs ON qs.id = qe.queue_session_id
            JOIN doctors d ON d.id = qe.doctor_id
            JOIN departments dept ON dept.id = qe.department_id
            WHERE qe.queue_session_id = %s
              AND qe.queue_status IN ('WAITING', 'NEXT')
            ORDER BY qe.token_number ASC;
        """, (session_id,))
        return [
            {
                "entry_id": r[0],
                "patient_id": r[1],
                "token_number": r[2],
                "queue_status": r[3],
                "position": r[4],
                "patients_ahead": r[5],
                "estimated_wait_minutes": r[6],
                "appointment_id": r[7],
                "patient_name": f"{r[8] or ''} {r[9] or ''}".strip(),
                "whatsapp_number": r[10] or r[11],
                "room_number": r[12],
                "doctor_id": r[13],
                "doctor_name": r[14],
                "department_name": r[15]
            }
            for r in cur.fetchall()
        ]
    except Exception as e:
        print(f"[AG-06_MONITOR] Failed to fetch waiting patients for session {session_id}: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def _run_monitor_cycle():
    """
    Execute one full monitoring cycle.
    Called by the async loop at each interval.
    """
    try:
        active_sessions = _get_active_sessions_for_monitor()
        if not active_sessions:
            return

        total_notifications = 0
        for session_info in active_sessions:
            session_id = session_info["session_id"]
            doctor_id = session_info["doctor_id"]

            try:
                # ── 1. Doctor Delay Detection ──────────────────────────────────
                delay_info = queue_service.detect_doctor_delay(
                    queue_session_id=session_id,
                    delay_threshold_minutes=DELAY_THRESHOLD_MINUTES
                )

                if delay_info and delay_info.get("delay_detected"):
                    overrun = delay_info["overrun_minutes"]
                    # Notify waiting patients about delay
                    waiting_patients = _get_waiting_patients_for_session(session_id)
                    for patient in waiting_patients:
                        result = queue_notification_service.send_queue_notification(
                            queue_entry_id=patient["entry_id"],
                            notification_type="DOCTOR_DELAY",
                            context={
                                **patient,
                                **session_info,
                                # Adjust ETA to account for overrun
                                "estimated_wait_minutes": max(0, patient["estimated_wait_minutes"] + overrun)
                            },
                            language=queue_service.get_patient_language(patient["patient_id"]),
                            # Context key includes overrun bucket (every 5 mins) to re-send on escalation
                            context_key=f"delay_{(overrun // 5) * 5}"
                        )
                        if result.get("success") and not result.get("skipped_duplicate"):
                            total_notifications += 1

                # ── 2. YOU_ARE_NEXT detection ──────────────────────────────────
                waiting_patients = _get_waiting_patients_for_session(session_id)
                for patient in waiting_patients:
                    # Patient is next (patients_ahead = 0 and still WAITING)
                    if patient["patients_ahead"] == 0 and patient["queue_status"] == "WAITING":
                        result = queue_notification_service.process_you_are_next(
                            entry_id=patient["entry_id"],
                            entry_data={**patient, **session_info}
                        )
                        if result.get("success") and not result.get("skipped_duplicate"):
                            total_notifications += 1

                # ── 3. Position update for patients whose position improved ────
                # Position updates at intervals of 2 (every time 2 patients complete)
                # Idempotency prevents re-sending for same position
                for patient in waiting_patients:
                    if patient["patients_ahead"] > 0:
                        # Send position update only for significant moves
                        # (Idempotency ensures no duplicate per position)
                        result = queue_notification_service.process_position_update(
                            entry_id=patient["entry_id"],
                            entry_data={**patient, **session_info}
                        )
                        if result.get("success") and not result.get("skipped_duplicate"):
                            total_notifications += 1

            except Exception as session_err:
                print(f"[AG-06_MONITOR] Error monitoring session {session_id}: {session_err}")

        if total_notifications > 0:
            print(f"[AG-06_MONITOR] Cycle complete. Sessions: {len(active_sessions)}, "
                  f"Notifications sent: {total_notifications}")

    except Exception as e:
        print(f"[AG-06_MONITOR] Monitor cycle error: {e}")
        traceback.print_exc()


async def _queue_monitor_loop(interval_seconds: int = MONITOR_INTERVAL):
    """
    AG-06 async background monitoring loop.
    Follows the same pattern as _background_scheduler_loop() in
    post_discharge_feedback_scheduler.py.
    """
    global _scheduler_running
    _scheduler_running = True
    print(f"[AG-06_SCHEDULER] Queue monitor started. Interval: {interval_seconds}s.")
    while _scheduler_running:
        try:
            await asyncio.to_thread(_run_monitor_cycle)
        except Exception as e:
            print(f"[AG-06_SCHEDULER_LOOP_ERR] {e}")
        await asyncio.sleep(interval_seconds)


def start_queue_scheduler(app=None):
    """
    Start the AG-06 queue monitor background worker on FastAPI startup.
    Follows IDENTICAL pattern to start_post_discharge_feedback_scheduler().
    Called from main.py on startup.
    """
    try:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_queue_monitor_loop(interval_seconds=MONITOR_INTERVAL))
        except RuntimeError:
            import threading
            def run_async_loop():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(_queue_monitor_loop(interval_seconds=MONITOR_INTERVAL))

            t = threading.Thread(target=run_async_loop, daemon=True)
            t.start()
        print("[AG-06_SCHEDULER] Registered AG-06 Queue monitor background worker.")
    except Exception as e:
        print(f"[AG-06_SCHEDULER_INIT_WARN] Could not start AG-06 monitor: {e}")


def stop_queue_scheduler():
    """Gracefully stop the AG-06 monitor loop (for shutdown hooks)."""
    global _scheduler_running
    _scheduler_running = False
    print("[AG-06_SCHEDULER] Queue monitor stopping.")
