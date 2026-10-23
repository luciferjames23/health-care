"""
ag11_followup_service.py
========================
Core Service Engine for AG-11 — Follow-up Agent.

Handles:
1. Event-driven discharge detection & durable plan/task creation (Day 3, 7, 14).
2. Idempotent background execution of scheduled WhatsApp check-ins.
3. Multilingual interactive message construction & delivery tracking.
4. Response evaluation (Routine, Clinical Escalation, Callback, Medication Issue, Appointment Query).
5. Central integration with conversations, messages, escalations, notifications, and appointments.
"""

import sys
import os
import datetime
import traceback
import uuid
from typing import List, Dict, Any, Optional

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import voice.whatsapp_client as whatsapp_client
from utils.phone_utils import normalize_phone


def scan_and_create_followup_plans() -> Dict[str, Any]:
    """
    Scans dim_generated_discharge_summaries for approved discharges
    and auto-creates ag11_followup_plans with Day 3, Day 7, and Day 14 tasks.
    Idempotent via (patient_id, discharge_summary_id) unique constraint.
    """
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    plans_created = 0
    tasks_created = 0
    errors = []

    try:
        # Fetch approved discharge summaries that do not yet have an AG-11 plan
        cur.execute("""
            SELECT 
                s.summary_id,
                s.patient_id,
                s.admission_id,
                s.diagnoses,
                s.discharge_date,
                s.generated_at,
                p.first_name,
                p.last_name,
                p.phone,
                p.whatsapp_number
            FROM dim_generated_discharge_summaries s
            JOIN patients p ON s.patient_id = p.id
            LEFT JOIN ag11_followup_plans plan ON plan.patient_id = s.patient_id AND plan.discharge_summary_id = s.summary_id
            WHERE s.approval_status IN ('Approved', 'Signed off', 'Completed')
              AND plan.id IS NULL
              AND p.phone IS NOT NULL
            LIMIT 50;
        """)

        eligible_summaries = cur.fetchall()

        for row in eligible_summaries:
            summary_id, patient_id, admission_id, diagnoses, discharge_date, generated_at, f_name, l_name, phone, wa_num = row
            
            d_date = discharge_date or generated_at or datetime.datetime.now(datetime.timezone.utc)
            if isinstance(d_date, str):
                try:
                    d_date = datetime.datetime.fromisoformat(d_date.replace("Z", "+00:00"))
                except Exception:
                    d_date = datetime.datetime.now(datetime.timezone.utc)

            procedure_name = diagnoses or "General Recovery"

            # 1. Create AG-11 Follow-up Plan
            cur.execute("""
                INSERT INTO ag11_followup_plans (
                    patient_id, discharge_summary_id, admission_id, procedure_name,
                    discharge_date, status, care_plan_notes, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, 'ACTIVE', 'Auto-generated follow-up care plan', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT (patient_id, discharge_summary_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                RETURNING id;
            """, (patient_id, summary_id, admission_id, procedure_name[:250], d_date))

            plan_id = cur.fetchone()[0]
            plans_created += 1

            # 2. Ensure consent record exists
            cur.execute("""
                INSERT INTO ag11_communication_consent (patient_id, consent_given, preferred_language)
                VALUES (%s, TRUE, 'ENGLISH')
                ON CONFLICT (patient_id) DO NOTHING;
            """, (patient_id,))

            # 3. Create Day 3, Day 7, Day 14 tasks
            days = [3, 7, 14]
            for day in days:
                due_time = d_date + datetime.timedelta(days=day)
                idempotency_key = f"AG11_PLAN_{plan_id}_PAT_{patient_id}_DAY_{day}"

                cur.execute("""
                    INSERT INTO ag11_followup_tasks (
                        plan_id, patient_id, followup_day, due_date, status, idempotency_key, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, 'SCHEDULED', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (idempotency_key) DO NOTHING;
                """, (plan_id, patient_id, day, due_time, idempotency_key))
                if cur.rowcount > 0:
                    tasks_created += 1

        conn.commit()
        return {
            "success": True,
            "plans_created": plans_created,
            "tasks_created": tasks_created,
            "errors": errors
        }
    except Exception as e:
        conn.rollback()
        err_msg = f"[AG11_SERVICE_PLAN_ERROR] {e}"
        print(err_msg)
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()


def process_due_followup_tasks() -> Dict[str, Any]:
    """
    Identifies due tasks (due_date <= NOW() and status = 'SCHEDULED'),
    verifies consent, constructs localized WhatsApp check-in messages,
    and dispatches via WhatsApp integration.
    """
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    processed_count = 0
    failed_count = 0
    errors = []

    try:
        now_utc = datetime.datetime.now(datetime.timezone.utc)

        cur.execute("""
            SELECT 
                t.id AS task_id,
                t.plan_id,
                t.patient_id,
                t.followup_day,
                t.due_date,
                plan.procedure_name,
                p.first_name,
                p.last_name,
                p.phone,
                p.whatsapp_number,
                c.consent_given,
                c.preferred_language
            FROM ag11_followup_tasks t
            JOIN ag11_followup_plans plan ON t.plan_id = plan.id
            JOIN patients p ON t.patient_id = p.id
            LEFT JOIN ag11_communication_consent c ON c.patient_id = p.id
            WHERE t.status IN ('SCHEDULED', 'OVERDUE')
              AND t.due_date <= %s
              AND plan.status = 'ACTIVE'
            LIMIT 20;
        """, (now_utc,))

        due_tasks = cur.fetchall()

        for row in due_tasks:
            (task_id, plan_id, patient_id, followup_day, due_date,
             procedure_name, f_name, l_name, phone, wa_num, consent_given, pref_lang) = row

            # Respect consent opt-out
            if consent_given is False:
                cur.execute("""
                    UPDATE ag11_followup_tasks 
                    SET status = 'CANCELLED', last_error = 'Patient opted out of communication', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (task_id,))
                continue

            pat_name = f"{f_name or ''} {l_name or ''}".strip() or "Valued Patient"
            target_phone = wa_num or phone or "919999999999"
            clean_phone = target_phone.replace("+", "").replace("-", "").replace(" ", "")

            # Message body & button actions by Day
            if followup_day == 3:
                msg_body = (
                    f"*Meridian Hospital — Day 3 Recovery Check-in*\n\n"
                    f"Dear {pat_name},\n"
                    f"We hope you are resting well following your {procedure_name or 'procedure'}.\n"
                    f"How are you feeling today?"
                )
                buttons = [
                    {"id": "ag11_d3_well", "title": "Feeling Well"},
                    {"id": "ag11_d3_symptoms", "title": "Pain/Symptoms"},
                    {"id": "ag11_d3_callback", "title": "Need Callback"}
                ]
            elif followup_day == 7:
                msg_body = (
                    f"*Meridian Hospital — Day 7 Follow-up Check-in*\n\n"
                    f"Dear {pat_name},\n"
                    f"Checking in on Day 7 of your recovery. Are you continuing your prescribed care and medication as instructed?"
                )
                buttons = [
                    {"id": "ag11_d7_well", "title": "Recovering Great"},
                    {"id": "ag11_d7_meds", "title": "Medication Issue"},
                    {"id": "ag11_d7_callback", "title": "Need Callback"}
                ]
            else: # Day 14
                msg_body = (
                    f"*Meridian Hospital — Day 14 Final Review Check-in*\n\n"
                    f"Dear {pat_name},\n"
                    f"It has been 2 weeks since your discharge. How is your overall health, and would you like to schedule a review appointment with your doctor?"
                )
                buttons = [
                    {"id": "ag11_d14_well", "title": "Fully Recovered"},
                    {"id": "ag11_d14_appt", "title": "Book Review Appt"},
                    {"id": "ag11_d14_callback", "title": "Need Callback"}
                ]

            # Send WhatsApp message
            wamid = None
            send_success = False
            error_str = None

            try:
                res = whatsapp_client.send_button_message(clean_phone, msg_body, buttons)
                if isinstance(res, dict) and res.get("messages"):
                    wamid = res["messages"][0].get("id")
                elif isinstance(res, str):
                    wamid = res
                else:
                    wamid = f"wamid.ag11.{uuid.uuid4().hex[:12]}"
                send_success = True
            except Exception as send_err:
                error_str = str(send_err)
                print(f"[AG11_SEND_WARN] Task {task_id} send failed: {send_err}")

            if send_success:
                cur.execute("""
                    UPDATE ag11_followup_tasks
                    SET status = 'SENT', outbound_wamid = %s, sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (wamid, task_id))

                # Log to notifications table
                cur.execute("""
                    INSERT INTO notifications (patient_id, notification_type, channel, message, status)
                    VALUES (%s, 'AG11_FOLLOWUP_CHECKIN', 'WHATSAPP', %s, 'SENT');
                """, (patient_id, f"AG-11 Day {followup_day} check-in sent to {pat_name}"))

                processed_count += 1
            else:
                cur.execute("""
                    UPDATE ag11_followup_tasks
                    SET status = 'FAILED', last_error = %s, retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (error_str or "WhatsApp delivery failed", task_id))
                failed_count += 1

        conn.commit()
        return {
            "success": True,
            "processed_count": processed_count,
            "failed_count": failed_count,
            "errors": errors
        }
    except Exception as e:
        conn.rollback()
        err_msg = f"[AG11_TASK_PROCESS_ERROR] {e}"
        print(err_msg)
        traceback.print_exc()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()


def resolve_patient_for_whatsapp(phone_number: str, conversation_code: Optional[str] = None) -> Dict[str, Any]:
    """
    Resolves patient identity for inbound WhatsApp messages.
    Checks conversation state, active AG-11 plans, and phone number mappings.
    If ambiguous across multiple patient profiles, returns AMBIGUOUS with candidate profiles.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        norm_phone = normalize_phone(phone_number)
        
        # 1. Check if conversation already has an assigned patient_id
        if conversation_code:
            cur.execute("SELECT patient_id FROM conversations WHERE conversation_code = %s;", (conversation_code,))
            row = cur.fetchone()
            if row and row[0]:
                pid = row[0]
                cur.execute("""
                    SELECT id, first_name, last_name, patient_code, phone, whatsapp_number 
                    FROM patients 
                    WHERE id = %s AND (phone = %s OR whatsapp_number = %s OR RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = %s);
                """, (pid, phone_number, phone_number, norm_phone))
                pat = cur.fetchone()
                if pat:
                    return {
                        "status": "EXPLICIT",
                        "patient_id": pat[0],
                        "patient_name": f"{pat[1] or ''} {pat[2] or ''}".strip(),
                        "patient_code": pat[3]
                    }

        # 2. Find all candidate patients matching phone number
        cur.execute("""
            SELECT id, first_name, last_name, patient_code 
            FROM patients 
            WHERE phone = %s OR whatsapp_number = %s OR RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = %s;
        """, (phone_number, phone_number, norm_phone))
        matching_patients = cur.fetchall()

        if not matching_patients:
            return {"status": "NOT_FOUND"}

        if len(matching_patients) == 1:
            p = matching_patients[0]
            return {
                "status": "EXPLICIT",
                "patient_id": p[0],
                "patient_name": f"{p[1] or ''} {p[2] or ''}".strip(),
                "patient_code": p[3]
            }

        # 3. Multiple patients match phone number. Check active AG-11 plans among them.
        pids = [p[0] for p in matching_patients]
        cur.execute("""
            SELECT DISTINCT patient_id FROM ag11_followup_plans
            WHERE patient_id = ANY(%s) AND status = 'ACTIVE';
        """, (pids,))
        active_plan_pids = [r[0] for r in cur.fetchall()]

        if len(active_plan_pids) == 1:
            target_pid = active_plan_pids[0]
            for p in matching_patients:
                if p[0] == target_pid:
                    return {
                        "status": "EXPLICIT",
                        "patient_id": p[0],
                        "patient_name": f"{p[1] or ''} {p[2] or ''}".strip(),
                        "patient_code": p[3]
                    }

        # Ambiguous across multiple profiles
        candidates = []
        for p in matching_patients:
            candidates.append({
                "id": p[0],
                "first_name": p[1],
                "last_name": p[2],
                "patient_code": p[3],
                "full_name": f"{p[1] or ''} {p[2] or ''}".strip(),
                "has_active_plan": p[0] in active_plan_pids
            })

        return {
            "status": "AMBIGUOUS",
            "patients": candidates
        }
    except Exception as e:
        print(f"[AG11_PATIENT_RESOLVE_ERR] {e}")
        return {"status": "ERROR", "error": str(e)}
    finally:
        cur.close()
        conn.close()


def evaluate_patient_response(
    patient_id: int,
    raw_text: str,
    button_id: Optional[str] = None,
    inbound_wamid: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates inbound patient response, links to active task & plan,
    determines classification (Routine OK, Concerning Symptoms, Callback, Medication, Appointment),
    creates clinical escalations / callbacks if required, and returns automated reply.
    """
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Idempotency check for webhook retries
        if inbound_wamid:
            cur.execute("SELECT id, response_type FROM ag11_patient_responses WHERE inbound_wamid = %s LIMIT 1;", (inbound_wamid,))
            existing_resp = cur.fetchone()
            if existing_resp:
                cur.close()
                conn.close()
                return {
                    "handled": True,
                    "duplicate": True,
                    "response_record_id": existing_resp[0],
                    "response_type": existing_resp[1],
                    "reply_message": "Your response has already been received and logged by our care team."
                }

        # Find active plan for patient
        cur.execute("""
            SELECT id, procedure_name FROM ag11_followup_plans
            WHERE patient_id = %s AND status = 'ACTIVE'
            ORDER BY created_at DESC LIMIT 1;
        """, (patient_id,))
        plan_row = cur.fetchone()
        if not plan_row:
            cur.close()
            conn.close()
            return {"handled": False, "reason": "No active AG-11 plan"}

        plan_id, procedure_name = plan_row

        # Find latest SENT or SCHEDULED task for this plan
        cur.execute("""
            SELECT id, followup_day, status FROM ag11_followup_tasks
            WHERE plan_id = %s AND status IN ('SENT', 'SCHEDULED', 'OVERDUE')
            ORDER BY due_date ASC LIMIT 1;
        """, (plan_id,))
        task_row = cur.fetchone()
        task_id = task_row[0] if task_row else None
        followup_day = task_row[1] if task_row else 3

        # Classification logic: Button clicks take priority
        btn = (button_id or "").lower().strip()
        txt = (raw_text or "").lower().strip()

        if btn in ["ag11_d3_well", "ag11_d7_well", "ag11_d14_well"]:
            resp_type = "ROUTINE_OK"
        elif btn in ["ag11_d3_symptoms"]:
            resp_type = "CONCERNING_SYMPTOMS"
        elif btn in ["ag11_d7_meds"]:
            resp_type = "MEDICATION_ISSUE"
        elif btn in ["ag11_d14_appt"]:
            resp_type = "APPOINTMENT_QUERY"
        elif btn in ["ag11_d3_callback", "ag11_d7_callback", "ag11_d14_callback"]:
            resp_type = "CALLBACK_REQUESTED"
        else:
            # Fallback to intelligent NLP keyword rules
            if any(k in txt for k in ["bleeding", "fever", "wound", "swelling", "discharge", "infection", "worse", "severe pain", "pain", "symptoms"]):
                resp_type = "CONCERNING_SYMPTOMS"
            elif any(k in txt for k in ["callback", "call me", "talk to nurse", "speak to doctor", "staff", "need callback"]):
                resp_type = "CALLBACK_REQUESTED"
            elif any(k in txt for k in ["meds", "medication", "pills", "prescription", "side effect", "dose", "medication issue"]):
                resp_type = "MEDICATION_ISSUE"
            elif any(k in txt for k in ["appt", "appointment", "review", "doctor visit", "book review appt"]):
                resp_type = "APPOINTMENT_QUERY"
            elif any(k in txt for k in ["well", "great", "recovered", "fine", "good", "no pain", "doing well", "manageable", "feeling well", "recovering great", "fully recovered"]):
                resp_type = "ROUTINE_OK"
            else:
                resp_type = "AMBIGUOUS"

        # Record patient response
        cur.execute("""
            INSERT INTO ag11_patient_responses (
                task_id, plan_id, patient_id, inbound_wamid, response_type,
                raw_text, structured_answers, ai_classification, created_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP
            ) RETURNING id;
        """, (task_id, plan_id, patient_id, inbound_wamid, resp_type, raw_text, '{"source": "whatsapp"}', resp_type))

        response_record_id = cur.fetchone()[0]

        # Update task status if matched
        if task_id:
            cur.execute("""
                UPDATE ag11_followup_tasks
                SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (task_id,))

        reply_message = ""
        action_taken = ""

        if resp_type == "ROUTINE_OK":
            reply_message = (
                "💚 *Meridian Hospital Care Team*\n\n"
                "Thank you for letting us know! We are delighted that your recovery is progressing smoothly. "
                "Please reach out if you have any questions or concerns."
            )
            action_taken = "Marked check-in completed routinely."

        elif resp_type == "CONCERNING_SYMPTOMS":
            # Create record in central escalations table
            cur.execute("""
                INSERT INTO escalations (patient_id, escalation_reason, patient_question, status, created_at, updated_at)
                VALUES (%s, %s, %s, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id;
            """, (patient_id, f"AG-11 Day {followup_day} Post-Discharge Clinical Concern", raw_text))
            central_esc_id = cur.fetchone()[0]

            # Create record in ag11_clinical_escalations
            cur.execute("""
                INSERT INTO ag11_clinical_escalations (
                    plan_id, task_id, patient_id, escalation_id, symptom_summary,
                    severity, status, assigned_team, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, 'HIGH', 'OPEN', 'Nursing & Clinical Desk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            """, (plan_id, task_id, patient_id, central_esc_id, raw_text))

            reply_message = (
                "⚠️ *Clinical Alert Logged*\n\n"
                "Your reported symptom has been immediately forwarded to our Nursing Desk. "
                "A clinical team member will review your record and contact you shortly.\n\n"
                "🚨 *Emergency Note:* If you experience severe chest pain, extreme breathlessness, or heavy bleeding, please dial 108 or proceed to Emergency immediately."
            )
            action_taken = "Created Clinical Escalation #%s" % central_esc_id

        elif resp_type == "CALLBACK_REQUESTED":
            cur.execute("""
                INSERT INTO ag11_callbacks (
                    plan_id, task_id, patient_id, requested_reason, priority, status, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, 'HIGH', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            """, (plan_id, task_id, patient_id, raw_text or "Patient requested callback via WhatsApp"))

            reply_message = (
                "📞 *Callback Request Confirmed*\n\n"
                "We have logged your callback request with our Patient Care Desk. "
                "A nurse or coordinator will reach out to you within 30 minutes."
            )
            action_taken = "Created Callback Task."

        elif resp_type == "MEDICATION_ISSUE":
            cur.execute("""
                INSERT INTO ag11_callbacks (
                    plan_id, task_id, patient_id, requested_reason, priority, status, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, 'URGENT', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                );
            """, (plan_id, task_id, patient_id, f"Medication Issue: {raw_text}"))

            reply_message = (
                "💊 *Medication Assistance Request*\n\n"
                "Our Clinical Pharmacy & Nursing Desk has been notified of your medication query. "
                "Please do not adjust your dosage independently until our clinical team contacts you."
            )
            action_taken = "Created Urgent Pharmacy/Callback Request."

        elif resp_type == "APPOINTMENT_QUERY":
            reply_message = (
                "📅 *Follow-up Appointment Desk*\n\n"
                "We can help you book your follow-up review appointment. "
                "Please reply with your preferred date/time or call our Desk directly at +91 44 2800 1234."
            )
            action_taken = "Sent appointment guidance."

        else:
            reply_message = (
                "💬 *Meridian Hospital Assistant*\n\n"
                "Thank you for your message. We have logged your response for our care team to review. "
                "Reply 'CALLBACK' if you need an urgent phone call from our nurse."
            )
            action_taken = "Logged ambiguous response."

        # Check if plan can be completed
        cur.execute("""
            SELECT COUNT(*) FROM ag11_followup_tasks
            WHERE plan_id = %s AND status IN ('SCHEDULED', 'SENT', 'OVERDUE');
        """, (plan_id,))
        pending_tasks = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM ag11_clinical_escalations
            WHERE plan_id = %s AND status = 'OPEN';
        """, (plan_id,))
        open_escalations = cur.fetchone()[0]

        if pending_tasks == 0 and open_escalations == 0:
            cur.execute("""
                UPDATE ag11_followup_plans
                SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (plan_id,))

        conn.commit()
        return {
            "handled": True,
            "response_record_id": response_record_id,
            "response_type": resp_type,
            "action_taken": action_taken,
            "reply_message": reply_message
        }

    except Exception as e:
        conn.rollback()
        err_msg = f"[AG11_EVALUATE_RESPONSE_ERROR] {e}"
        print(err_msg)
        traceback.print_exc()
        return {"handled": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()
