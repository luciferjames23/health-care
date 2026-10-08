"""Dispatch signed, confirmed AG-17 medication and laboratory actions.

This service creates prescription and lab request records only. It does not
dispense medication or fabricate laboratory results.
"""
import json

import db_config
from fastapi import HTTPException

from services import soap_note_service as notes
from services.soap_lab_order_service import create_lab_order
from services.soap_prescription_service import create_prescription
from services.soap_diagnosis_service import create_confirmed_diagnosis
from services.vital_signs_service import create_confirmed_soap_vital
from services.soap_action_workflow_service import ACTION_COLUMNS, _clinical_user, _fingerprint, _row, _set_actor




def _is_confirmed_for_dispatch(action):
    return action.get("status") == "CONFIRMED" and action.get("confirmed_by") is not None and action.get("confirmed_at") is not None


def _doctor_id_for_user(cur, user_id):
    """Resolve the downstream doctor FK using doctors.id (the table PK)."""
    cur.execute("SELECT id FROM doctors WHERE user_id=%s LIMIT 1", (user_id,))
    doctor_row = cur.fetchone()
    if isinstance(doctor_row, dict):
        return doctor_row.get("id")
    return doctor_row[0] if doctor_row else None


def _event(cur, action, actor_id, event_type, *, error=None, target_module=None, target_id=None):
    data = {
        "soap_note_id": action["soap_note_id"],
        "action_id": str(action["action_id"]),
        "target_module": target_module if target_module is not None else action.get("target_module"),
        "target_record_id": target_id if target_id is not None else action.get("target_record_id"),
        "error": error,
    }
    snapshot = json.dumps(action, default=str)
    cur.execute("""INSERT INTO soap_clinical_action_events
                   (action_id,event_type,old_status,new_status,changed_by,old_values,new_values,event_data)
                   VALUES (%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb)""",
                (str(action["action_id"]), event_type, action["status"], action["status"], actor_id,
                 snapshot, snapshot, json.dumps(data)))


def _mark_failed(cur, action, actor_id, target_module, error):
    _set_actor(cur, {"id": actor_id})
    cur.execute("""UPDATE soap_clinical_actions SET status='FAILED',target_module=%s,
                   target_record_id=NULL,error_message=%s,updated_at=CURRENT_TIMESTAMP
                   WHERE action_id=%s RETURNING """ + ACTION_COLUMNS,
                (target_module, str(error)[:1000], str(action["action_id"])))
    return _row(cur, cur.fetchone())


def _mark_created(cur, action, actor_id, target_module, target):
    target_ids = {
        "prescriptions": "prescription_id",
        "lab_orders": "lab_order_id",
        "radiology_orders": "order_id",
        "diagnoses": "diagnosis_id",
        "vital_signs": "vital_id",
    }
    target_id = target.get(target_ids[target_module])
    _set_actor(cur, {"id": actor_id})
    cur.execute("""UPDATE soap_clinical_actions SET status='CREATED',target_module=%s,
                   target_record_id=%s,error_message=NULL,updated_at=CURRENT_TIMESTAMP
                   WHERE action_id=%s RETURNING """ + ACTION_COLUMNS,
                (target_module, str(target_id), str(action["action_id"])))
    return _row(cur, cur.fetchone()), target_id


def _create_imaging_order(cur, note, action, doctor_id):
    """Route imaging through the existing validated API workflow helper."""
    import uuid
    import psycopg2.extras
    from routers.imaging_orders import NewOrder, create_order_record

    projection = action.get("projection")
    if str(action.get("name") or "").casefold() != "chest x-ray" or projection not in {"PA", "AP"}:
        raise ValueError("Select a supported chest X-ray projection before dispatch.")
    indication = str(action.get("clinical_indication") or "").strip()
    if len(indication) < 3:
        raise ValueError("A concise clinical indication is required before dispatch.")
    body = NewOrder(
        patient_id=int(note["patient_id"]),
        examination=f"Chest X-ray {projection}",
        indication=indication,
        priority="Urgent" if action.get("priority") in {"URGENT", "STAT"} else "Routine",
        request_id=uuid.UUID(str(action["action_id"])),
    )
    request_user = {"user_id": int(note["signed_by"]), "role": "doctor"}
    with cur.connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as image_cur:
        order = create_order_record(image_cur, body, request_user, {
            "visit_id": int(note["visit_id"]),
            "admission_id": int(note["admission_id"]) if note.get("admission_id") is not None else None,
            "soap_note_id": int(note["soap_note_id"]),
            "action_id": str(action["action_id"]),
        })
    return {"order_id": str(order["order_id"]), "source": "AG17",
            "source_action_id": str(action["action_id"])}, False


def dispatch_confirmed_actions(note_id, token_user):
    """Dispatch eligible medication/lab actions for an already signed note.

    Each action uses a savepoint, so one failed downstream insert does not undo
    the SOAP signature or a different action's successful order.
    """
    conn = db_config.get_db_connection()
    try:
        with conn.cursor() as cur:
            actor = _clinical_user(cur, token_user)
            note = notes.get_note(cur, note_id)
            notes.validate_context(cur, note["patient_id"], note["visit_id"], note.get("admission_id"))
            if (note["author_user_id"] != actor["id"] and note.get("signed_by") != actor["id"]
                    and str(actor.get("role", "")).lower() not in {"admin", "hospital management"}):
                raise HTTPException(403, "Only the note author, signing clinician, or an administrator may dispatch these actions.")
            if note["status"] != "SIGNED":
                raise HTTPException(409, "Downstream actions can be dispatched only after SOAP signing succeeds.")
            doctor_id = _doctor_id_for_user(cur, note.get("signed_by"))
            cur.execute("SELECT " + ACTION_COLUMNS + " FROM soap_clinical_actions WHERE soap_note_id=%s AND status IN ('CONFIRMED','FAILED') AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL ORDER BY created_at, action_id FOR UPDATE", (note_id,))
            actions = [_row(cur, row) for row in cur.fetchall()]
            fingerprint = _fingerprint(note.get("raw_transcript"))
            results = []
            for index, action in enumerate(actions):
                if action.get("transcript_fingerprint") != fingerprint:
                    results.append({"action_id": str(action["action_id"]), "status": action["status"], "outcome": "SKIPPED", "error": "Stale action: transcript changed after detection."})
                    continue
                if action["status"] == "FAILED":
                    cur.execute("SELECT 1 FROM soap_clinical_action_events WHERE action_id=%s AND event_type='DISPATCH_FAILED' LIMIT 1", (str(action["action_id"]),))
                    if not cur.fetchone():
                        continue
                    _set_actor(cur, actor)
                    cur.execute("UPDATE soap_clinical_actions SET status='CONFIRMED',error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE action_id=%s RETURNING " + ACTION_COLUMNS, (str(action["action_id"]),))
                    action = _row(cur, cur.fetchone())
                if not _is_confirmed_for_dispatch(action):
                    results.append({"action_id": str(action["action_id"]), "status": action["status"], "outcome": "SKIPPED", "error": "Only clinician-confirmed actions can be dispatched."})
                    continue
                if action["action_type"] == "MEDICATION_ORDER":
                    module, save = "prescriptions", create_prescription
                elif action["action_type"] == "LAB_ORDER":
                    module, save = "lab_orders", create_lab_order
                elif action["action_type"] == "DIAGNOSIS_CANDIDATE":
                    module, save = "diagnoses", create_confirmed_diagnosis
                elif action["action_type"] == "CLINICAL_FINDING" and action.get("finding_type") in {"TEMPERATURE", "BLOOD_PRESSURE", "PULSE", "SPO2"}:
                    module, save = "vital_signs", lambda cur, note, action, doctor_id: create_confirmed_soap_vital(cur, note, action, actor["id"])
                elif action["action_type"] == "IMAGING_ORDER":
                    module = "radiology_orders"
                    save = _create_imaging_order
                else:
                    reason = f"Not dispatched — {action['action_type'].replace('_', ' ').lower()} integration is not implemented."
                    _set_actor(cur, actor)
                    cur.execute("UPDATE soap_clinical_actions SET error_message=%s,updated_at=CURRENT_TIMESTAMP WHERE action_id=%s",
                                (reason, str(action["action_id"])))
                    results.append({"action_id": str(action["action_id"]), "status": "CONFIRMED", "outcome": "NOT_DISPATCHED", "error": reason})
                    continue

                _event(cur, action, actor["id"], "DISPATCH_STARTED", target_module=module)
                cur.execute("SAVEPOINT ag17_dispatch_%s" % index)
                try:
                    target, idempotent_existing = save(cur, note, action, doctor_id)
                    updated, target_id = _mark_created(cur, action, actor["id"], module, target)
                    cur.execute("RELEASE SAVEPOINT ag17_dispatch_%s" % index)
                    results.append({"action_id": str(action["action_id"]), "status": "CREATED", "outcome": "CREATED", "target_module": module, "target_record_id": str(target_id), "idempotent_existing": idempotent_existing})
                except Exception as exc:
                    cur.execute("ROLLBACK TO SAVEPOINT ag17_dispatch_%s" % index)
                    updated = _mark_failed(cur, action, actor["id"], module, exc)
                    cur.execute("RELEASE SAVEPOINT ag17_dispatch_%s" % index)
                    results.append({"action_id": str(action["action_id"]), "status": "FAILED", "outcome": "FAILED", "target_module": module, "error": str(exc)[:1000], "retryable": True})
            conn.commit()
        return {"soap_note_id": note_id, "success": all(item["outcome"] in {"CREATED", "NOT_DISPATCHED", "SKIPPED"} for item in results), "results": results}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
