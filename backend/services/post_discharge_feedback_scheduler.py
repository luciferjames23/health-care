"""
post_discharge_feedback_scheduler.py
=====================================
Automated Post-Discharge Feedback Trigger Service (AG-05).

Identifies patients discharged 24 hours ago and triggers an automated
WhatsApp feedback request. Idempotent and event-driven via production-safe
background scheduled worker.
"""

import sys
import os
import asyncio
import datetime
import traceback
from typing import List, Dict, Any

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import voice.whatsapp_client as whatsapp_client
import agent.language_service as language_service

_scheduler_running = False


def check_and_trigger_post_discharge_feedback() -> Dict[str, Any]:
    """
    Queries PostgreSQL for patients discharged >= 24 hours ago who have not yet
    been sent an automated post-discharge feedback request.
    Sends WhatsApp message and records feedback trigger in database.
    """
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    triggered_count = 0
    errors = []

    try:
        # 1. Fetch eligible discharged patients from dim_generated_discharge_summaries / admissions / patients
        # Patients discharged >= 24 hours ago
        cutoff_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)

        cur.execute("""
            SELECT DISTINCT 
                p.id AS patient_id,
                p.first_name,
                p.last_name,
                p.phone,
                c.conversation_code,
                s.generated_at AS discharge_time
            FROM dim_generated_discharge_summaries s
            JOIN patients p ON s.patient_id = p.id
            LEFT JOIN conversations c ON c.patient_id = p.id
            WHERE s.approval_status IN ('Approved', 'Signed off', 'Completed')
              AND s.generated_at <= %s
              AND p.phone IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM patient_feedback f 
                  WHERE f.patient_id = p.id 
                    AND f.source = 'AUTOMATED_POST_DISCHARGE'
              )
            LIMIT 20;
        """, (cutoff_time,))

        eligible_rows = cur.fetchall()

        for row in eligible_rows:
            p_id, f_name, l_name, phone, conv_code, d_time = row
            pat_name = f"{f_name or ''} {l_name or ''}".strip() or "Valued Patient"
            
            # Ensure valid phone / conversation_code
            wa_num = phone.replace("+", "").replace("-", "").replace(" ", "") if phone else "919999999999"
            if not conv_code:
                conv_code = f"WA_{wa_num}"

            # Message content
            msg_text = (
                f"💬 *Meridian Hospital — Post-Discharge Care*\n\n"
                f"Dear {pat_name}, thank you for choosing Meridian Hospital.\n"
                f"We hope your recovery is going well following your discharge.\n\n"
                f"We would value your feedback on your stay and experience with our doctors, nursing, food, and services."
            )

            buttons = [
                {"id": "btn_feedback", "title": "Provide Feedback"},
                {"id": "btn_cat_staff", "title": "Talk to Staff"}
            ]

            # Send WhatsApp message via whatsapp_client
            try:
                whatsapp_client.send_button_message(wa_num, msg_text, buttons)
            except Exception as send_err:
                print(f"[POST_DISCHARGE_FB_SEND_WARN] Could not send WhatsApp to {wa_num}: {send_err}")

            # Record in patient_feedback table
            cur.execute("""
                INSERT INTO patient_feedback (
                    patient_id, source, original_feedback, sentiment,
                    status, requires_action, created_at, updated_at
                ) VALUES (
                    %s, 'AUTOMATED_POST_DISCHARGE', %s, 'NEUTRAL',
                    'OPEN', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            """, (p_id, f"Automated 24h post-discharge feedback request sent to {pat_name}"))

            # Log notification
            cur.execute("""
                INSERT INTO notifications (
                    patient_id, notification_type, channel, message, status
                ) VALUES (
                    %s, 'POST_DISCHARGE_FEEDBACK', 'WHATSAPP', %s, 'SENT'
                );
            """, (p_id, f"Automated 24h post-discharge feedback request sent to {pat_name}"))

            triggered_count += 1

        conn.commit()
        print(f"[POST_DISCHARGE_FEEDBACK_SCHEDULER] Checked cutoff={cutoff_time.isoformat()}, triggered={triggered_count}")
        return {"success": True, "triggered_count": triggered_count, "errors": errors}

    except Exception as e:
        conn.rollback()
        err_msg = f"[POST_DISCHARGE_FEEDBACK_ERROR] {e}"
        print(err_msg)
        traceback.print_exc()
        return {"success": False, "triggered_count": triggered_count, "error": str(e)}
    finally:
        cur.close()
        conn.close()


async def _background_scheduler_loop(interval_seconds: int = 900):
    """Background async task running check every interval_seconds (default 15 mins)."""
    global _scheduler_running
    _scheduler_running = True
    print("[POST_DISCHARGE_FB_SCHEDULER] Started background post-discharge feedback worker loop.")
    while _scheduler_running:
        try:
            await asyncio.to_thread(check_and_trigger_post_discharge_feedback)
        except Exception as e:
            print(f"[POST_DISCHARGE_FB_LOOP_ERR] {e}")
        await asyncio.sleep(interval_seconds)


def start_post_discharge_feedback_scheduler(app=None):
    """Schedules background post-discharge feedback worker non-blockingly on FastAPI startup."""
    try:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_background_scheduler_loop(interval_seconds=900))
        except RuntimeError:
            import threading
            def run_async_loop():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(_background_scheduler_loop(interval_seconds=900))

            t = threading.Thread(target=run_async_loop, daemon=True)
            t.start()
        print("[POST_DISCHARGE_FB_SCHEDULER] Registered post-discharge feedback background worker.")
    except Exception as e:
        print(f"[POST_DISCHARGE_FB_SCHEDULER_INIT_WARN] {e}")
