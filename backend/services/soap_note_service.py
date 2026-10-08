"""Persistence and authorization rules for AG-17 SOAP notes."""
import json
from datetime import datetime, timezone

import db_config
from fastapi import HTTPException
from services.soap_clinical_validation import compare_clinical_entities, require_clinical_review


CLINICAL_ROLES = {"doctor", "admin", "hospital management", "resident", "resident doctor"}
STAFF_ROLES = CLINICAL_ROLES | {"nurse", "junior nurse", "medical intern", "intern", "pharmacy", "radiologist", "pathologist"}


def _dict_row(cur, row):
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return dict(zip([c[0] for c in cur.description], row))


def verified_user(cur, user, *, signing=False):
    uid = user.get("user_id")
    if not uid:
        raise HTTPException(401, "Authenticated user identity is required.")
    # Demo and development fallback tokens are not valid clinical authors/signers.
    if (str(user.get("auth_method", "")).lower() not in {"password", "account_selection"}
            or str(user.get("username", "")).lower() == "dev"):
        raise HTTPException(401, "A verified user session is required for clinical notes.")
    cur.execute("""SELECT u.id, u.username, u.is_active, r.name AS role,
                       COALESCE(d.display_name, NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)), ''), u.staff_name, u.username) AS name,
                       u.department_id, d.id AS doctor_id
                FROM users u JOIN roles r ON r.id=u.role_id
                LEFT JOIN doctors d ON d.user_id=u.id WHERE u.id=%s""", (uid,))
    record = _dict_row(cur, cur.fetchone())
    if not record or not record.get("is_active"):
        raise HTTPException(401, "Authenticated user is inactive or no longer exists.")
    if str(record.get("role", "")).strip().lower() not in STAFF_ROLES:
        raise HTTPException(403, "Clinical staff access is required for SOAP notes.")
    if signing and (str(record.get("role", "")).strip().lower() not in CLINICAL_ROLES or not record.get("doctor_id") and str(record.get("role", "")).strip().lower() not in {"admin", "hospital management"}):
        raise HTTPException(403, "An authorized clinical signer is required.")
    return record


def validate_context(cur, patient_id, visit_id, admission_id=None):
    if patient_id is None or visit_id is None:
        raise HTTPException(400, "patient_id and visit_id are required.")
    cur.execute("SELECT patient_id FROM patient_visits WHERE visit_id=%s", (visit_id,))
    visit = cur.fetchone()
    if not visit or int(visit[0]) != int(patient_id):
        raise HTTPException(400, "The visit does not belong to the requested patient.")
    if admission_id is not None:
        cur.execute("SELECT patient_id, visit_id FROM admissions WHERE admission_id=%s", (admission_id,))
        admission = cur.fetchone()
        if not admission or int(admission[0]) != int(patient_id) or int(admission[1]) != int(visit_id):
            raise HTTPException(400, "The admission does not belong to the requested patient and visit.")


def audit(cur, action, note, user, old_status=None, new_status=None, metadata=None):
    payload = {
        "patient_id": note["patient_id"], "visit_id": note["visit_id"],
        "admission_id": note.get("admission_id"), "soap_note_id": note["soap_note_id"],
        "role": user.get("role"), "old_status": old_status,
        "new_status": new_status, "metadata": metadata or {},
    }
    cur.execute("""INSERT INTO audit_logs(user_id, action, entity_type, entity_id, old_values, new_values, reason, created_at)
                   VALUES (%s,%s,'SOAP_NOTE',%s,%s::jsonb,%s::jsonb,%s,CURRENT_TIMESTAMP)""",
                (user["id"], action, note["soap_note_id"],
                 json.dumps({"status": old_status}) if old_status else None,
                 json.dumps(payload), "AG-17 SOAP workflow"))


def _final_record(note_or_fields):
    return {key: note_or_fields.get(key, "") or "" for key in ("subjective", "objective", "assessment", "plan")}


def _record_mismatch_detection(cur, note, user, validation):
    if not validation["has_mismatch"]:
        return
    cur.execute("""SELECT 1 FROM audit_logs
                    WHERE action='SOAP_CLINICAL_MISMATCH_DETECTED'
                      AND entity_type='SOAP_NOTE' AND entity_id=%s
                      AND new_values::jsonb->'metadata'->>'fingerprint'=%s LIMIT 1""",
                (note["soap_note_id"], validation["fingerprint"]))
    if not cur.fetchone():
        audit(cur, "SOAP_CLINICAL_MISMATCH_DETECTED", note, user,
              old_status="DRAFT", new_status="DRAFT",
              metadata={"fingerprint": validation["fingerprint"], "mismatches": validation["mismatches"]})


def _unresolved_mismatch_detections(cur, note_id):
    cur.execute("""SELECT id, new_values::jsonb->'metadata' FROM audit_logs
                    WHERE action='SOAP_CLINICAL_MISMATCH_DETECTED'
                      AND entity_type='SOAP_NOTE' AND entity_id=%s ORDER BY id""", (note_id,))
    detections = cur.fetchall()
    cur.execute("""SELECT new_values::jsonb->'metadata' FROM audit_logs
                    WHERE action='SOAP_CLINICAL_MISMATCH_RESOLVED'
                      AND entity_type='SOAP_NOTE' AND entity_id=%s""", (note_id,))
    resolutions = cur.fetchall()
    resolved_ids = set()
    for (metadata,) in resolutions:
        if isinstance(metadata, str): metadata = json.loads(metadata)
        resolved_ids.update(int(value) for value in (metadata or {}).get("detection_ids", []))
    pending = []
    for detection_id, metadata in detections:
        if isinstance(metadata, str): metadata = json.loads(metadata)
        if int(detection_id) not in resolved_ids:
            pending.append({"id": int(detection_id), "metadata": metadata or {}})
    return pending


def _include_pending_review(cur, note_id, validation):
    pending = _unresolved_mismatch_detections(cur, note_id)
    # Historical detections describe earlier edits. Current canonical entity
    # comparison is authoritative; stale raw snapshots must not keep Sign blocked.
    active_pending = bool(pending and validation["has_mismatch"])
    validation["pending_review"] = active_pending
    validation["has_mismatch"] = bool(validation["has_mismatch"] or active_pending)
    validation["can_resolve"] = bool(validation["has_mismatch"] and not validation["final_has_mismatch"] and active_pending)
    validation["reviewed"] = not active_pending
    return pending


def validate_clinical_record(note_id, payload, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = verified_user(cur, token_user)
            note = get_note(cur, note_id)
            if note["status"] != "DRAFT": raise HTTPException(409, "Only draft SOAP notes can be clinically validated.")
            if note["author_user_id"] != user["id"] and str(user["role"]).lower() not in {"admin", "hospital management"}:
                raise HTTPException(403, "Only the note author or an administrator may validate this draft.")
            validate_context(cur, note["patient_id"], note["visit_id"], note.get("admission_id"))
            validation = compare_clinical_entities(note.get("raw_transcript"), note.get("ai_draft"), _final_record(payload))
            _record_mismatch_detection(cur, note, user, validation)
            _include_pending_review(cur, note_id, validation)
        conn.commit()
        return validation
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def resolve_clinical_mismatch(note_id, payload, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = verified_user(cur, token_user)
            note = get_note(cur, note_id, lock=True)
            if note["status"] != "DRAFT": raise HTTPException(409, "Only draft SOAP notes can resolve a clinical mismatch.")
            if note["author_user_id"] != user["id"] and str(user["role"]).lower() not in {"admin", "hospital management"}:
                raise HTTPException(403, "Only the note author or an administrator may resolve this mismatch.")
            validate_context(cur, note["patient_id"], note["visit_id"], note.get("admission_id"))
            final_record = _final_record(payload)
            validation = compare_clinical_entities(note.get("raw_transcript"), note.get("ai_draft"), final_record)
            _record_mismatch_detection(cur, note, user, validation)
            pending = _unresolved_mismatch_detections(cur, note_id)
            # Old text-based detections can remain in the audit trail after
            # normalized values prove there is no current clinical difference.
            if not validation["has_mismatch"]:
                pending = []
            if not validation["has_mismatch"] and not pending:
                raise HTTPException(409, "No detected clinical mismatch requires resolution.")
            if validation["final_has_mismatch"]:
                raise HTTPException(409, detail={
                    "code": "SOAP_CLINICAL_MISMATCH",
                    "message": "Correct the final clinical record to match the transcript before resolving the mismatch.",
                    "validation": validation,
                })
            assignments = ",".join(f"{key}=%s" for key in final_record)
            cur.execute(f"UPDATE soap_notes SET {assignments},updated_at=CURRENT_TIMESTAMP WHERE soap_note_id=%s RETURNING *",
                        (*final_record.values(), note_id))
            updated = _dict_row(cur, cur.fetchone())
            audit(cur, "SOAP_CLINICAL_MISMATCH_RESOLVED", updated, user,
                  old_status="DRAFT", new_status="DRAFT",
                  metadata={"fingerprint": validation["fingerprint"], "detection_ids": [event["id"] for event in pending], "fields": list(final_record)})
            _include_pending_review(cur, note_id, validation)
        conn.commit()
        return {"note": updated, "validation": validation}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_note(cur, note_id, *, lock=False):
    cur.execute("SELECT * FROM soap_notes WHERE soap_note_id=%s" + (" FOR UPDATE" if lock else ""), (note_id,))
    note = _dict_row(cur, cur.fetchone())
    if not note:
        raise HTTPException(404, "SOAP note not found.")
    return note


def create_note(payload, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = verified_user(cur, token_user)
            validate_context(cur, payload["patient_id"], payload["visit_id"], payload.get("admission_id"))
            cur.execute("""INSERT INTO soap_notes(patient_id,visit_id,admission_id,author_user_id,author_name,author_role,
                            department_id,dictation_language,raw_transcript,subjective,objective,assessment,plan,ai_generated,ai_model,source)
                         VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                        (payload["patient_id"],payload["visit_id"],payload.get("admission_id"),user["id"],user["name"],user["role"],
                         user.get("department_id"),payload.get("dictation_language"),payload.get("raw_transcript"),payload.get("subjective", ""),
                         payload.get("objective", ""),payload.get("assessment", ""),payload.get("plan", ""),payload.get("ai_generated",False),payload.get("ai_model"),payload.get("source","VOICE")))
            note = _dict_row(cur, cur.fetchone())
            audit(cur, "SOAP_CREATED", note, user, new_status="DRAFT")
        conn.commit()
        return note
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_notes(user, patient_id=None, visit_id=None, admission_id=None, signed_only=False, mine=False):
    if patient_id is None and visit_id is None:
        raise HTTPException(400, "patient_id or visit_id is required.")
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            current_user = verified_user(cur, user)
            if patient_id is not None and visit_id is not None:
                validate_context(cur, patient_id, visit_id, admission_id)
            clauses, values = [], []
            if patient_id is not None: clauses.append("patient_id=%s"); values.append(patient_id)
            if visit_id is not None: clauses.append("visit_id=%s"); values.append(visit_id)
            if admission_id is not None: clauses.append("admission_id=%s"); values.append(admission_id)
            if signed_only: clauses.append("status IN ('SIGNED','AMENDED')")
            if mine: clauses.append("author_user_id=%s"); values.append(current_user["id"])
            cur.execute("SELECT * FROM soap_notes WHERE " + " AND ".join(clauses) + " ORDER BY created_at DESC, soap_note_id DESC", values)
            result = [_dict_row(cur, row) for row in cur.fetchall()]
        return result
    finally:
        conn.close()


def retrieve_note(note_id, user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            verified_user(cur, user)
            return get_note(cur, note_id)
    finally:
        conn.close()


def update_draft(note_id, payload, token_user, audit_action="SOAP_DRAFT_UPDATED"):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = verified_user(cur, token_user)
            note = get_note(cur, note_id, lock=True)
            if note["status"] != "DRAFT": raise HTTPException(409, "Only draft SOAP notes can be edited.")
            if note["author_user_id"] != user["id"] and str(user["role"]).lower() not in {"admin", "hospital management"}:
                raise HTTPException(403, "Only the note author or an administrator may edit this draft.")
            validate_context(cur, note["patient_id"], note["visit_id"], note.get("admission_id"))
            allowed = {k: payload[k] for k in ("dictation_language","raw_transcript","subjective","objective","assessment","plan","ai_generated","ai_draft","ai_model","source") if k in payload}
            if "ai_draft" in allowed:
                allowed["ai_draft"] = json.dumps(allowed["ai_draft"])
                assignments = ",".join(f"{key}=%s" + ("::jsonb" if key == "ai_draft" else "") for key in allowed)
            else:
                assignments = ",".join(f"{key}=%s" for key in allowed)
            if not allowed: return note
            cur.execute(f"UPDATE soap_notes SET {assignments},updated_at=CURRENT_TIMESTAMP WHERE soap_note_id=%s RETURNING *", (*allowed.values(),note_id))
            updated = _dict_row(cur, cur.fetchone())
            audit(cur, audit_action, updated, user, old_status="DRAFT", new_status="DRAFT", metadata={"fields": list(allowed)})
        conn.commit()
        return updated
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def sign_note(note_id, token_user):
    conn = db_config.get_db_connection()
    should_dispatch = False
    signed = None
    try:
        with conn.cursor() as cur:
            user = verified_user(cur, token_user, signing=True)
            note = get_note(cur, note_id, lock=True)
            if note["status"] == "SIGNED":
                if note.get("signed_by") != user["id"] and str(user.get("role", "")).lower() not in {"admin", "hospital management"}:
                    raise HTTPException(403, "Only the signing clinician or an administrator may retry action dispatch.")
                signed = note
                should_dispatch = True
            else:
                if note["status"] != "DRAFT": raise HTTPException(409, "SOAP note is not an unsigned draft.")
                validate_context(cur, note["patient_id"], note["visit_id"], note.get("admission_id"))
                validation = compare_clinical_entities(note.get("raw_transcript"), note.get("ai_draft"), _final_record(note))
                _record_mismatch_detection(cur, note, user, validation)
                pending = _unresolved_mismatch_detections(cur, note_id)
                if not validation["has_mismatch"]:
                    pending = []
                try:
                    require_clinical_review(validation, validation["fingerprint"] if not pending else None, pending_review=bool(pending))
                except HTTPException:
                    # Keep the mismatch detection audit even though signing is blocked.
                    conn.commit()
                    raise
                cur.execute("UPDATE soap_notes SET status='SIGNED',signed_at=CURRENT_TIMESTAMP,signed_by=%s,updated_at=CURRENT_TIMESTAMP WHERE soap_note_id=%s AND status='DRAFT' RETURNING *", (user["id"],note_id))
                signed = _dict_row(cur, cur.fetchone())
                if not signed: raise HTTPException(409, "SOAP note was already signed.")
                audit(cur, "SOAP_SIGNED", signed, user, old_status="DRAFT", new_status="SIGNED")
                should_dispatch = True
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    if should_dispatch:
        from services.soap_action_dispatch_service import dispatch_confirmed_actions
        try:
            signed["action_dispatch"] = dispatch_confirmed_actions(note_id, token_user)
        except Exception as exc:
            # Signing has already committed. A downstream outage is reported to
            # the caller and can be retried without signing or order duplication.
            signed["action_dispatch"] = {"soap_note_id": note_id, "success": False, "results": [], "error": str(exc)}
    return signed


def amend_note(note_id, payload, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = verified_user(cur, token_user, signing=True)
            parent = get_note(cur, note_id, lock=True)
            if parent["status"] not in {"SIGNED", "AMENDED"}: raise HTTPException(409, "Only a signed note can be amended.")
            validate_context(cur, parent["patient_id"], parent["visit_id"], parent.get("admission_id"))
            cur.execute("""INSERT INTO soap_notes(patient_id,visit_id,admission_id,author_user_id,author_name,author_role,department_id,
                        dictation_language,raw_transcript,subjective,objective,assessment,plan,status,signed_at,signed_by,version,parent_note_id,ai_generated,ai_model,source)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'AMENDED',CURRENT_TIMESTAMP,%s,%s,%s,%s,%s,%s) RETURNING *""",
                        (parent["patient_id"],parent["visit_id"],parent.get("admission_id"),user["id"],user["name"],user["role"],user.get("department_id"),
                         payload.get("dictation_language",parent.get("dictation_language")),payload.get("raw_transcript",parent.get("raw_transcript")),
                         payload.get("subjective",parent["subjective"]),payload.get("objective",parent["objective"]),payload.get("assessment",parent["assessment"]),payload.get("plan",parent["plan"]),
                         user["id"],int(parent["version"])+1,parent["soap_note_id"],payload.get("ai_generated",False),payload.get("ai_model"),payload.get("source","AMENDMENT")))
            amended = _dict_row(cur, cur.fetchone())
            audit(cur, "SOAP_AMENDED", amended, user, old_status=parent["status"], new_status="AMENDED", metadata={"parent_note_id": parent["soap_note_id"]})
        conn.commit()
        return amended
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def log_event(note_id, action, token_user, metadata=None):
    if action not in {"SOAP_TRANSCRIPTION_CREATED","SOAP_AI_DRAFT_GENERATED","SOAP_DRAFT_SAVED","SOAP_LOADED_FOR_REVIEW"}:
        raise HTTPException(400, "Unsupported SOAP audit event.")
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = verified_user(cur, token_user)
            note = get_note(cur, note_id, lock=True)
            if note["status"] != "DRAFT": raise HTTPException(409, "Activity can only be recorded for a draft.")
            audit(cur, action, note, user, old_status="DRAFT", new_status="DRAFT", metadata=metadata)
        conn.commit()
        return {"status": "recorded"}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
