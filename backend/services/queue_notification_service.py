"""
queue_notification_service.py
==============================
AG-06 Queue / Flow Agent — Notification Dispatcher.

Responsible for:
- Determining WHEN to send a queue notification (idempotency)
- Generating multilingual message content
- Calling existing WhatsApp client (voice/whatsapp_client.py)
- Tracking delivery status in queue_notifications table
- Preventing duplicate notifications
- Bounded retry on WhatsApp failure

CRITICAL RULES:
- Uses EXISTING voice/whatsapp_client.send_text_message() — NO NEW WHATSAPP CLIENT
- Idempotency key prevents duplicate notifications for same queue event
- WhatsApp failure MUST NOT corrupt queue state
- Language comes from patient's existing conversation language
- LLM is NOT used for queue fact calculation — only for optional message wording

Integrates with:
- voice/whatsapp_client.py (existing)
- agent/language_service.py (existing, with queue messages added)
- queue_service.py (existing queue state)
- db_config.py (existing DB pool)

Step: AG-06 Phase 8-10
"""

import sys
import os
import json
import datetime
import traceback
from typing import Optional, Dict, Any, List

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import voice.whatsapp_client as whatsapp_client

# Max retries for WhatsApp send failures
MAX_RETRY_ATTEMPTS = 3


# ─── Multilingual Queue Message Templates ─────────────────────────────────────
# These templates are populated here as a fallback.
# The primary source is agent/language_service.py TRANSLATIONS dict (extended separately).

QUEUE_MESSAGES = {
    "ENGLISH": {
        "TOKEN_ASSIGNED": (
            "🏥 *Meridian Hospital*\n\n"
            "Hello {patient_name},\n\n"
            "You have been checked in successfully.\n\n"
            "🎫 Token: *#{token_number}*\n"
            "👨‍⚕️ Doctor: {doctor_name}\n"
            "🏥 Department: {department_name}\n"
            "📍 Room: {room_number}\n"
            "👥 Patients ahead: {patients_ahead}\n"
            "⏱️ Estimated wait: *{estimated_wait} minutes*\n\n"
            "You will receive queue updates through WhatsApp."
        ),
        "QUEUE_POSITION_UPDATED": (
            "🔔 *Queue Update*\n\n"
            "Hello {patient_name},\n\n"
            "Your queue has moved forward.\n\n"
            "🎫 Token: *#{token_number}*\n"
            "📊 Position: {queue_position}\n"
            "👥 Patients ahead: {patients_ahead}\n"
            "⏱️ Estimated wait: *{estimated_wait} minutes*\n\n"
            "Please remain available until your turn."
        ),
        "YOU_ARE_NEXT": (
            "🔔 *You Are Next!*\n\n"
            "Hello {patient_name},\n\n"
            "Your consultation is coming up very soon.\n\n"
            "🎫 Token: *#{token_number}*\n"
            "👨‍⚕️ Doctor: {doctor_name}\n"
            "📍 Room: {room_number}\n\n"
            "Please be ready to proceed to the consultation room."
        ),
        "PROCEED_TO_ROOM": (
            "🚨 *Please Proceed Now*\n\n"
            "Hello {patient_name},\n\n"
            "It is now your turn for consultation.\n\n"
            "🎫 Token: *#{token_number}*\n"
            "👨‍⚕️ Doctor: {doctor_name}\n"
            "📍 Consultation Room: {room_number}\n"
            "🏥 Department: {department_name}\n\n"
            "Please proceed to the room immediately."
        ),
        "CONSULTATION_STARTED": (
            "👨‍⚕️ *Consultation Started*\n\n"
            "Hello {patient_name},\n\n"
            "Your consultation with {doctor_name} has started.\n\n"
            "🎫 Token: *#{token_number}*\n"
            "📍 Room: {room_number}"
        ),
        "DOCTOR_DELAY": (
            "⏰ *Queue Update — Doctor Delay*\n\n"
            "Hello {patient_name},\n\n"
            "We apologize for the inconvenience. The doctor is currently running behind schedule.\n\n"
            "🎫 Token: *#{token_number}*\n"
            "⏱️ Estimated wait: *{estimated_wait} minutes*\n\n"
            "Thank you for your patience."
        ),
        "QUEUE_PAUSED": (
            "⏸️ *Queue Paused*\n\n"
            "Hello {patient_name},\n\n"
            "The consultation queue has been temporarily paused.\n\n"
            "🎫 Token: *#{token_number}*\n"
            "👨‍⚕️ Doctor: {doctor_name}\n\n"
            "We will notify you when the queue resumes. Thank you for your patience."
        ),
        "QUEUE_RESUMED": (
            "▶️ *Queue Resumed*\n\n"
            "Hello {patient_name},\n\n"
            "The consultation queue has resumed.\n\n"
            "🎫 Token: *#{token_number}*\n"
            "📊 Position: {queue_position}\n"
            "👥 Patients ahead: {patients_ahead}\n"
            "⏱️ Estimated wait: *{estimated_wait} minutes*\n\n"
            "Please remain available until your turn."
        ),
        "QUEUE_CANCELLED": (
            "❌ *Queue Cancelled*\n\n"
            "Hello {patient_name},\n\n"
            "We regret to inform you that today's consultation queue with {doctor_name} "
            "has been cancelled.\n\n"
            "🎫 Token: *#{token_number}*\n\n"
            "Please contact Meridian Hospital reception to reschedule your appointment. "
            "We apologize for the inconvenience."
        ),
    },
    "TAMIL": {
        "TOKEN_ASSIGNED": (
            "🏥 *மெரிடியன் மருத்துவமனை*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "நீங்கள் வெற்றிகரமாக பதிவு செய்யப்பட்டுள்ளீர்கள்.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n"
            "👨‍⚕️ மருத்துவர்: {doctor_name}\n"
            "🏥 துறை: {department_name}\n"
            "📍 அறை: {room_number}\n"
            "👥 முன்னால் நோயாளிகள்: {patients_ahead}\n"
            "⏱️ கனிக்கப்பட்ட காத்திருப்பு: *{estimated_wait} நிமிடங்கள்*\n\n"
            "உங்கள் வரிசை புதுப்பிப்புகள் WhatsApp வழியாக வரும்."
        ),
        "QUEUE_POSITION_UPDATED": (
            "🔔 *வரிசை புதுப்பிப்பு*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "உங்கள் வரிசை முன்னோக்கி நகர்ந்துள்ளது.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n"
            "📊 நிலை: {queue_position}\n"
            "👥 முன்னால் நோயாளிகள்: {patients_ahead}\n"
            "⏱️ கனிக்கப்பட்ட காத்திருப்பு: *{estimated_wait} நிமிடங்கள்*\n\n"
            "உங்கள் முறை வரும் வரை காத்திருக்கவும்."
        ),
        "YOU_ARE_NEXT": (
            "🔔 *நீங்கள் அடுத்தவர்!*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "உங்கள் சந்திப்பு மிக விரைவில் நடைபெறவுள்ளது.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n"
            "👨‍⚕️ மருத்துவர்: {doctor_name}\n"
            "📍 அறை: {room_number}\n\n"
            "சந்திப்பு அறைக்கு செல்ல தயாராக இருக்கவும்."
        ),
        "PROCEED_TO_ROOM": (
            "🚨 *இப்போது அறைக்கு செல்லுங்கள்*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "இப்போது உங்கள் சந்திப்பு நேரம்.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n"
            "👨‍⚕️ மருத்துவர்: {doctor_name}\n"
            "📍 சந்திப்பு அறை: {room_number}\n"
            "🏥 துறை: {department_name}\n\n"
            "உடனடியாக அறைக்கு செல்லுங்கள்."
        ),
        "CONSULTATION_STARTED": (
            "👨‍⚕️ *சந்திப்பு தொடங்கியது*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "{doctor_name} உடனான உங்கள் சந்திப்பு தொடங்கியது.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n"
            "📍 அறை: {room_number}"
        ),
        "DOCTOR_DELAY": (
            "⏰ *வரிசை புதுப்பிப்பு — மருத்துவர் தாமதம்*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "மருத்துவர் சற்று தாமதமாக உள்ளார். இதற்கு மன்னிப்பு கோருகிறோம்.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n"
            "⏱️ கனிக்கப்பட்ட காத்திருப்பு: *{estimated_wait} நிமிடங்கள்*\n\n"
            "உங்கள் பொறுமைக்கு நன்றி."
        ),
        "QUEUE_PAUSED": (
            "⏸️ *வரிசை நிறுத்தப்பட்டது*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "சந்திப்பு வரிசை தற்காலிகமாக நிறுத்தப்பட்டுள்ளது.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n"
            "👨‍⚕️ மருத்துவர்: {doctor_name}\n\n"
            "வரிசை மீண்டும் தொடரும்போது உங்களுக்கு தெரிவிப்போம். நன்றி."
        ),
        "QUEUE_RESUMED": (
            "▶️ *வரிசை மீண்டும் தொடர்கிறது*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "சந்திப்பு வரிசை மீண்டும் தொடங்கியது.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n"
            "📊 நிலை: {queue_position}\n"
            "👥 முன்னால் நோயாளிகள்: {patients_ahead}\n"
            "⏱️ கனிக்கப்பட்ட காத்திருப்பு: *{estimated_wait} நிமிடங்கள்*"
        ),
        "QUEUE_CANCELLED": (
            "❌ *வரிசை ரத்து செய்யப்பட்டது*\n\n"
            "வணக்கம் {patient_name},\n\n"
            "{doctor_name} உடனான இன்றைய சந்திப்பு வரிசை ரத்து செய்யப்பட்டது.\n\n"
            "🎫 டோக்கன்: *#{token_number}*\n\n"
            "உங்கள் சந்திப்பை மீண்டும் திட்டமிட மருத்துவமனை வரவேற்பறையை தொடர்பு கொள்ளவும்."
        ),
    },
    "HINDI": {
        "TOKEN_ASSIGNED": (
            "🏥 *मेरिडियन अस्पताल*\n\n"
            "नमस्ते {patient_name},\n\n"
            "आपका रजिस्ट्रेशन सफलतापूर्वक हो गया है।\n\n"
            "🎫 टोकन: *#{token_number}*\n"
            "👨‍⚕️ डॉक्टर: {doctor_name}\n"
            "🏥 विभाग: {department_name}\n"
            "📍 कमरा: {room_number}\n"
            "👥 आगे मरीज: {patients_ahead}\n"
            "⏱️ अनुमानित प्रतीक्षा: *{estimated_wait} मिनट*\n\n"
            "आपको WhatsApp पर कतार अपडेट मिलेंगे।"
        ),
        "QUEUE_POSITION_UPDATED": (
            "🔔 *कतार अपडेट*\n\n"
            "नमस्ते {patient_name},\n\n"
            "आपकी कतार आगे बढ़ी है।\n\n"
            "🎫 टोकन: *#{token_number}*\n"
            "📊 स्थिति: {queue_position}\n"
            "👥 आगे मरीज: {patients_ahead}\n"
            "⏱️ अनुमानित प्रतीक्षा: *{estimated_wait} मिनट*"
        ),
        "YOU_ARE_NEXT": (
            "🔔 *आप अगले हैं!*\n\n"
            "नमस्ते {patient_name},\n\n"
            "आपका परामर्श बहुत जल्द होगा।\n\n"
            "🎫 टोकन: *#{token_number}*\n"
            "👨‍⚕️ डॉक्टर: {doctor_name}\n"
            "📍 कमरा: {room_number}\n\n"
            "कृपया परामर्श कक्ष में जाने के लिए तैयार रहें।"
        ),
        "PROCEED_TO_ROOM": (
            "🚨 *कृपया अभी जाएं*\n\n"
            "नमस्ते {patient_name},\n\n"
            "अब आपकी बारी है।\n\n"
            "🎫 टोकन: *#{token_number}*\n"
            "👨‍⚕️ डॉक्टर: {doctor_name}\n"
            "📍 परामर्श कक्ष: {room_number}\n\n"
            "कृपया तुरंत कमरे में जाएं।"
        ),
        "CONSULTATION_STARTED": (
            "👨‍⚕️ *परामर्श शुरू हो गया*\n\n"
            "नमस्ते {patient_name},\n\n"
            "{doctor_name} के साथ आपका परामर्श शुरू हो गया है।"
        ),
        "DOCTOR_DELAY": (
            "⏰ *कतार अपडेट — डॉक्टर में देरी*\n\n"
            "नमस्ते {patient_name},\n\n"
            "डॉक्टर थोड़ा देर से चल रहे हैं। असुविधा के लिए क्षमा करें।\n\n"
            "⏱️ अनुमानित प्रतीक्षा: *{estimated_wait} मिनट*"
        ),
        "QUEUE_PAUSED": (
            "⏸️ *कतार रोकी गई*\n\n"
            "नमस्ते {patient_name},\n\n"
            "परामर्श कतार अस्थायी रूप से रोकी गई है। जब कतार फिर शुरू होगी तो सूचित किया जाएगा।"
        ),
        "QUEUE_RESUMED": (
            "▶️ *कतार फिर शुरू हुई*\n\n"
            "नमस्ते {patient_name},\n\n"
            "परामर्श कतार फिर शुरू हो गई है।\n\n"
            "🎫 टोकन: *#{token_number}*\n"
            "📊 स्थिति: {queue_position}\n"
            "⏱️ अनुमानित प्रतीक्षा: *{estimated_wait} मिनट*"
        ),
        "QUEUE_CANCELLED": (
            "❌ *कतार रद्द*\n\n"
            "नमस्ते {patient_name},\n\n"
            "{doctor_name} के साथ आज की परामर्श कतार रद्द कर दी गई है। "
            "कृपया अपॉइंटमेंट रिशेड्यूल करने के लिए अस्पताल से संपर्क करें।"
        ),
    },
}

# For languages without specific templates, fall back to English
def _get_message_template(notification_type: str, language: str) -> str:
    """Get message template for the given type and language, falling back to English."""
    lang_templates = QUEUE_MESSAGES.get(language, QUEUE_MESSAGES.get("ENGLISH", {}))
    template = lang_templates.get(notification_type)
    if not template:
        template = QUEUE_MESSAGES.get("ENGLISH", {}).get(notification_type, "")
    return template


# ─── Idempotency Key Generation ───────────────────────────────────────────────

def _make_idempotency_key(
    notification_type: str,
    queue_entry_id: int,
    context_key: str = ""
) -> str:
    """
    Generate a unique idempotency key for a queue notification.
    Same event with same context will always produce the same key → prevent duplicates.
    """
    if context_key:
        return f"{notification_type}:entry_{queue_entry_id}:{context_key}"
    return f"{notification_type}:entry_{queue_entry_id}"


# ─── Duplicate Check ──────────────────────────────────────────────────────────

def _notification_already_sent(conn, idempotency_key: str) -> bool:
    """
    Check if a notification with this idempotency key was already sent successfully.
    Returns True if already sent (preventing duplicate), False if safe to send.
    """
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT status FROM queue_notifications
            WHERE idempotency_key = %s
            LIMIT 1;
        """, (idempotency_key,))
        row = cur.fetchone()
        if not row:
            return False
        status = row[0]
        # Only suppress if previously sent successfully (not FAILED ones — those can retry)
        return status in ('SENT', 'DELIVERED', 'READ')
    finally:
        cur.close()


# ─── Notification Record ──────────────────────────────────────────────────────

def _record_notification(
    conn,
    queue_entry_id: int,
    patient_id: int,
    appointment_id: int,
    notification_type: str,
    idempotency_key: str,
    message_content: str,
    language: str,
    whatsapp_number: str
) -> int:
    """Insert a queue_notifications record and return its ID."""
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO queue_notifications (
                queue_entry_id, patient_id, appointment_id,
                notification_type, idempotency_key, message_content, language,
                whatsapp_number, status, attempt_count, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'PENDING', 0, NOW())
            ON CONFLICT (idempotency_key) DO UPDATE
                SET attempt_count = queue_notifications.attempt_count + 1
            RETURNING id;
        """, (
            queue_entry_id, patient_id, appointment_id,
            notification_type, idempotency_key, message_content, language, whatsapp_number
        ))
        return cur.fetchone()[0]
    finally:
        cur.close()


def _update_notification_sent(conn, notification_id: int, whatsapp_message_id: str):
    """Mark notification as SENT with Meta message ID."""
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE queue_notifications
            SET status = 'SENT',
                whatsapp_message_id = %s,
                sent_at = NOW(),
                attempt_count = attempt_count + 1
            WHERE id = %s;
        """, (whatsapp_message_id, notification_id))
    finally:
        cur.close()


def _update_notification_failed(conn, notification_id: int, error: str):
    """Mark notification as FAILED with error detail."""
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE queue_notifications
            SET status = 'FAILED',
                last_error = %s,
                failed_at = NOW(),
                attempt_count = attempt_count + 1
            WHERE id = %s;
        """, (error[:500], notification_id))
    finally:
        cur.close()


# ─── Core Notification Dispatch ───────────────────────────────────────────────

def send_queue_notification(
    queue_entry_id: int,
    notification_type: str,
    context: Dict[str, Any],
    language: str = "ENGLISH",
    context_key: str = ""
) -> Dict[str, Any]:
    """
    AG-06 Core Notification Dispatcher.

    Checks idempotency, generates message, sends via existing WhatsApp client,
    records delivery tracking. WhatsApp failure DOES NOT affect queue state.

    Args:
        queue_entry_id: ID of the queue_entries record
        notification_type: One of TOKEN_ASSIGNED, QUEUE_POSITION_UPDATED, etc.
        context: Dict with {patient_name, doctor_name, department_name, token_number,
                             queue_position, patients_ahead, estimated_wait, room_number, ...}
        language: Patient's language (ENGLISH, TAMIL, HINDI, etc.)
        context_key: Optional qualifier for idempotency (e.g. "pos_3" for position=3)

    Returns:
        dict with success, idempotency_key, notification_id, message_id, skipped_duplicate
    """
    idempotency_key = _make_idempotency_key(notification_type, queue_entry_id, context_key)

    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # ── Idempotency check ─────────────────────────────────────────────────
        if _notification_already_sent(conn, idempotency_key):
            print(f"[AG-06] DUPLICATE PREVENTED: {idempotency_key}")
            return {
                "success": True,
                "skipped_duplicate": True,
                "idempotency_key": idempotency_key,
                "notification_id": None,
                "message_id": None
            }

        # ── Resolve patient/appointment info ──────────────────────────────────
        patient_id = context.get("patient_id")
        appointment_id = context.get("appointment_id")
        whatsapp_number = context.get("whatsapp_number")

        if not all([patient_id, appointment_id, whatsapp_number]):
            cur.execute("""
                SELECT qe.patient_id, qe.appointment_id,
                       p.whatsapp_number, p.phone
                FROM queue_entries qe
                JOIN patients p ON p.id = qe.patient_id
                WHERE qe.id = %s;
            """, (queue_entry_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Queue entry {queue_entry_id} not found")
            patient_id = patient_id or row[0]
            appointment_id = appointment_id or row[1]
            whatsapp_number = whatsapp_number or row[2] or row[3]

        if not whatsapp_number:
            print(f"[AG-06] WARNING: No WhatsApp number for patient {patient_id}, entry {queue_entry_id}")
            return {"success": False, "error": "No WhatsApp number found", "skipped_duplicate": False}

        # ── Generate message content ──────────────────────────────────────────
        template = _get_message_template(notification_type, language)
        if not template:
            print(f"[AG-06] WARNING: No template for {notification_type} in {language}")
            return {"success": False, "error": "No message template found", "skipped_duplicate": False}

        # Fill template variables — context supplies all values
        room_display = context.get("room_number") or "To be confirmed"
        position_label = _ordinal(context.get("patients_ahead", 0) + 1)

        message_text = template.format(
            patient_name=context.get("patient_name", ""),
            doctor_name=context.get("doctor_name", ""),
            department_name=context.get("department_name", ""),
            token_number=context.get("token_number", ""),
            queue_position=position_label,
            patients_ahead=context.get("patients_ahead", 0),
            estimated_wait=context.get("estimated_wait_minutes", 0),
            room_number=room_display,
            appointment_date=context.get("queue_date", "today"),
            appointment_time=context.get("appointment_time", "")
        )

        # ── Record notification (PENDING) ─────────────────────────────────────
        notification_id = _record_notification(
            conn=conn,
            queue_entry_id=queue_entry_id,
            patient_id=patient_id,
            appointment_id=appointment_id,
            notification_type=notification_type,
            idempotency_key=idempotency_key,
            message_content=message_text,
            language=language,
            whatsapp_number=whatsapp_number
        )
        conn.commit()

        # ── Send via existing WhatsApp client ─────────────────────────────────
        # CRITICAL: WhatsApp failure must NOT affect queue state
        # The queue_notifications record is already committed above.
        # This send is independent of queue state.
        send_result = None
        last_error = None

        for attempt in range(1, MAX_RETRY_ATTEMPTS + 1):
            try:
                send_result = whatsapp_client.send_text_message(
                    to_number=whatsapp_number,
                    text=message_text
                )
                if send_result.get("success"):
                    break
                safe_err = str(last_error).encode('ascii', errors='backslashreplace').decode('ascii')
                print(f"[AG-06] WhatsApp send attempt {attempt} failed: {safe_err}")
            except Exception as e:
                last_error = str(e)
                safe_err = str(e).encode('ascii', errors='backslashreplace').decode('ascii')
                print(f"[AG-06] WhatsApp send exception attempt {attempt}: {safe_err}")

        # ── Update notification status ─────────────────────────────────────────
        conn_update = db_config.get_db_connection()
        conn_update.autocommit = False
        cur_update = conn_update.cursor()
        try:
            if send_result and send_result.get("success"):
                wa_msg_id = send_result.get("message_id", "")
                _update_notification_sent(conn_update, notification_id, wa_msg_id)
                conn_update.commit()
                print(f"[AG-06] Notification SENT: type={notification_type} "
                      f"entry={queue_entry_id} wa_id={wa_msg_id} idem={idempotency_key}")
                return {
                    "success": True,
                    "skipped_duplicate": False,
                    "notification_id": notification_id,
                    "idempotency_key": idempotency_key,
                    "message_id": wa_msg_id,
                    "language": language,
                    "notification_type": notification_type
                }
            else:
                error_msg = last_error or "WhatsApp send failed after all attempts"
                _update_notification_failed(conn_update, notification_id, error_msg)
                conn_update.commit()
                safe_err = str(error_msg).encode('ascii', errors='backslashreplace').decode('ascii')
                print(f"[AG-06] Notification FAILED: type={notification_type} "
                      f"entry={queue_entry_id} error={safe_err}")
                # IMPORTANT: Queue state is NOT modified. Only notification status is FAILED.
                return {
                    "success": False,
                    "skipped_duplicate": False,
                    "notification_id": notification_id,
                    "idempotency_key": idempotency_key,
                    "error": error_msg
                }
        except Exception as update_err:
            conn_update.rollback()
            print(f"[AG-06] Failed to update notification status: {update_err}")
            return {
                "success": False,
                "error": f"Status update failed: {update_err}",
                "notification_id": notification_id,
                "idempotency_key": idempotency_key
            }
        finally:
            cur_update.close()
            conn_update.close()

    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        traceback.print_exc()
        print(f"[AG-06] Critical error in send_queue_notification: {e}")
        return {
            "success": False,
            "error": str(e),
            "skipped_duplicate": False,
            "idempotency_key": idempotency_key
        }
    finally:
        cur.close()
        conn.close()


# ─── AG-06 Event Processors ───────────────────────────────────────────────────

def process_token_assigned(entry_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process TOKEN_ASSIGNED event after patient check-in.
    Called by queue_service.patient_check_in().
    """
    patient_id = entry_data.get("patient_id")
    language = _get_patient_language(patient_id)

    return send_queue_notification(
        queue_entry_id=entry_data["entry_id"],
        notification_type="TOKEN_ASSIGNED",
        context=entry_data,
        language=language,
        context_key=f"token_{entry_data.get('token_number')}"
    )


def process_position_update(
    entry_id: int,
    entry_data: Dict[str, Any],
    min_position_change: int = 1
) -> Dict[str, Any]:
    """
    Process QUEUE_POSITION_UPDATED event.
    Only sends if patients_ahead decreased by at least min_position_change.
    """
    patients_ahead = entry_data.get("patients_ahead", 0)

    # Don't send for position 0 (that's YOU_ARE_NEXT territory)
    if patients_ahead == 0:
        return {"success": True, "skipped": True, "reason": "Use YOU_ARE_NEXT instead"}

    patient_id = entry_data.get("patient_id")
    language = _get_patient_language(patient_id)

    # Context key includes current position to ensure new notification when position changes
    context_key = f"ahead_{patients_ahead}"

    return send_queue_notification(
        queue_entry_id=entry_id,
        notification_type="QUEUE_POSITION_UPDATED",
        context=entry_data,
        language=language,
        context_key=context_key
    )


def process_you_are_next(entry_id: int, entry_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process YOU_ARE_NEXT event — patient is now position 1.
    Idempotent: only sent ONCE per entry (no context_key suffix = fixed key).
    """
    patient_id = entry_data.get("patient_id")
    language = _get_patient_language(patient_id)

    return send_queue_notification(
        queue_entry_id=entry_id,
        notification_type="YOU_ARE_NEXT",
        context=entry_data,
        language=language
        # No context_key — once is enough for YOU_ARE_NEXT
    )


def process_proceed_to_room(entry_id: int, entry_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process PROCEED_TO_ROOM event — doctor calls patient.
    Idempotent: only sent ONCE per entry.
    """
    patient_id = entry_data.get("patient_id")
    language = _get_patient_language(patient_id)

    return send_queue_notification(
        queue_entry_id=entry_id,
        notification_type="PROCEED_TO_ROOM",
        context=entry_data,
        language=language
        # Fixed idempotency key — one PROCEED_TO_ROOM per entry
    )


def process_consultation_started(entry_id: int, entry_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process CONSULTATION_STARTED event.
    Idempotent: only sent ONCE per entry.
    """
    patient_id = entry_data.get("patient_id")
    language = _get_patient_language(patient_id)

    return send_queue_notification(
        queue_entry_id=entry_id,
        notification_type="CONSULTATION_STARTED",
        context=entry_data,
        language=language
    )


def process_queue_paused(session_id: int, affected_patients: list, session_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Send QUEUE_PAUSED notification to all affected patients.
    Each patient gets an independent idempotency key.
    """
    results = []
    for patient in affected_patients:
        entry_id = patient.get("entry_id")
        patient_id = patient.get("patient_id")
        language = _get_patient_language(patient_id)

        context = {
            **patient,
            **session_data,
            "patient_name": patient.get("patient_name"),
            "token_number": patient.get("token_number")
        }

        result = send_queue_notification(
            queue_entry_id=entry_id,
            notification_type="QUEUE_PAUSED",
            context=context,
            language=language,
            context_key=f"session_{session_id}_paused"
        )
        results.append(result)
    return results


def process_queue_resumed(session_id: int, updated_entries: list, session_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Send QUEUE_RESUMED notification to waiting patients.
    Uses current positions as context keys to avoid re-sending on same position.
    """
    results = []
    for entry in updated_entries:
        entry_id = entry.get("entry_id")
        patient_id = entry.get("patient_id")
        if not entry_id or not patient_id:
            continue

        language = _get_patient_language(patient_id)
        context = {**entry, **session_data}

        result = send_queue_notification(
            queue_entry_id=entry_id,
            notification_type="QUEUE_RESUMED",
            context=context,
            language=language,
            context_key=f"session_{session_id}_resumed_pos_{entry.get('position', 0)}"
        )
        results.append(result)
    return results


def process_queue_cancelled(session_id: int, affected_patients: list, session_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Send QUEUE_CANCELLED notification to all affected patients.
    """
    results = []
    for patient in affected_patients:
        entry_id = patient.get("entry_id")
        patient_id = patient.get("patient_id")
        language = _get_patient_language(patient_id)

        context = {
            **patient,
            **session_data,
            "patient_name": patient.get("patient_name"),
            "token_number": patient.get("token_number")
        }

        result = send_queue_notification(
            queue_entry_id=entry_id,
            notification_type="QUEUE_CANCELLED",
            context=context,
            language=language,
            context_key=f"session_{session_id}_cancelled"
        )
        results.append(result)
    return results


# ─── WhatsApp Delivery Status Update ─────────────────────────────────────────

def update_notification_delivery_status(
    whatsapp_message_id: str,
    status: str,
    timestamp: Optional[datetime.datetime] = None
) -> bool:
    """
    Update delivery status from Meta webhook (DELIVERED, READ).
    Called from whatsapp_routes.py webhook handler.
    """
    if status not in ('DELIVERED', 'READ', 'FAILED'):
        return False

    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        ts = timestamp or datetime.datetime.now(datetime.timezone.utc)
        col = {
            'DELIVERED': 'delivered_at',
            'READ': 'read_at',
            'FAILED': 'failed_at'
        }[status]

        cur.execute(f"""
            UPDATE queue_notifications
            SET status = %s,
                {col} = %s
            WHERE whatsapp_message_id = %s
              AND status != 'READ';  -- Don't downgrade READ status
        """, (status, ts, whatsapp_message_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[AG-06] Delivery status update error: {e}")
        return False
    finally:
        cur.close()
        conn.close()


# ─── Internal Helpers ─────────────────────────────────────────────────────────

def _get_patient_language(patient_id: int) -> str:
    """Retrieve patient's language from existing conversations table."""
    try:
        from services.queue_service import get_patient_language
        return get_patient_language(patient_id)
    except Exception:
        return "ENGLISH"


def _ordinal(n: int) -> str:
    """Convert integer to ordinal string: 1 → '1st', 2 → '2nd', etc."""
    if 11 <= (n % 100) <= 13:
        suffix = 'th'
    else:
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')
    return f"{n}{suffix}"


# Type alias for list return
from typing import List
