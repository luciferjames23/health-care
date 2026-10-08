"""Writes observations to the hospital's authoritative vital_signs model."""


def _value(row, key, index=0):
    return row.get(key) if isinstance(row, dict) else row[index]


def record_vital_observation(cur, *, patient_id, visit_id=None, admission_id=None, recorded_by,
                             temperature=None, heart_rate=None, systolic_bp=None, diastolic_bp=None,
                             respiratory_rate=None, oxygen_saturation=None, weight=None,
                             source=None, source_soap_note_id=None, source_action_id=None):
    if source_action_id:
        cur.execute("SELECT vital_id FROM vital_signs WHERE source_action_id=%s", (str(source_action_id),))
        existing = cur.fetchone()
        if existing:
            return {"vital_id": int(_value(existing, "vital_id")), "source_action_id": str(source_action_id)}, True

    cur.execute("SELECT patient_code FROM patients WHERE id=%s", (patient_id,))
    patient = cur.fetchone()
    patient_code = _value(patient, "patient_code") if patient else None
    cur.execute("""
        INSERT INTO vital_signs (
            vital_id, patient_id, patient_code, visit_id, admission_id, recorded_by, recorded_at,
            temperature, heart_rate, systolic_bp, diastolic_bp, respiratory_rate, oxygen_saturation,
            weight, source, source_soap_note_id, source_action_id
        ) VALUES (
            nextval(pg_get_serial_sequence('vital_signs','vital_id')),
            %s,%s,%s,%s,%s,CURRENT_TIMESTAMP,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
        ) RETURNING vital_id, recorded_at
    """, (
        patient_id, patient_code, visit_id, admission_id, recorded_by,
        temperature, heart_rate, systolic_bp, diastolic_bp, respiratory_rate,
        oxygen_saturation, weight, source, source_soap_note_id,
        str(source_action_id) if source_action_id else None,
    ))
    row = cur.fetchone()
    return {"vital_id": int(_value(row, "vital_id")), "recorded_at": _value(row, "recorded_at", 1),
            "source_action_id": str(source_action_id) if source_action_id else None}, False


def create_confirmed_soap_vital(cur, note, action, clinician_id):
    finding_type = action.get("finding_type")
    unit = action.get("unit")
    value = action.get("value")
    systolic = action.get("systolic")
    diastolic = action.get("diastolic")
    measurement = {"temperature": None, "heart_rate": None, "systolic_bp": None,
                   "diastolic_bp": None, "oxygen_saturation": None}
    if finding_type == "TEMPERATURE":
        if value is None or unit != "F":
            raise ValueError("The existing vital_signs workflow stores temperature in Fahrenheit; Celsius was not converted.")
        measurement["temperature"] = value
    elif finding_type == "BLOOD_PRESSURE":
        if systolic is None or diastolic is None or unit != "mmHg":
            raise ValueError("Blood pressure requires systolic and diastolic values in mmHg.")
        measurement.update(systolic_bp=systolic, diastolic_bp=diastolic)
    elif finding_type == "PULSE":
        if value is None or unit != "bpm":
            raise ValueError("Pulse requires a value in bpm.")
        measurement["heart_rate"] = value
    elif finding_type == "SPO2":
        if value is None or unit != "%":
            raise ValueError("Oxygen saturation requires a value in percent.")
        measurement["oxygen_saturation"] = value
    else:
        raise ValueError("Unsupported structured vital finding.")

    return record_vital_observation(
        cur, patient_id=note["patient_id"], visit_id=note["visit_id"],
        admission_id=note.get("admission_id"), recorded_by=clinician_id,
        source="AG17", source_soap_note_id=note["soap_note_id"],
        source_action_id=action["action_id"], **measurement,
    )
