"""Create one AG-17 prescription using the existing medication catalog."""
import re

from services.soap_action_workflow_service import _row


_STRENGTH_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*(mcg|μg|ug|mg|g|ml|iu|unit|units)\b", re.I)
_UNIT_MAP = {"μg": "mcg", "ug": "mcg", "units": "unit"}
_PRODUCT_STRENGTH_RE = re.compile(r"^(\d+(?:\.\d+)?)\s*(mcg|μg|ug|mg|g|ml|iu|unit|units)?$", re.I)


def _normal_name(value):
    return re.sub(r"[^a-z0-9.]+", " ", str(value or "").casefold()).strip()


def _product_matches_request(row, name, dose, unit):
    requested_name = _normal_name(name)
    for field in ("medication_name", "generic_name", "brand_name"):
        catalog_name = _normal_name(row.get(field))
        if catalog_name == requested_name:
            return True
        if not catalog_name.startswith(requested_name + " "):
            continue
        suffix = catalog_name[len(requested_name):].strip()
        match = _PRODUCT_STRENGTH_RE.fullmatch(suffix)
        if not match:
            continue
        suffix_unit = _UNIT_MAP.get(str(match.group(2) or "").casefold(), str(match.group(2) or "").casefold())
        if float(match.group(1)) == float(dose) and (not suffix_unit or suffix_unit == unit):
            return True
    return False


def resolve_medication(cur, action):
    name = str(action.get("name") or "").strip()
    if not name or action.get("dose") is None or not action.get("unit"):
        return None
    cur.execute("""SELECT medication_id, medication_name, generic_name, brand_name, strength
                   FROM medications
                   WHERE (lower(trim(COALESCE(medication_name,'')))=lower(%s)
                       OR lower(trim(COALESCE(generic_name,'')))=lower(%s)
                       OR lower(trim(COALESCE(brand_name,'')))=lower(%s)
                       OR lower(trim(COALESCE(medication_name,''))) LIKE lower(%s)
                       OR lower(trim(COALESCE(generic_name,''))) LIKE lower(%s)
                       OR lower(trim(COALESCE(brand_name,''))) LIKE lower(%s))
                     AND lower(COALESCE(status,'active')) NOT IN ('inactive','discontinued','deleted')
                   ORDER BY medication_id""", (name, name, name, f"{name} %", f"{name} %", f"{name} %"))
    rows = [_row(cur, row) for row in cur.fetchall()]
    requested_unit = _UNIT_MAP.get(str(action.get("unit") or "").casefold(), str(action.get("unit") or "").casefold())
    compatible = []
    for row in rows:
        strength = _STRENGTH_RE.fullmatch(str(row.get("strength") or "").strip())
        if not strength or not _product_matches_request(row, name, action["dose"], requested_unit):
            continue
        catalog_unit = _UNIT_MAP.get(strength.group(2).casefold(), strength.group(2).casefold())
        try:
            if float(strength.group(1)) != float(action["dose"]) or catalog_unit != requested_unit:
                continue
        except (TypeError, ValueError):
            continue
        compatible.append(row)
    return compatible[0] if len(compatible) == 1 else None


def _next_id(cur, table, column):
    # Existing creation paths insert explicit IDs, so align the sequence under
    # an exclusive table lock before allocating a collision-free identifier.
    cur.execute(f"LOCK TABLE {table} IN EXCLUSIVE MODE")
    cur.execute(
        f"SELECT setval(pg_get_serial_sequence(%s,%s), GREATEST(COALESCE(MAX({column}),1),1), MAX({column}) IS NOT NULL) FROM {table}",
        (table, column),
    )
    cur.execute("SELECT nextval(pg_get_serial_sequence(%s,%s))", (table, column))
    return int(cur.fetchone()[0])


def _existing_prescription(cur, action_id):
    cur.execute("SELECT * FROM prescriptions WHERE source_action_id=%s", (str(action_id),))
    return _row(cur, cur.fetchone())


def create_prescription(cur, note, action, doctor_id):
    """Insert a prescription and item; never create a sale or dispense it."""
    existing = _existing_prescription(cur, action["action_id"])
    if existing:
        return existing, True
    if not action.get("name") or action.get("dose") is None or not action.get("unit"):
        raise ValueError("Medication order incomplete: a medication name, dose, and unit are required.")
    medication = resolve_medication(cur, action)
    if not medication:
        raise ValueError("Medication could not be resolved.")
    if doctor_id is None:
        raise ValueError("Ordering clinician could not be resolved.")

    prescription_id = _next_id(cur, "prescriptions", "prescription_id")
    cur.execute("""INSERT INTO prescriptions
                   (prescription_id,patient_id,doctor_id,visit_id,admission_id,prescription_date,status,
                    source,source_soap_note_id,source_action_id)
                   VALUES (%s,%s,%s,%s,%s,CURRENT_TIMESTAMP,'Active','AG17',%s,%s)
                   RETURNING prescription_id""",
                (prescription_id, note["patient_id"], doctor_id, note["visit_id"], note.get("admission_id"),
                 note["soap_note_id"], str(action["action_id"])))
    prescription_id = int(cur.fetchone()[0])
    item_id = _next_id(cur, "prescription_items", "prescription_item_id")
    dose = f"{action['dose']:g} {action['unit']}" if isinstance(action["dose"], (float, int)) else f"{action['dose']} {action['unit']}"
    cur.execute("""INSERT INTO prescription_items
                   (prescription_item_id,prescription_id,medication_id,dosage,frequency,route,duration,quantity,instructions)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,NULL,NULL)""",
                (item_id, prescription_id, medication["medication_id"], dose,
                 action.get("frequency"), action.get("route"), action.get("duration")))
    return ({"prescription_id": prescription_id, "patient_id": note["patient_id"], "visit_id": note["visit_id"],
             "doctor_id": doctor_id, "source": "AG17", "source_action_id": action["action_id"]}, False)
