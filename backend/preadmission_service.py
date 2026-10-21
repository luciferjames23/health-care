"""
preadmission_service.py
========================
Pre-Admission & Admission Management Service for Hospital.

Responsibilities:
  - Admission registration & validation (patient, doctor, department, appointment, date)
  - Duplicate active admission prevention
  - Transactional DB insertion & WhatsApp notification dispatch
  - Scoped pre-admission listing & follow-up status updates for Admin & Doctor portals
  - Patient WhatsApp conversation retrieval for pre-admission follow-ups
"""

import datetime
from typing import Optional, Dict, Any, List
import db_config
from utils.phone_utils import normalize_phone, parse_and_normalize_phone, to_meta_digits, to_canonical_e164


class PreAdmissionValidationError(Exception):
    pass


CANONICAL_ADMISSION_TYPES: List[str] = [
    "Direct Admission",
    "Elective",
    "Emergency",
    "Urgent",
    "Routine",
    "Day Care",
    "Maternity / Obstetric",
    "Medical",
    "Newborn / Neonatal",
    "Observation",
    "Psychiatric",
    "Readmission",
    "Rehabilitation",
    "Surgical",
    "Transfer In",
    "Inpatient",
]

# Normalization mapping: maps lowercased canonical names and unambiguous legacy aliases to canonical form.
ADMISSION_TYPE_MAP: Dict[str, str] = {
    # Exact canonical (lowercase keys)
    "direct admission": "Direct Admission",
    "elective": "Elective",
    "emergency": "Emergency",
    "urgent": "Urgent",
    "routine": "Routine",
    "day care": "Day Care",
    "maternity / obstetric": "Maternity / Obstetric",
    "maternity/obstetric": "Maternity / Obstetric",
    "maternity": "Maternity / Obstetric",
    "medical": "Medical",
    "newborn / neonatal": "Newborn / Neonatal",
    "newborn/neonatal": "Newborn / Neonatal",
    "neonatal": "Newborn / Neonatal",
    "newborn": "Newborn / Neonatal",
    "observation": "Observation",
    "psychiatric": "Psychiatric",
    "readmission": "Readmission",
    "rehabilitation": "Rehabilitation",
    "surgical": "Surgical",
    "transfer in": "Transfer In",
    "inpatient": "Inpatient",

    # Unambiguous legacy values
    "daycare": "Day Care",
    "surgery": "Surgical",
}


def normalize_admission_type(admission_type: Optional[str]) -> str:
    """
    Validates and normalizes admission_type against canonical hospital admission types.
    Preserves exact canonical names (e.g. 'Direct Admission', 'Day Care', 'Surgical').
    Maps unambiguous legacy values (e.g. 'DAYCARE' -> 'Day Care', 'SURGERY' -> 'Surgical', 'INPATIENT' -> 'Inpatient').
    Does NOT silently map 'Direct Admission' to 'Inpatient'.
    Raises PreAdmissionValidationError for unsupported values.
    """
    if not admission_type or not str(admission_type).strip():
        raise PreAdmissionValidationError("admission_type is required.")

    raw = str(admission_type).strip()
    key = raw.lower()

    normalized = ADMISSION_TYPE_MAP.get(key)
    if not normalized:
        raise PreAdmissionValidationError(
            f"Invalid admission_type '{raw}'. Allowed: {sorted(CANONICAL_ADMISSION_TYPES)}"
        )
    return normalized


def generate_pre_admission_code(cur) -> str:
    """Generates a unique pre_admission_code (e.g., PAD0001)."""
    cur.execute("SELECT COUNT(*) FROM pre_admissions;")
    count = cur.fetchone()[0]
    return f"PAD{(count + 1):04d}"


def create_pre_admission(
    patient_id: int,
    doctor_id: int,
    department_id: int,
    expected_admission_date: str,
    admission_type: str,
    appointment_id: Optional[int] = None,
    expected_checkin_time: Optional[str] = None,
    instructions: Optional[str] = None,
    remarks: Optional[str] = None,
    pending_documents: Optional[str] = None,
    created_by_user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Registers a new pre-admission for an existing patient.
    Validates patient, doctor, department, doctor-department match, appointment ownership, and active record duplicates.
    Commits DB transaction first before creating & sending WhatsApp notification.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()

    try:
        # 1. Validate Patient
        cur.execute("""
            SELECT id, patient_code, first_name, last_name, phone, whatsapp_number, gender, date_of_birth, status
            FROM patients WHERE id = %s AND status = 'ACTIVE';
        """, (patient_id,))
        pat_row = cur.fetchone()
        if not pat_row:
            raise PreAdmissionValidationError(f"Patient ID {patient_id} not found or inactive.")
        
        pat_name = f"{pat_row[2]} {pat_row[3] or ''}".strip()
        pat_phone = pat_row[5] or pat_row[4]

        # 2. Validate Doctor
        cur.execute("""
            SELECT id, display_name, department_id, status FROM doctors WHERE id = %s;
        """, (doctor_id,))
        doc_row = cur.fetchone()
        if not doc_row:
            raise PreAdmissionValidationError(f"Doctor ID {doctor_id} not found.")
        doc_name = doc_row[1]
        doc_dept_id = doc_row[2]

        # 3. Validate Department
        cur.execute("SELECT id, department_name FROM departments WHERE id = %s;", (department_id,))
        dept_row = cur.fetchone()
        if not dept_row:
            raise PreAdmissionValidationError(f"Department ID {department_id} not found.")
        dept_name = dept_row[1]

        # 4. Validate Doctor-Department Match
        if doc_dept_id != department_id:
            raise PreAdmissionValidationError(f"Doctor '{doc_name}' does not belong to selected department '{dept_name}'.")

        # 5. Validate Appointment Ownership if appointment_id provided
        if appointment_id:
            cur.execute("SELECT id, patient_id FROM appointments WHERE id = %s;", (appointment_id,))
            appt_row = cur.fetchone()
            if not appt_row:
                raise PreAdmissionValidationError(f"Appointment ID {appointment_id} not found.")
            if appt_row[1] != patient_id:
                raise PreAdmissionValidationError(f"Appointment ID {appointment_id} does not belong to Patient ID {patient_id}.")

        # 6. Validate Admission Date
        try:
            date_obj = datetime.datetime.strptime(expected_admission_date.strip(), "%Y-%m-%d").date()
        except ValueError:
            raise PreAdmissionValidationError("Invalid expected_admission_date format. Expected YYYY-MM-DD.")

        # 7. Validate & Normalize Admission Type
        adm_type_clean = normalize_admission_type(admission_type)

        # 8. Handle existing active pre-admission records for patient
        cur.execute("""
            SELECT id, pre_admission_code, admission_id FROM pre_admissions
            WHERE patient_id = %s AND status NOT IN ('COMPLETED', 'CANCELLED');
        """, (patient_id,))
        dup_rows = cur.fetchall()
        if dup_rows:
            for dup in dup_rows:
                cur.execute("""
                    UPDATE pre_admissions
                    SET status = 'CANCELLED', remarks = 'Superseded by new pre-admission registration', updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (dup[0],))
                linked_aid = dup[2]
                if linked_aid:
                    cur.execute("""
                        UPDATE admissions
                        SET discharge_status = 'Discharged', discharge_date = CURRENT_DATE
                        WHERE admission_id = %s;
                    """, (linked_aid,))
                    cur.execute("""
                        UPDATE dim_admission_inputs
                        SET discharge_status = 'Discharged'
                        WHERE admission_id = %s;
                    """, (linked_aid,))
                    cur.execute("""
                        UPDATE beds
                        SET status = 'Available'
                        WHERE bed_id IN (SELECT bed_id FROM admissions WHERE admission_id = %s AND bed_id IS NOT NULL);
                    """, (linked_aid,))
            print(f"[PRE_ADMISSION] Superseded {len(dup_rows)} active pre-admission record(s) for patient ID {patient_id}")

        # 9. Format check-in time
        time_obj = None
        if expected_checkin_time and expected_checkin_time.strip():
            try:
                t_str = expected_checkin_time.strip()
                if len(t_str) == 5:
                    t_str += ":00"
                time_obj = datetime.datetime.strptime(t_str, "%H:%M:%S").time()
            except ValueError:
                pass

        # 10. Generate Code & Insert Record
        pad_code = generate_pre_admission_code(cur)
        status_initial = "PENDING"
        docs_pending = pending_documents or "Government ID, Insurance Card, Referral Note"

        cur.execute("""
            INSERT INTO pre_admissions (
                pre_admission_code, patient_id, appointment_id, doctor_id, department_id,
                expected_admission_date, expected_checkin_time, admission_type, status,
                pending_documents, instructions, remarks, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id;
        """, (
            pad_code, patient_id, appointment_id, doctor_id, department_id,
            date_obj, time_obj, adm_type_clean, status_initial,
            docs_pending, instructions, remarks
        ))
        pre_adm_id = cur.fetchone()[0]

        # 11. COMMIT DB TRANSACTION BEFORE NOTIFICATION DISPATCH
        conn.commit()
        print(f"[PRE_ADMISSION] Successfully registered pre-admission ID {pre_adm_id} ({pad_code}) for patient ID {patient_id}")

    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        if isinstance(e, PreAdmissionValidationError):
            raise e
        print(f"[PRE_ADMISSION] Error registering pre-admission: {e}")
        raise PreAdmissionValidationError(f"Database error during admission registration: {str(e)}")

    finally:
        if not conn.closed:
            cur.close()
            conn.close()

    # 12. DISPATCH WHATSAPP NOTIFICATION AFTER DB COMMIT
    notification_result = dispatch_pre_admission_notification(pre_adm_id)

    return {
        "success": True,
        "pre_admission_id": pre_adm_id,
        "pre_admission_code": pad_code,
        "patient_name": pat_name,
        "doctor_name": doc_name,
        "department_name": dept_name,
        "expected_admission_date": str(date_obj),
        "admission_type": adm_type_clean,
        "status": status_initial,
        # Propagate all notification fields so the UI can show accurate provider-backed status
        "notification_status": notification_result.get("status"),
        "notification_message_id": notification_result.get("message_id"),
        "notification_error": notification_result.get("error"),
        "whatsapp_number": notification_result.get("whatsapp_number"),
        "notification_detail": notification_result.get("detail"),
    }


def dispatch_pre_admission_notification(pre_admission_id: int) -> Dict[str, Any]:
    """
    Creates notification record & sends outbound WhatsApp message for a pre-admission.
    Uses patient's preferred language from recent conversation if available.
    Sends fine-tuned message with interactive quick response buttons.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT pa.id, pa.pre_admission_code, pa.expected_admission_date, pa.admission_type, pa.instructions,
                   pa.expected_checkin_time, pa.pending_documents,
                   p.id as patient_id, p.first_name, p.last_name, p.phone, p.whatsapp_number,
                   d.display_name as doctor_name, dept.department_name
            FROM pre_admissions pa
            JOIN patients p ON pa.patient_id = p.id
            JOIN doctors d ON pa.doctor_id = d.id
            JOIN departments dept ON pa.department_id = dept.id
            WHERE pa.id = %s;
        """, (pre_admission_id,))
        row = cur.fetchone()
        if not row:
            return {"success": False, "error": "Pre-admission record not found"}

        (pa_id, pa_code, adm_date, adm_type, instructions,
         checkin_time, pending_docs,
         pat_id, f_name, l_name, phone, wa_phone,
         doc_name, dept_name) = row

        target_wa = wa_phone or phone
        if not target_wa or not str(target_wa).strip():
            return {"success": False, "error": "Patient does not have a registered phone or WhatsApp number"}

        can_e164, meta_digits, is_valid_phone = parse_and_normalize_phone(target_wa)
        if not is_valid_phone or not meta_digits:
            val_error = f"Malformed phone number '{target_wa}'"
            print(f"[PRE_ADMISSION_NOTIF] Validation error: {val_error}")
            cur.execute("""
                INSERT INTO notifications (
                    patient_id, notification_type, channel, message, status, reason, created_at, failed_at
                ) VALUES (%s, 'ADMISSION_REMINDER', 'WHATSAPP', %s, 'FAILED', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id;
            """, (pat_id, f"Admission clearance for {pa_code}", val_error))
            notif_id = cur.fetchone()[0]

            remark_text = f"WhatsApp clearance FAILED: {val_error}"
            cur.execute("""
                UPDATE pre_admissions
                SET remarks = CASE WHEN remarks IS NULL OR remarks = '' THEN %s ELSE remarks || '; ' || %s END
                WHERE id = %s;
            """, (remark_text, remark_text, pre_admission_id))
            conn.commit()
            return {
                "success": False,
                "notification_id": notif_id,
                "status": "FAILED",
                "error": val_error,
                "whatsapp_number": target_wa
            }

        pat_full_name = f"{f_name} {l_name or ''}".strip()

        # Check patient's conversation preferred language
        cur.execute("SELECT language FROM conversations WHERE patient_id = %s ORDER BY id DESC LIMIT 1;", (pat_id,))
        lang_row = cur.fetchone()
        lang = lang_row[0] if lang_row else "ENGLISH"

        # Format Fine-tuned Professional WhatsApp Message
        formatted_date = adm_date.strftime("%d %B %Y (%A)") if hasattr(adm_date, "strftime") else str(adm_date)
        adm_type_disp = adm_type.replace("_", " ").title()
        checkin_disp = str(checkin_time)[:5] if checkin_time else "09:00 AM"

        doc_disp = doc_name if (doc_name and doc_name.startswith("Dr.")) else f"Dr. {doc_name}"

        msg = (
            f"🏥 *HOSPITAL — PRE-ADMISSION CLEARANCE* 🏥\n\n"
            f"Dear *{f_name}*,\n\n"
            f"Your pre-admission registration has been processed successfully. Please review your admission details:\n\n"
            f"📋 *Admission Summary:*\n"
            f"• *Pre-Admission Code:* `{pa_code}`\n"
            f"• *Expected Admission Date:* {formatted_date}\n"
            f"• *Reporting Time:* {checkin_disp}\n"
            f"• *Department:* {dept_name}\n"
            f"• *Attending Doctor:* {doc_disp}\n"
            f"• *Admission Type:* {adm_type_disp}\n\n"
            f"📄 *Required Documents to Bring:*\n"
            f"• {pending_docs or 'Government Photo ID, Health Insurance Card, Referral Notes'}\n\n"
            f"📝 *Instructions:*\n"
            f"• {instructions or 'Please report to the Ground Floor Admission Desk at your scheduled check-in time.'}\n\n"
            f"Please tap a button below or reply *YES* to confirm your admission or *NO* to cancel."
        )

        # 1. Create Notification Record in DB (Status: PENDING)
        cur.execute("""
            INSERT INTO notifications (
                patient_id, notification_type, channel, message, status, created_at
            ) VALUES (%s, 'ADMISSION_REMINDER', 'WHATSAPP', %s, 'PENDING', CURRENT_TIMESTAMP)
            RETURNING id;
        """, (pat_id, msg))
        notif_id = cur.fetchone()[0]

        # 2. Ensure active conversation & log message for patient chat history
        cur.execute("""
            SELECT id, conversation_code FROM conversations
            WHERE patient_id = %s OR whatsapp_number = %s OR whatsapp_number = %s OR whatsapp_number = %s
            ORDER BY id DESC LIMIT 1;
        """, (pat_id, target_wa, can_e164, meta_digits))
        conv_row = cur.fetchone()
        if not conv_row:
            import uuid
            conv_code = f"CONV_WA_{uuid.uuid4().hex[:8].upper()}"
            cur.execute("""
                INSERT INTO conversations (
                    conversation_code, patient_id, whatsapp_number, channel, language, current_intent, conversation_status, created_at, updated_at
                ) VALUES (%s, %s, %s, 'WHATSAPP', %s, 'PRE_ADMISSION_CLEARANCE', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id, conversation_code;
            """, (conv_code, pat_id, can_e164 or target_wa, lang))
            conv_row = cur.fetchone()

        conv_id = conv_row[0]
        conv_code = conv_row[1]

        import json
        notif_meta = {
            "pre_admission_id": pre_admission_id,
            "pre_admission_code": pa_code,
            "notification_id": notif_id,
            "channel": "WHATSAPP"
        }
        cur.execute("""
            INSERT INTO messages (
                conversation_id, sender_type, message_type, message_text, language, intent, metadata, created_at
            ) VALUES (%s, 'AI_AGENT', 'TEXT', %s, %s, 'PRE_ADMISSION_CLEARANCE', %s::jsonb, CURRENT_TIMESTAMP)
            RETURNING id;
        """, (conv_id, msg, lang, json.dumps(notif_meta)))
        msg_db_id = cur.fetchone()[0]
        conn.commit()

        # 3. Dispatch via voice.whatsapp_client service using provider digits format
        send_success = False
        ext_msg_id = None
        dispatch_error = None
        try:
            import voice.whatsapp_client as whatsapp_client
            buttons = [
                {"id": "btn_confirm_admission", "title": "Confirm Admission"},
                {"id": "btn_cancel_admission", "title": "Cancel Admission"},
                {"id": "btn_admission_help", "title": "Need Assistance"}
            ]
            res = whatsapp_client.send_button_message(meta_digits, msg, buttons)
            if isinstance(res, dict) and res.get("success"):
                send_success = True
                ext_msg_id = res.get("message_id")
            elif res is True:
                send_success = True
            else:
                dispatch_error = res.get("error") if isinstance(res, dict) else "WhatsApp button send failed"
                # Fallback to plain text message if button message fails
                res_text = whatsapp_client.send_text_message(meta_digits, msg)
                if isinstance(res_text, dict) and res_text.get("success"):
                    send_success = True
                    ext_msg_id = res_text.get("message_id")
                    dispatch_error = None
                elif isinstance(res_text, dict) and res_text.get("error"):
                    dispatch_error = res_text.get("error")
                elif res_text is True:
                    send_success = True
                    dispatch_error = None
        except Exception as ws_err:
            print(f"[PRE_ADMISSION_NOTIF] Outbound WhatsApp dispatch failed: {ws_err}")
            send_success = False
            dispatch_error = str(ws_err)

        # 4. Update Notification Status
        if send_success:
            # Accepted by provider: set status to SUBMITTED; delivery pending webhook confirmation
            cur.execute("""
                UPDATE notifications
                SET status = 'SUBMITTED', external_message_id = %s, sent_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (ext_msg_id, notif_id))

            # Attach provider message ID to message record for webhook mapping
            cur.execute("""
                UPDATE messages
                SET metadata = jsonb_set(
                    COALESCE(metadata::jsonb, '{}'::jsonb),
                    '{whatsapp_message_id}',
                    to_jsonb(%s::text)
                )
                WHERE id = %s;
            """, (ext_msg_id, msg_db_id))

            remark_text = f"WhatsApp notification submitted (ID: {ext_msg_id}); delivery pending confirmation"
            cur.execute("""
                UPDATE pre_admissions
                SET remarks = CASE WHEN remarks IS NULL OR remarks = '' THEN %s ELSE remarks || '; ' || %s END
                WHERE id = %s;
            """, (remark_text, remark_text, pre_admission_id))
            print(f"[PRE_ADMISSION_NOTIF] Notification ID {notif_id} submitted to Meta Cloud API (ID: {ext_msg_id}) for {meta_digits}")
        else:
            reason_msg = dispatch_error or "WhatsApp API delivery failed"
            cur.execute("""
                UPDATE notifications
                SET status = 'FAILED', reason = %s, failed_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (reason_msg[:500], notif_id))

            remark_text = f"WhatsApp clearance FAILED: {reason_msg[:200]}"
            cur.execute("""
                UPDATE pre_admissions
                SET remarks = CASE WHEN remarks IS NULL OR remarks = '' THEN %s ELSE remarks || '; ' || %s END
                WHERE id = %s;
            """, (remark_text, remark_text, pre_admission_id))
            print(f"[PRE_ADMISSION_NOTIF] Notification ID {notif_id} failed to dispatch to {meta_digits}: {reason_msg}")

        conn.commit()
        return {
            "success": send_success,
            "notification_id": notif_id,
            "status": "SUBMITTED" if send_success else "FAILED",
            "message_id": ext_msg_id,
            "error": dispatch_error if not send_success else None,
            "whatsapp_number": can_e164 or target_wa,
            "detail": "WhatsApp notification submitted; delivery pending confirmation." if send_success else f"WhatsApp notification failed: {dispatch_error}"
        }

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Failed to dispatch pre-admission notification: {e}")
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()


def get_pre_admissions(
    doctor_id_filter: Optional[int] = None,
    patient_id: Optional[int] = None,
    status: Optional[str] = None,
    admission_type: Optional[str] = None,
    admission_date: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Returns list of pre-admission records with filters.
    If doctor_id_filter is provided (for Doctor role), restricts to ONLY that doctor's patients.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT pa.id, pa.pre_admission_code, pa.patient_id,
                   p.patient_code, p.first_name as pat_first, p.last_name as pat_last, p.phone as pat_phone, p.whatsapp_number,
                   pa.doctor_id, d.display_name as doctor_name,
                   pa.department_id, dept.department_name,
                   pa.appointment_id, appt.booking_id,
                   pa.expected_admission_date, TO_CHAR(pa.expected_checkin_time, 'HH24:MI') as expected_checkin_time,
                   pa.admission_type, pa.status, pa.pending_documents, pa.submitted_documents,
                   pa.instructions, pa.remarks, pa.created_at, pa.updated_at,
                   (SELECT n.status FROM notifications n WHERE n.patient_id = pa.patient_id AND n.notification_type = 'ADMISSION_REMINDER' ORDER BY n.id DESC LIMIT 1) as last_notif_status,
                   pa.admission_id, a.admission_number, a.discharge_status as admission_status,
                   a.ward_id, w.ward_name,
                   b.room_id, r.room_number,
                   a.bed_id, b.bed_number, b.status as bed_status
            FROM pre_admissions pa
            LEFT JOIN patients p ON pa.patient_id = p.id
            LEFT JOIN doctors d ON pa.doctor_id = d.id
            LEFT JOIN departments dept ON pa.department_id = dept.id
            LEFT JOIN appointments appt ON pa.appointment_id = appt.id
            LEFT JOIN admissions a ON pa.admission_id = a.admission_id
            LEFT JOIN beds b ON a.bed_id = b.bed_id
            LEFT JOIN rooms r ON b.room_id = r.room_id
            LEFT JOIN wards w ON (a.ward_id = w.ward_id OR b.ward_id = w.ward_id)
        """
        conditions = []
        params = []

        if doctor_id_filter:
            conditions.append("pa.doctor_id = %s")
            params.append(doctor_id_filter)

        if patient_id:
            conditions.append("pa.patient_id = %s")
            params.append(patient_id)

        if status:
            conditions.append("pa.status = %s")
            params.append(status.upper())

        if admission_type:
            conditions.append("LOWER(pa.admission_type) = LOWER(%s)")
            params.append(admission_type.strip())

        if admission_date:
            conditions.append("pa.expected_admission_date = %s")
            params.append(admission_date)

        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            conditions.append("""(
                LOWER(pa.pre_admission_code) LIKE %s OR
                LOWER(COALESCE(p.patient_code, '')) LIKE %s OR
                LOWER(COALESCE(p.first_name, '')) LIKE %s OR
                LOWER(COALESCE(p.last_name, '')) LIKE %s OR
                LOWER(COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), '')) LIKE %s OR
                LOWER(COALESCE(p.phone, '')) LIKE %s OR
                LOWER(COALESCE(p.whatsapp_number, '')) LIKE %s OR
                LOWER(COALESCE(d.display_name, '')) LIKE %s OR
                LOWER(COALESCE(a.admission_number, '')) LIKE %s OR
                LOWER(COALESCE(b.bed_number, '')) LIKE %s
            )""")
            params.extend([s, s, s, s, s, s, s, s, s, s])

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY pa.expected_admission_date DESC, pa.id DESC;"

        cur.execute(query, params)
        rows = cur.fetchall()
        result = []
        for r in rows:
            result.append({
                "id": r[0],
                "pre_admission_code": r[1],
                "patient_id": r[2],
                "patient_code": r[3],
                "patient_name": f"{r[4]} {r[5] or ''}".strip(),
                "patient_phone": r[7] or r[6],
                "doctor_id": r[8],
                "doctor_name": r[9],
                "department_id": r[10],
                "department_name": r[11],
                "appointment_id": r[12],
                "booking_id": r[13],
                "expected_admission_date": str(r[14]),
                "expected_checkin_time": r[15],
                "admission_type": r[16],
                "status": r[17],
                "pending_documents": r[18],
                "submitted_documents": r[19],
                "instructions": r[20],
                "remarks": r[21],
                "created_at": str(r[22]) if r[22] else None,
                "updated_at": str(r[23]) if r[23] else None,
                "notification_status": r[24] or "NOT_SENT",
                "admission_id": r[25],
                "admission_number": r[26],
                "admission_status": r[27],
                "ward_id": r[28],
                "ward_name": r[29],
                "room_id": r[30],
                "room_number": r[31],
                "bed_id": r[32],
                "bed_number": r[33],
                "bed_status": r[34] or ("Occupied" if r[32] else "Pending Allocation")
            })
        return result
    except Exception as e:
        print(f"[ERROR] Failed to query pre-admissions: {e}")
        return []
    finally:
        cur.close()
        conn.close()


def confirm_or_link_admission(pre_admission_id: int, cur=None, conn=None) -> Dict[str, Any]:
    """
    Authoritatively creates or links an inpatient admission for a confirmed pre-admission.
    Ensures:
      - Idempotency: reuses existing active admission if already linked or active for patient.
      - Patient identity preserved: references existing patient_id.
      - Doctor & Department mapped: uses pre_admission doctor_id and department_id.
      - Valid patient_visits record linked to admissions.visit_id for clinical/SOAP continuity.
      - dim_admission_inputs synchronized so patient appears in Admissions and Clinical workspaces.
      - Dual foreign key linkage: pre_admissions.admission_id <-> admissions.pre_admission_id.
    """
    should_close = False
    if conn is None:
        conn = db_config.get_db_connection()
        cur = conn.cursor()
        should_close = True

    try:
        # Lock pre-admission record
        cur.execute("""
            SELECT id, pre_admission_code, patient_id, doctor_id, department_id,
                   admission_type, expected_admission_date, instructions, remarks, admission_id, status
            FROM pre_admissions
            WHERE id = %s
            FOR UPDATE;
        """, (pre_admission_id,))
        pa_row = cur.fetchone()
        if not pa_row:
            raise PreAdmissionValidationError(f"Pre-admission ID {pre_admission_id} not found.")

        (pa_id, pa_code, pat_id, doc_id, dept_id,
         adm_type, exp_date, instructions, remarks, existing_adm_id, cur_status) = pa_row

        try:
            clean_adm_type = normalize_admission_type(adm_type) if adm_type else "Elective"
        except PreAdmissionValidationError:
            clean_adm_type = str(adm_type or "Elective").strip()
        clinical_reason = instructions or remarks or f"Scheduled {clean_adm_type} Admission"

        # 1. Check if pre_admissions already has a valid active admission linked
        if existing_adm_id:
            cur.execute("""
                SELECT admission_id, admission_number, patient_id, discharge_status, ward_id, bed_id
                FROM admissions
                WHERE admission_id = %s;
            """, (existing_adm_id,))
            linked_adm = cur.fetchone()
            if linked_adm:
                adm_id, adm_num, adm_pid, disc_st, w_id, b_id = linked_adm
                if str(disc_st or "").strip().lower() != "discharged":
                    # Synchronize doctor, department, admission_type, and clinical reason
                    cur.execute("""
                        UPDATE admissions
                        SET doctor_id = %s,
                            department_id = %s,
                            admission_type = COALESCE(NULLIF(%s, ''), admission_type),
                            reason_for_admission = COALESCE(NULLIF(%s, ''), reason_for_admission),
                            pre_admission_id = %s
                        WHERE admission_id = %s;
                    """, (doc_id, dept_id, clean_adm_type, clinical_reason, pa_id, adm_id))

                    # Ensure active patient_visits record is linked
                    cur.execute("SELECT visit_id FROM admissions WHERE admission_id = %s;", (adm_id,))
                    v_check = cur.fetchone()
                    if not v_check or not v_check[0]:
                        cur.execute("""
                            SELECT visit_id FROM patient_visits
                            WHERE patient_id = %s AND doctor_id = %s AND (visit_status IS NULL OR visit_status IN ('In Progress', 'Active'))
                            ORDER BY visit_id DESC LIMIT 1;
                        """, (pat_id, doc_id))
                        v_row = cur.fetchone()
                        if v_row:
                            visit_id = v_row[0]
                        else:
                            cur.execute("SELECT COALESCE(MAX(visit_id), 0) + 1 FROM patient_visits;")
                            visit_id = cur.fetchone()[0]
                            cur.execute("""
                                INSERT INTO patient_visits (
                                    visit_id, patient_id, doctor_id, department_id,
                                    visit_date, visit_type, chief_complaint, visit_status
                                ) VALUES (
                                    %s, %s, %s, %s,
                                    CURRENT_TIMESTAMP, 'Inpatient', %s, 'In Progress'
                                );
                            """, (visit_id, pat_id, doc_id, dept_id, clinical_reason))
                        cur.execute("UPDATE admissions SET visit_id = %s WHERE admission_id = %s;", (visit_id, adm_id))

                    # Synchronize dim_admission_inputs
                    cur.execute("SELECT display_name, specialization, qualification FROM doctors WHERE id = %s;", (doc_id,))
                    d_row = cur.fetchone()
                    doc_name, doc_spec, doc_qual = d_row if d_row else ("Attending Physician", "General Medicine", "MBBS, MD")
                    cur.execute("""
                        UPDATE dim_admission_inputs
                        SET attending_doctor = %s,
                            doctor_specialization = %s,
                            doctor_qualification = %s,
                            admission_type = COALESCE(NULLIF(%s, ''), admission_type),
                            reason_for_admission = COALESCE(NULLIF(%s, ''), reason_for_admission)
                        WHERE admission_id = %s;
                    """, (doc_name, doc_spec, doc_qual, clean_adm_type, clinical_reason, adm_id))

                    if should_close:
                        conn.commit()
                    return {
                        "success": True,
                        "admission_id": adm_id,
                        "admission_number": adm_num,
                        "patient_id": adm_pid,
                        "discharge_status": disc_st,
                        "ward_id": w_id,
                        "bed_id": b_id,
                        "already_linked": True,
                        "message": f"Admission {adm_num} already linked."
                    }

        # 2. Check if patient already has an active inpatient admission under the SAME doctor
        cur.execute("""
            SELECT admission_id, admission_number, patient_id, discharge_status, ward_id, bed_id
            FROM admissions
            WHERE patient_id = %s AND doctor_id = %s AND (discharge_status IS NULL OR LOWER(discharge_status) != 'discharged')
            ORDER BY admission_id DESC LIMIT 1;
        """, (pat_id, doc_id))
        active_adm = cur.fetchone()
        if active_adm:
            adm_id, adm_num, adm_pid, disc_st, w_id, b_id = active_adm
            cur.execute("""
                UPDATE pre_admissions
                SET admission_id = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
            """, (adm_id, pa_id))
            cur.execute("""
                UPDATE admissions
                SET pre_admission_id = %s
                WHERE admission_id = %s AND pre_admission_id IS NULL;
            """, (pa_id, adm_id))
            if should_close:
                conn.commit()
            return {
                "success": True,
                "admission_id": adm_id,
                "admission_number": adm_num,
                "patient_id": adm_pid,
                "discharge_status": disc_st,
                "ward_id": w_id,
                "bed_id": b_id,
                "already_linked": False,
                "linked_existing": True,
                "message": f"Linked active admission {adm_num} to pre-admission {pa_code}."
            }

        # 3. Create a new authoritative inpatient admission
        cur.execute("""
            SELECT GREATEST(
                (SELECT COALESCE(MAX(admission_id), 0) FROM admissions),
                (SELECT COALESCE(MAX(admission_id), 0) FROM dim_admission_inputs)
            ) + 1;
        """)
        next_adm_id = cur.fetchone()[0]
        adm_number = f"MER-ADM-{str(next_adm_id).zfill(7)}"

        # Ensure an active patient_visits record exists for clinical/SOAP continuity
        cur.execute("""
            SELECT visit_id FROM patient_visits
            WHERE patient_id = %s AND doctor_id = %s AND (visit_status IS NULL OR visit_status IN ('In Progress', 'Active'))
            ORDER BY visit_id DESC LIMIT 1;
        """, (pat_id, doc_id))
        visit_row = cur.fetchone()
        if visit_row:
            visit_id = visit_row[0]
        else:
            cur.execute("SELECT COALESCE(MAX(visit_id), 0) + 1 FROM patient_visits;")
            next_visit_id = cur.fetchone()[0]
            cur.execute("""
                INSERT INTO patient_visits (
                    visit_id, patient_id, doctor_id, department_id,
                    visit_date, visit_type, chief_complaint, visit_status
                ) VALUES (
                    %s, %s, %s, %s,
                    CURRENT_TIMESTAMP, 'Inpatient', %s, 'In Progress'
                ) RETURNING visit_id;
            """, (next_visit_id, pat_id, doc_id, dept_id, instructions or remarks or "Pre-Admission Clearance"))
            visit_id = cur.fetchone()[0]

        try:
            clean_adm_type = normalize_admission_type(adm_type) if adm_type else "Elective"
        except PreAdmissionValidationError:
            clean_adm_type = str(adm_type or "Elective").strip()

        clinical_reason = instructions or remarks or "Pre-Admission Clearance"

        # Insert into admissions table
        cur.execute("""
            INSERT INTO admissions (
                admission_id, admission_number, patient_id, visit_id,
                doctor_id, department_id, ward_id, bed_id,
                admission_date, admission_type, admission_source,
                reason_for_admission, discharge_status, pre_admission_id
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, NULL, NULL,
                CURRENT_TIMESTAMP, %s, 'Pre-Admission',
                %s, 'Admitted', %s
            ) RETURNING admission_id;
        """, (
            next_adm_id, adm_number, pat_id, visit_id,
            doc_id, dept_id, clean_adm_type,
            clinical_reason, pa_id
        ))
        created_adm_id = cur.fetchone()[0]

        # Update pre_admissions with linked admission_id
        cur.execute("""
            UPDATE pre_admissions
            SET admission_id = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (created_adm_id, pa_id))

        # Populate dim_admission_inputs for lakehouse / gold view consistency
        cur.execute("""
            SELECT p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth,
                   p.blood_group, p.phone, p.email, p.address
            FROM patients p WHERE p.id = %s;
        """, (pat_id,))
        p_row = cur.fetchone()
        pat_code, fn, ln, gender, dob, blood_group, phone, email, addr = (
            p_row if p_row else ("PAT-0000", "Patient", "", "Other", None, "O+", "", "", "")
        )

        cur.execute("SELECT display_name, specialization, qualification FROM doctors WHERE id = %s;", (doc_id,))
        d_row = cur.fetchone()
        doc_name, doc_spec, doc_qual = (
            d_row if d_row else ("Dr. Attending Physician", "General Medicine", "MBBS, MD")
        )

        cur.execute("""
            INSERT INTO dim_admission_inputs (
                admission_id, admission_number, patient_id, patient_number,
                first_name, last_name, gender, age_at_admission, blood_group,
                date_of_birth, preferred_language, phone, email, address,
                admission_date, admission_type, admission_source, reason_for_admission,
                discharge_status, current_stay_days, attending_doctor, doctor_specialization,
                doctor_qualification, primary_diagnosis, secondary_diagnoses,
                latest_temperature, latest_heart_rate, latest_systolic_bp, latest_diastolic_bp,
                latest_oxygen_saturation, bill_number, bill_net_amount, bill_status,
                bill_clearance_status, outstanding_balance, gold_ingestion_time,
                bed_number, room_number, ward_name
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, 35, %s,
                %s, 'English', %s, %s, %s,
                CURRENT_TIMESTAMP, %s, 'Pre-Admission', %s,
                'Admitted', 1, %s, %s,
                %s, %s, '[]',
                98.6, 72, 120, 80,
                98.0, %s, 0.0, 'Pending',
                'Pending', 0.0, CURRENT_TIMESTAMP,
                'Pending Allocation', 'Pending', 'Pending Allocation'
            )
            ON CONFLICT (admission_id) DO UPDATE SET
                discharge_status = 'Admitted',
                ward_name = EXCLUDED.ward_name,
                room_number = EXCLUDED.room_number,
                bed_number = EXCLUDED.bed_number;
        """, (
            created_adm_id, adm_number, pat_id, pat_code or f"PAT-{pat_id}",
            fn, ln, gender or "Other", blood_group or "O+",
            dob, phone or "", email or "", addr or "",
            clean_adm_type, clinical_reason,
            doc_name, doc_spec or "General Medicine", doc_qual or "MBBS, MD",
            clinical_reason, f"BILL-{30500 + created_adm_id % 1000}"
        ))

        if should_close:
            conn.commit()

        try:
            from connectors.databricks_connector import DatabricksConnector
            DatabricksConnector().clear_cache()
        except Exception:
            pass

        return {
            "success": True,
            "admission_id": created_adm_id,
            "admission_number": adm_number,
            "patient_id": pat_id,
            "discharge_status": "Admitted",
            "ward_id": None,
            "bed_id": None,
            "newly_created": True,
            "message": f"Inpatient admission {adm_number} created and linked to pre-admission {pa_code}."
        }

    except Exception as e:
        if should_close and conn:
            conn.rollback()
        raise e
    finally:
        if should_close and conn and not conn.closed:
            cur.close()
            conn.close()


def allocate_bed_for_admission(
    admission_id: int,
    ward_id: int,
    room_id: int,
    bed_id: int,
    doctor_id_restriction: Optional[int] = None
) -> Dict[str, Any]:
    """
    Allocates or transfers a bed for an authoritative admission.
    Validates:
      1. Admission exists and is active (not Discharged).
      2. If doctor_id_restriction is provided, validates admission doctor matches.
      3. Selected bed exists, belongs to room_id and ward_id, and room belongs to ward.
      4. Selected bed is 'Available' (or currently assigned to this admission).
      5. Re-allocates safely: releases any previously assigned bed back to 'Available'.
      6. Sets target bed status to 'Occupied'.
      7. Updates admissions.ward_id and admissions.bed_id.
      8. Synchronizes dim_admission_inputs (ward_name, room_number, bed_number).
      9. Atomic transaction with rollback on failure.
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # 1. Lock Admission
        cur.execute("""
            SELECT a.admission_id, a.admission_number, a.patient_id, a.doctor_id, a.ward_id, a.bed_id, a.discharge_status,
                   pa.status as pre_adm_status
            FROM admissions a
            LEFT JOIN pre_admissions pa ON (a.pre_admission_id = pa.id OR a.admission_id = pa.admission_id)
            WHERE a.admission_id = %s
            FOR UPDATE OF a;
        """, (admission_id,))
        adm_row = cur.fetchone()
        if not adm_row:
            raise PreAdmissionValidationError(f"Admission ID {admission_id} not found.")

        aid, adm_num, pat_id, doc_id, old_ward_id, old_bed_id, disc_st, pa_st = adm_row
        if str(disc_st or "").strip().lower() == "discharged":
            raise PreAdmissionValidationError(f"Cannot allocate a bed to discharged admission {adm_num}.")

        if str(pa_st or "").strip().upper() in ("CANCELLED", "COMPLETED"):
            raise PreAdmissionValidationError(f"Cannot allocate bed: Linked pre-admission is {str(pa_st).lower()}.")

        if doctor_id_restriction is not None and doc_id != doctor_id_restriction:
            raise PreAdmissionValidationError("Unauthorized: Admission is assigned to another doctor.")

        # 2. Lock & Validate Bed, Room, Ward hierarchy
        cur.execute("""
            SELECT b.bed_id, b.bed_number, b.status, b.room_id, b.ward_id,
                   r.room_number, r.ward_id as room_ward_id,
                   w.ward_name
            FROM beds b
            JOIN rooms r ON b.room_id = r.room_id
            JOIN wards w ON b.ward_id = w.ward_id
            WHERE b.bed_id = %s
            FOR UPDATE;
        """, (bed_id,))
        bed_row = cur.fetchone()
        if not bed_row:
            raise PreAdmissionValidationError(f"Bed ID {bed_id} not found.")

        bid, b_num, b_status, b_room_id, b_ward_id, r_num, r_ward_id, w_name = bed_row

        if b_ward_id != ward_id:
            raise PreAdmissionValidationError(f"Bed {b_num} belongs to ward ID {b_ward_id}, not selected ward ID {ward_id}.")
        if b_room_id != room_id:
            raise PreAdmissionValidationError(f"Bed {b_num} belongs to room ID {b_room_id}, not selected room ID {room_id}.")
        if r_ward_id != ward_id:
            raise PreAdmissionValidationError(f"Room {r_num} does not belong to selected ward ID {ward_id}.")

        # 3. Availability check (Idempotent if already assigned to this admission)
        if old_bed_id == bed_id:
            return {
                "success": True,
                "admission_id": aid,
                "admission_number": adm_num,
                "bed_id": bed_id,
                "bed_number": b_num,
                "room_id": room_id,
                "room_number": r_num,
                "ward_id": ward_id,
                "ward_name": w_name,
                "message": f"Bed {b_num} is already allocated to admission {adm_num}."
            }

        if str(b_status).strip().lower() != "available":
            raise PreAdmissionValidationError(f"Bed {b_num} is currently '{b_status}' and cannot be allocated.")

        # 4. Release old bed if another bed was previously assigned
        if old_bed_id and old_bed_id != bed_id:
            cur.execute("UPDATE beds SET status = 'Available' WHERE bed_id = %s;", (old_bed_id,))

        # 5. Mark new bed Occupied
        cur.execute("UPDATE beds SET status = 'Occupied' WHERE bed_id = %s;", (bed_id,))

        # 6. Update admission record
        cur.execute("""
            UPDATE admissions
            SET ward_id = %s, bed_id = %s
            WHERE admission_id = %s;
        """, (ward_id, bed_id, aid))

        # 7. Synchronize dim_admission_inputs
        cur.execute("SELECT display_name, specialization FROM doctors WHERE id = %s;", (doc_id,))
        d_info = cur.fetchone()
        doc_disp_name = d_info[0] if d_info else "Attending Physician"
        doc_spec_name = d_info[1] if d_info else "General Medicine"

        cur.execute("""
            UPDATE dim_admission_inputs
            SET ward_name = %s,
                room_number = %s,
                bed_number = %s,
                discharge_status = 'Admitted',
                attending_doctor = COALESCE(NULLIF(%s, ''), attending_doctor),
                doctor_specialization = COALESCE(NULLIF(%s, ''), doctor_specialization)
            WHERE admission_id = %s;
        """, (w_name, r_num, b_num, doc_disp_name, doc_spec_name, aid))

        conn.commit()

        try:
            from connectors.databricks_connector import DatabricksConnector
            DatabricksConnector().clear_cache()
        except Exception:
            pass

        return {
            "success": True,
            "admission_id": aid,
            "admission_number": adm_num,
            "patient_id": pat_id,
            "bed_id": bed_id,
            "bed_number": b_num,
            "room_id": room_id,
            "room_number": r_num,
            "ward_id": ward_id,
            "ward_name": w_name,
            "message": f"Successfully allocated Bed {b_num} (Room: {r_num}, Ward: {w_name}) to admission {adm_num}."
        }
    except Exception as e:
        conn.rollback()
        if isinstance(e, PreAdmissionValidationError):
            raise e
        raise PreAdmissionValidationError(f"Database error during bed allocation: {str(e)}")
    finally:
        cur.close()
        conn.close()


def get_available_beds_hierarchy(ward_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Returns available beds grouped by ward and room for clean allocation UI."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        query = """
            SELECT w.ward_id, w.ward_name, w.ward_type, w.floor_number,
                   r.room_id, r.room_number, r.room_type,
                   b.bed_id, b.bed_number, b.bed_type, b.daily_charge, b.status
            FROM beds b
            JOIN rooms r ON b.room_id = r.room_id
            JOIN wards w ON b.ward_id = w.ward_id
            WHERE b.status = 'Available'
        """
        params = []
        if ward_id:
            query += " AND b.ward_id = %s"
            params.append(ward_id)
        query += " ORDER BY w.ward_name, r.room_number, b.bed_number;"
        cur.execute(query, params)
        rows = cur.fetchall()

        wards_map = {}
        for r in rows:
            (wid, wname, wtype, floor, rid, rnum, rtype, bid, bnum, btype, charge, bstatus) = r
            if wid not in wards_map:
                wards_map[wid] = {
                    "ward_id": wid,
                    "ward_name": wname,
                    "ward_type": wtype,
                    "floor_number": floor,
                    "rooms": {}
                }
            if rid not in wards_map[wid]["rooms"]:
                wards_map[wid]["rooms"][rid] = {
                    "room_id": rid,
                    "room_number": rnum,
                    "room_type": rtype,
                    "beds": []
                }
            wards_map[wid]["rooms"][rid]["beds"].append({
                "bed_id": bid,
                "bed_number": bnum,
                "bed_type": btype,
                "daily_charge": float(charge) if charge else 0.0,
                "status": bstatus
            })

        result = []
        for wid, w in wards_map.items():
            rooms_list = []
            for rid, r in w["rooms"].items():
                rooms_list.append(r)
            w["rooms"] = rooms_list
            result.append(w)
        return result
    finally:
        cur.close()
        conn.close()


def update_pre_admission_status(
    pre_admission_id: int,
    status: Optional[str] = None,
    submitted_documents: Optional[str] = None,
    pending_documents: Optional[str] = None,
    remarks: Optional[str] = None
) -> Dict[str, Any]:
    """
    Updates pre-admission status and document tracking.
    When transitioning to CONFIRMED, READY, or READY_FOR_ADMISSION:
    authoritatively creates or links the inpatient admission in the same transaction!
    """
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id, status, admission_id FROM pre_admissions WHERE id = %s;", (pre_admission_id,))
        row = cur.fetchone()
        if not row:
            return {"success": False, "error": f"Pre-admission ID {pre_admission_id} not found."}

        current_pa_id, old_status, linked_aid = row

        updates = []
        params = []
        st_clean = None
        if status:
            valid_statuses = {"PENDING", "CONTACTED", "CONFIRMED", "DOCUMENTS_PENDING", "READY", "READY_FOR_ADMISSION", "ESCALATED", "COMPLETED", "CANCELLED"}
            st_clean = status.strip().upper()
            if st_clean not in valid_statuses:
                return {"success": False, "error": f"Invalid status '{status}'. Allowed: {list(valid_statuses)}"}
            updates.append("status = %s")
            params.append(st_clean)

        if submitted_documents is not None:
            updates.append("submitted_documents = %s")
            params.append(submitted_documents)

        if pending_documents is not None:
            updates.append("pending_documents = %s")
            params.append(pending_documents)

        if remarks is not None:
            updates.append("remarks = %s")
            params.append(remarks)

        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            params.append(pre_admission_id)
            sql = f"UPDATE pre_admissions SET {', '.join(updates)} WHERE id = %s;"
            cur.execute(sql, params)

        admission_info = None

        # ── Business Rule: If transitioning to CONFIRMED, READY, or READY_FOR_ADMISSION,
        # create or link authoritative inpatient admission
        if st_clean in {"CONFIRMED", "READY", "READY_FOR_ADMISSION"}:
            admission_info = confirm_or_link_admission(pre_admission_id, cur=cur, conn=conn)

        # If cancelled, ensure any linked admission is discharged and bed is freed
        if st_clean == 'CANCELLED':
            cur.execute("SELECT admission_id FROM pre_admissions WHERE id = %s;", (pre_admission_id,))
            linked_adm_row = cur.fetchone()
            if linked_adm_row and linked_adm_row[0]:
                linked_aid = linked_adm_row[0]
                cur.execute("UPDATE admissions SET discharge_status = 'Discharged', discharge_date = CURRENT_DATE WHERE admission_id = %s;", (linked_aid,))
                cur.execute("UPDATE dim_admission_inputs SET discharge_status = 'Discharged' WHERE admission_id = %s;", (linked_aid,))
                cur.execute("UPDATE beds SET status = 'Available' WHERE bed_id IN (SELECT bed_id FROM admissions WHERE admission_id = %s AND bed_id IS NOT NULL);", (linked_aid,))

        # If completed, ensure linked admission is marked Discharged and bed is freed
        if st_clean == 'COMPLETED':
            cur.execute("SELECT admission_id FROM pre_admissions WHERE id = %s;", (pre_admission_id,))
            linked_adm_row = cur.fetchone()
            if linked_adm_row and linked_adm_row[0]:
                linked_aid = linked_adm_row[0]
                cur.execute("UPDATE admissions SET discharge_status = 'Discharged', discharge_date = CURRENT_DATE WHERE admission_id = %s AND (discharge_status IS NULL OR LOWER(discharge_status) != 'discharged');", (linked_aid,))
                cur.execute("UPDATE dim_admission_inputs SET discharge_status = 'Discharged' WHERE admission_id = %s;", (linked_aid,))
                cur.execute("UPDATE beds SET status = 'Available' WHERE bed_id IN (SELECT bed_id FROM admissions WHERE admission_id = %s AND bed_id IS NOT NULL);", (linked_aid,))

        conn.commit()

        res_payload = {"success": True, "message": "Pre-admission updated successfully."}
        if admission_info:
            res_payload["admission"] = admission_info
            res_payload["admission_id"] = admission_info.get("admission_id")
            res_payload["admission_number"] = admission_info.get("admission_number")

        return res_payload
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()


def get_pre_admission_conversation(pre_admission_id: int) -> Dict[str, Any]:
    """Retrieves full WhatsApp conversation history for the patient linked to pre-admission."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT pa.id, pa.pre_admission_code, pa.patient_id, p.first_name, p.last_name, p.whatsapp_number, p.phone
            FROM pre_admissions pa
            JOIN patients p ON pa.patient_id = p.id
            WHERE pa.id = %s;
        """, (pre_admission_id,))
        pa_row = cur.fetchone()
        if not pa_row:
            return {"success": False, "error": "Pre-admission not found"}

        patient_id = pa_row[2]
        pat_name = f"{pa_row[3]} {pa_row[4] or ''}".strip()
        phone = pa_row[5] or pa_row[6]
        clean_p = normalize_phone(phone) if phone else ""

        # Find conversation record
        cur.execute("""
            SELECT id, conversation_code, language, current_intent, conversation_status, created_at
            FROM conversations
            WHERE patient_id = %s OR whatsapp_number = %s OR whatsapp_number = %s
            ORDER BY id DESC LIMIT 1;
        """, (patient_id, phone, clean_p))
        conv_row = cur.fetchone()

        messages = []
        conv_info = None

        if conv_row:
            conv_id = conv_row[0]
            conv_code = conv_row[1]
            conv_info = {
                "id": conv_id,
                "conversation_code": conv_code,
                "language": conv_row[2],
                "current_intent": conv_row[3],
                "status": conv_row[4],
            }

            cur.execute("""
                SELECT id, sender_type, message_text, intent, language, created_at
                FROM messages
                WHERE conversation_id = %s
                ORDER BY id ASC;
            """, (conv_id,))
            msg_rows = cur.fetchall()

            for m in msg_rows:
                messages.append({
                    "id": m[0],
                    "sender_type": m[1],
                    "message_text": m[2],
                    "intent": m[3],
                    "language": m[4],
                    "timestamp": str(m[5]) if m[5] else None
                })

        # Fallback if no messages in messages table but notifications exist
        if not messages:
            cur.execute("""
                SELECT id, message, status, created_at
                FROM notifications
                WHERE patient_id = %s AND notification_type = 'ADMISSION_REMINDER'
                ORDER BY id ASC;
            """, (patient_id,))
            notif_rows = cur.fetchall()
            for n in notif_rows:
                messages.append({
                    "id": f"notif_{n[0]}",
                    "sender_type": "AI_AGENT",
                    "message_text": n[1],
                    "intent": "PRE_ADMISSION_CLEARANCE",
                    "language": "ENGLISH",
                    "timestamp": str(n[3]) if n[3] else None
                })

        return {
            "success": True,
            "pre_admission_id": pre_admission_id,
            "patient_name": pat_name,
            "conversation": conv_info,
            "messages": messages
        }
    except Exception as e:
        print(f"[ERROR] Failed to fetch pre-admission conversation: {e}")
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()
