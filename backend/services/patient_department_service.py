PATIENT_CARE_DEPARTMENTS = (
    "Surgery",
    "Emergency",
    "Intensive Care Unit",
    "Pharmacy",
    "Oncology",
    "General Medicine",
    "Cardiology",
    "Pediatrics",
    "Orthopedics",
    "Dermatology",
    "ENT",
    "Gynecology",
    "Neurology",
    "Radiology",
    "Billing & Cashier",
    "Finance & Accounts",
    "Insurance & TPA",
    "Pathology",
    "Central Stores",
    "Procurement",
    "Dietary Services",
)

_PATIENT_CARE_DEPARTMENTS_SQL = ", ".join(
    f"'{department}'" for department in PATIENT_CARE_DEPARTMENTS
)


def patient_department_expression(department_alias: str, doctor_department_alias: str) -> str:
    """Resolve an encounter's department to the configured patient-care department list."""
    return f"""
        CASE
            WHEN BTRIM(COALESCE({department_alias}.department_name, '')) IN ({_PATIENT_CARE_DEPARTMENTS_SQL})
                THEN BTRIM({department_alias}.department_name)
            WHEN LOWER(BTRIM(COALESCE({department_alias}.department_name, ''))) = 'laboratory'
                THEN 'Pathology'
            WHEN BTRIM(COALESCE({doctor_department_alias}.department_name, '')) IN ({_PATIENT_CARE_DEPARTMENTS_SQL})
                THEN BTRIM({doctor_department_alias}.department_name)
            WHEN LOWER(BTRIM(COALESCE({doctor_department_alias}.department_name, ''))) = 'laboratory'
                THEN 'Pathology'
            ELSE 'General Medicine'
        END
    """
