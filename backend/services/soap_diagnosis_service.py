"""Persist only clinician-confirmed AG-17 diagnosis actions."""

from fastapi import HTTPException


def _existing_diagnosis(cur, action_id):
    cur.execute("SELECT diagnosis_id FROM diagnoses WHERE source_action_id=%s", (str(action_id),))
    row = cur.fetchone()
    return row.get("diagnosis_id") if isinstance(row, dict) else (row[0] if row else None)


def _next_diagnosis_id(cur):
    cur.execute("LOCK TABLE diagnoses IN EXCLUSIVE MODE")
    cur.execute("""SELECT setval(pg_get_serial_sequence('diagnoses','diagnosis_id'),
                       GREATEST(COALESCE(MAX(diagnosis_id),1),1), MAX(diagnosis_id) IS NOT NULL)
                   FROM diagnoses""")
    cur.execute("SELECT nextval(pg_get_serial_sequence('diagnoses','diagnosis_id'))")
    row = cur.fetchone()
    return int(row[0] if not isinstance(row, dict) else next(iter(row.values())))


def create_confirmed_diagnosis(cur, note, action, doctor_id):
    """Create an idempotent diagnosis row after explicit action confirmation."""
    existing_id = _existing_diagnosis(cur, action["action_id"])
    if existing_id is not None:
        return {"diagnosis_id": int(existing_id), "source": "AG17", "source_action_id": action["action_id"]}, True
    name = str(action.get("name") or "").strip()
    if not name:
        raise ValueError("A confirmed diagnosis name is required.")
    if doctor_id is None:
        raise ValueError("Signing clinician could not be resolved.")
    diagnosis_id = _next_diagnosis_id(cur)
    cur.execute("""INSERT INTO diagnoses
                   (diagnosis_id,patient_id,visit_id,admission_id,doctor_id,diagnosis_code,
                    diagnosis_name,diagnosis_type,diagnosis_date,is_primary,source,
                    source_soap_note_id,source_action_id)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,'Confirmed',CURRENT_TIMESTAMP,FALSE,'AG17',%s,%s)
                   RETURNING diagnosis_id""",
                (diagnosis_id, note["patient_id"], note["visit_id"], note.get("admission_id"),
                 doctor_id, action.get("code"), name, note["soap_note_id"], str(action["action_id"])))
    row = cur.fetchone()
    diagnosis_id = int(row[0] if not isinstance(row, dict) else row["diagnosis_id"])
    return {"diagnosis_id": diagnosis_id, "patient_id": note["patient_id"],
            "visit_id": note["visit_id"], "admission_id": note.get("admission_id"),
            "source": "AG17", "source_action_id": action["action_id"]}, False
