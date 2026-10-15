def historical_active_patient_exclusion(patient_alias: str, doctor_id: int | None) -> tuple[str, list[int]]:
    """Return the active-workload exclusion used by historical patient queries."""
    if patient_alias not in {"p", "patients"}:
        raise ValueError("Unsupported patient table alias")

    active_ip_doctor_filter = "AND active_ip.doctor_id = %s" if doctor_id is not None else ""
    active_op_doctor_filter = "AND active_op.doctor_id = %s" if doctor_id is not None else ""
    active_er_doctor_filter = "AND active_er_doctor.id = %s" if doctor_id is not None else ""
    params = [doctor_id] * 3 if doctor_id is not None else []
    patient_id = f"{patient_alias}.id"

    return f"""
        (
        NOT EXISTS (
            SELECT 1
            FROM admissions active_ip
            WHERE active_ip.patient_id = {patient_id}
              AND LOWER(COALESCE(active_ip.discharge_status, '')) IN ('admitted', 'ready')
              {active_ip_doctor_filter}
        )
        AND NOT EXISTS (
            SELECT 1
            FROM (
                SELECT
                    active_patient.id AS patient_id,
                    latest_appointment.doctor_id
                FROM patients active_patient
                LEFT JOIN LATERAL (
                    SELECT apt.id, apt.doctor_id
                    FROM appointments apt
                    WHERE apt.patient_id = active_patient.id
                    ORDER BY apt.id DESC
                    LIMIT 1
                ) latest_appointment ON TRUE
                WHERE active_patient.first_name NOT LIKE 'Patient'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM admissions active_admission
                      WHERE active_admission.patient_id = active_patient.id
                        AND active_admission.discharge_status IN ('Admitted', 'Ready')
                  )
                ORDER BY COALESCE(latest_appointment.id, active_patient.id) DESC
                LIMIT 250
            ) active_op
            WHERE active_op.patient_id = {patient_id}
              {active_op_doctor_filter}
        )
        AND NOT EXISTS (
            SELECT 1
            FROM emergency_triage active_er
            LEFT JOIN doctors active_er_doctor
              ON LOWER(BTRIM(active_er_doctor.display_name)) = LOWER(BTRIM(active_er.doctor_name))
            WHERE LOWER(BTRIM(active_er.patient_name)) =
                  LOWER(BTRIM(CONCAT_WS(' ', {patient_alias}.first_name, {patient_alias}.last_name)))
              {active_er_doctor_filter}
        )
        )
    """, params
