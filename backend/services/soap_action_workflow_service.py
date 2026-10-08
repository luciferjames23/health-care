"""Persistence and review workflow for transcript-grounded SOAP actions.

This service records and reviews suggestions only. Confirming an action never
creates a medication, lab, imaging, diagnosis, or other operational record.
"""
import hashlib
import json
import uuid

import db_config
from fastapi import HTTPException

from services import soap_action_service as extractor
from services import soap_note_service as notes


MUTABLE_FIELDS = {
    "MEDICATION_ORDER": {"name", "dose", "unit", "route", "frequency", "duration"},
    "LAB_ORDER": {"name", "code", "priority"},
    "DIAGNOSTIC_ORDER": {"name"},
    "IMAGING_ORDER": {"name", "priority", "projection", "clinical_indication"},
    "DIAGNOSIS_CANDIDATE": {"name", "code"},
    "CLINICAL_FINDING": {"name", "finding_type", "value", "systolic", "diastolic", "unit"},
    "FOLLOW_UP": {"duration"},
    "REFERRAL": {"name"},
}
ACTION_COLUMNS = (
    "action_id, soap_note_id, patient_id, visit_id, admission_id, action_key, "
    "action_type, intent, name, code, dose, unit, route, frequency, duration, "
    "priority, projection, clinical_indication, finding_type, value, systolic, diastolic, "
    "source_text, confidence, status, confirmed_by, confirmed_at, "
    "target_module, target_record_id, error_message, created_at, updated_at, "
    "transcript_fingerprint"
)


def _fingerprint(text):
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def _clinical_user(cur, token_user):
    user = notes.verified_user(cur, token_user)
    if str(user.get("role", "")).strip().lower() not in notes.CLINICAL_ROLES:
        raise HTTPException(403, "Clinical authorization is required to review SOAP actions.")
    return user


def _note_access(cur, note_id, user, *, lock=False, mutable=False):
    note = notes.get_note(cur, note_id, lock=lock)
    notes.validate_context(cur, note["patient_id"], note["visit_id"], note.get("admission_id"))
    if note["author_user_id"] != user["id"] and str(user.get("role", "")).lower() not in {"admin", "hospital management"}:
        raise HTTPException(403, "Only the note author or an administrator may review these actions.")
    if mutable and note["status"] != "DRAFT":
        raise HTTPException(409, "Signed SOAP history is read-only.")
    return note


def _row(cur, row):
    return notes._dict_row(cur, row)


def _action(cur, action_id, *, lock=False):
    cur.execute("SELECT " + ACTION_COLUMNS + " FROM soap_clinical_actions WHERE action_id=%s" + (" FOR UPDATE" if lock else ""), (str(action_id),))
    action = _row(cur, cur.fetchone())
    if not action:
        raise HTTPException(404, "SOAP clinical action not found.")
    return action


def _assert_current(action, note):
    if action.get("transcript_fingerprint") != _fingerprint(note.get("raw_transcript")):
        raise HTTPException(409, "This action is stale because the transcript changed. Re-detect actions before review.")


def _set_actor(cur, user):
    cur.execute("SELECT set_config('app.user_id', %s, true)", (str(user["id"]),))


def _ensure_mutable_action(action, note):
    if note["status"] != "DRAFT":
        raise HTTPException(409, "Signed SOAP history is read-only.")
    _assert_current(action, note)
    if action["status"] not in {"DETECTED", "PENDING_CONFIRMATION"}:
        raise HTTPException(409, "Only unresolved actions can be edited or confirmed.")


def _confirmation_error(cur, action):
    if action["intent"] == "CONSIDER":
        return "This action was stated as a consideration and requires an explicit order request in the transcript."
    if action["action_type"] == "MEDICATION_ORDER":
        if not action.get("name") or action.get("dose") is None or not action.get("unit"):
            return "Medication name, dose, and unit are required before confirmation."
    elif action["action_type"] == "LAB_ORDER":
        if not action.get("name") and not action.get("code"):
            return "A laboratory test name or code is required before confirmation."
    elif action["action_type"] == "IMAGING_ORDER":
        if action.get("name", "").casefold() != "chest x-ray":
            return "Select a supported chest X-ray examination before confirmation."
        if action.get("projection") not in {"PA", "AP"}:
            return "Select a supported chest X-ray projection before confirmation."
        if len(str(action.get("clinical_indication") or "").strip()) < 3:
            return "Enter a concise clinical indication before confirmation."
    elif action["action_type"] == "CLINICAL_FINDING" and action.get("finding_type"):
        kind = action["finding_type"]
        if kind == "BLOOD_PRESSURE" and (action.get("systolic") is None or action.get("diastolic") is None or action.get("unit") != "mmHg"):
            return "Systolic, diastolic, and mmHg are required for blood pressure."
        if kind == "TEMPERATURE" and (action.get("value") is None or action.get("unit") != "F"):
            return "Temperature value in Fahrenheit is required for the existing vitals record. Review or enter the unit before confirmation."
        if kind == "PULSE" and (action.get("value") is None or action.get("unit") != "bpm"):
            return "Pulse value and bpm are required."
        if kind == "SPO2" and (action.get("value") is None or action.get("unit") != "%"):
            return "Oxygen saturation value and percent are required."
    elif action["action_type"] == "FOLLOW_UP" and not action.get("duration"):
        return "A follow-up interval is required before confirmation."
    elif not action.get("name"):
        return "A clinical action name is required before confirmation."
    return None


def detect_actions(note_id, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = _clinical_user(cur, token_user)
            note = _note_access(cur, note_id, user, lock=True, mutable=True)
            transcript = note.get("raw_transcript") or ""
            if not transcript.strip():
                raise HTTPException(409, "A raw transcript is required to detect clinical actions.")
            extraction = extractor.extract_clinical_actions(transcript, note.get("ai_draft"))
            fingerprint = _fingerprint(transcript)
            _set_actor(cur, user)
            results = []
            for suggestion in extraction.actions:
                cur.execute("""SELECT action_id, status, transcript_fingerprint
                               FROM soap_clinical_actions WHERE soap_note_id=%s AND action_key=%s FOR UPDATE""",
                            (note_id, suggestion.action_key))
                existing = _row(cur, cur.fetchone())
                values = suggestion.model_dump(mode="json")
                if existing:
                    # Preserve reviewed state only for an unchanged transcript.
                    if existing["transcript_fingerprint"] != fingerprint:
                        status = "PENDING_CONFIRMATION" if existing["status"] != "REJECTED" else "REJECTED"
                        cur.execute("""UPDATE soap_clinical_actions SET transcript_fingerprint=%s,
                                   status=%s, confirmed_by=NULL, confirmed_at=NULL, updated_at=CURRENT_TIMESTAMP
                                   WHERE action_id=%s RETURNING """ + ACTION_COLUMNS,
                                    (fingerprint, status, str(existing["action_id"])))
                    else:
                        cur.execute("SELECT " + ACTION_COLUMNS + " FROM soap_clinical_actions WHERE action_id=%s", (str(existing["action_id"]),))
                    row = _row(cur, cur.fetchone())
                else:
                    action_id = str(uuid.uuid4())
                    columns = ("action_id, soap_note_id, patient_id, visit_id, admission_id, action_key, action_type, intent, name, code, dose, unit, route, frequency, duration, priority, projection, clinical_indication, finding_type, value, systolic, diastolic, source_text, confidence, status, transcript_fingerprint")
                    record = (action_id, note_id, note["patient_id"], note["visit_id"], note.get("admission_id"),
                              values["action_key"], values["action_type"], values["intent"], values["name"], values.get("code"),
                              values.get("dose"), values.get("unit"), values.get("route"), values.get("frequency"), values.get("duration"),
                              values.get("priority"), values.get("projection"), values.get("clinical_indication"),
                              values.get("finding_type"), values.get("value"), values.get("systolic"), values.get("diastolic"),
                              values["source_text"], values["confidence"], values["status"], fingerprint)
                    cur.execute("INSERT INTO soap_clinical_actions(" + columns + ") VALUES (" + ",".join(["%s"] * len(record)) + ") RETURNING " + ACTION_COLUMNS, record)
                    row = _row(cur, cur.fetchone())
                results.append(row)
            # Existing unmatched rows are retained. Their old fingerprint marks
            # them stale so a reviewer cannot confirm a removed suggestion.
            cur.execute("SELECT " + ACTION_COLUMNS + " FROM soap_clinical_actions WHERE soap_note_id=%s ORDER BY created_at, action_id", (note_id,))
            all_actions = [_row(cur, record) for record in cur.fetchall()]
            for action in all_actions:
                action["stale"] = action.get("transcript_fingerprint") != fingerprint
        conn.commit()
        return {"soap_note_id": note_id, "transcript_fingerprint": fingerprint, "actions": all_actions}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_actions(note_id, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = _clinical_user(cur, token_user)
            note = _note_access(cur, note_id, user)
            cur.execute("SELECT " + ACTION_COLUMNS + " FROM soap_clinical_actions WHERE soap_note_id=%s ORDER BY created_at, action_id", (note_id,))
            actions = [_row(cur, record) for record in cur.fetchall()]
            fingerprint = _fingerprint(note.get("raw_transcript"))
            for action in actions:
                action["stale"] = action.get("transcript_fingerprint") != fingerprint
        return {"soap_note_id": note_id, "transcript_fingerprint": fingerprint, "actions": actions}
    finally:
        conn.close()


def patch_action(action_id, patch, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = _clinical_user(cur, token_user)
            initial = _action(cur, action_id)
            note = _note_access(cur, initial["soap_note_id"], user, lock=True, mutable=True)
            action = _action(cur, action_id, lock=True)
            _ensure_mutable_action(action, note)
            allowed = MUTABLE_FIELDS[action["action_type"]]
            invalid = set(patch) - allowed
            if invalid:
                raise HTTPException(422, "Fields not editable for this action type: " + ", ".join(sorted(invalid)))
            if not patch:
                raise HTTPException(422, "At least one editable action field is required.")
            if "name" in patch and (patch["name"] is None or not str(patch["name"]).strip()):
                raise HTTPException(422, "Action name cannot be empty.")
            _set_actor(cur, user)
            assignments = ", ".join(f"{field}=%s" for field in patch)
            values = list(patch.values())
            if action["status"] == "DETECTED":
                assignments += ", status='PENDING_CONFIRMATION'"
            assignments += ", updated_at=CURRENT_TIMESTAMP"
            cur.execute("UPDATE soap_clinical_actions SET " + assignments + " WHERE action_id=%s RETURNING " + ACTION_COLUMNS,
                        (*values, str(action_id)))
            updated = _row(cur, cur.fetchone())
        conn.commit()
        updated["stale"] = False
        return updated
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _confirm_one(cur, action, note, user):
    _ensure_mutable_action(action, note)
    error = _confirmation_error(cur, action)
    if error:
        return {"action_id": str(action["action_id"]), "success": False, "status": action["status"], "error": error}
    _set_actor(cur, user)
    cur.execute("""UPDATE soap_clinical_actions SET status='CONFIRMED', confirmed_by=%s,
                   confirmed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
                   WHERE action_id=%s RETURNING """ + ACTION_COLUMNS, (user["id"], str(action["action_id"])))
    updated = _row(cur, cur.fetchone())
    return {"action_id": str(updated["action_id"]), "success": True, "status": "CONFIRMED", "action": updated}


def confirm_action(action_id, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = _clinical_user(cur, token_user)
            initial = _action(cur, action_id)
            note = _note_access(cur, initial["soap_note_id"], user, lock=True, mutable=True)
            action = _action(cur, action_id, lock=True)
            result = _confirm_one(cur, action, note, user)
            if not result["success"]:
                raise HTTPException(422, result["error"])
        conn.commit()
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def reject_action(action_id, token_user, reason=None):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = _clinical_user(cur, token_user)
            initial = _action(cur, action_id)
            note = _note_access(cur, initial["soap_note_id"], user, lock=True, mutable=True)
            action = _action(cur, action_id, lock=True)
            _ensure_mutable_action(action, note)
            _set_actor(cur, user)
            cur.execute("UPDATE soap_clinical_actions SET status='REJECTED', error_message=%s, updated_at=CURRENT_TIMESTAMP WHERE action_id=%s RETURNING " + ACTION_COLUMNS, (reason[:500] if reason else None, str(action_id)))
            updated = _row(cur, cur.fetchone())
        conn.commit()
        return updated
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def confirm_batch(note_id, action_ids, token_user):
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            user = _clinical_user(cur, token_user)
            note = _note_access(cur, note_id, user, lock=True, mutable=True)
            unique_ids = list(dict.fromkeys(str(value) for value in action_ids))
            if not unique_ids:
                raise HTTPException(422, "Select at least one action to confirm.")
            placeholders = ",".join(["%s"] * len(unique_ids))
            cur.execute("SELECT action_id FROM soap_clinical_actions WHERE soap_note_id=%s AND action_id IN (" + placeholders + ") FOR UPDATE", (note_id, *unique_ids))
            found = {str(row[0]) for row in cur.fetchall()}
            if found != set(unique_ids):
                raise HTTPException(400, "Every selected action must belong to this SOAP note.")
            results = []
            for action_id in unique_ids:
                action = _action(cur, action_id)
                try:
                    results.append(_confirm_one(cur, action, note, user))
                except HTTPException as exc:
                    results.append({"action_id": action_id, "success": False, "status": action["status"], "error": str(exc.detail)})
        conn.commit()
        return {"soap_note_id": note_id, "results": results, "confirmed_count": sum(result["success"] for result in results)}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
