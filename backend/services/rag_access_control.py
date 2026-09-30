"""Central, server-side authorization policy for the clinical RAG pipeline."""

from dataclasses import dataclass
import hashlib
from typing import Any, Dict, FrozenSet, Iterable, Optional, Tuple


ACCESS_DENIED = "You don't have access to this information."

RADIOLOGY_MODULES: FrozenSet[str] = frozenset({
    "radiology_order", "radiology_ai", "radiology_report", "radiology_clarification"
})

DOCUMENT_MODULE = {
    "patient_admission_summary": "ip",
    "outpatient_roster_summary": "op",
    "diagnosis_summary": "diagnosis",
    "vital_trend_summary": "vitals",
    "medication_summary": "medications",
    "lab_result_summary": "lab",
    "procedure_summary": "procedures",
    "billing_clearance_summary": "bill",
    "doctor_patient_task_summary": "notes",
    "verified_discharge_summary": "discharge",
    "discharge_readiness_summary": "discharge",
    "xray_order": "radiology_order",
    "radiology_ai_result": "radiology_ai",
    "radiologist_final_report": "radiology_report",
    "radiology_clarification": "radiology_clarification",
}

DOCTOR_MODULES: FrozenSet[str] = frozenset(DOCUMENT_MODULE.values())


@dataclass(frozen=True)
class AccessContext:
    user_id: int
    role: str
    doctor_id: Optional[int]
    department: Optional[str]
    allowed_modules: Optional[FrozenSet[str]]
    allowed_patient_ids: Optional[FrozenSet[int]]
    session_id: Optional[str] = None
    trace_id: Optional[str] = None
    permission_version: str = "v1"

    @property
    def is_admin(self) -> bool:
        return self.role in {"admin", "hospital management"}

    def cache_key(self) -> Tuple[Any, ...]:
        return (self.user_id, self.role, self.scope_hash)

    @property
    def scope_hash(self) -> str:
        material = "|".join([
            str(self.user_id), self.role, str(self.doctor_id or ""), str(self.department or ""),
            ",".join(sorted(self.allowed_modules or ())),
            ",".join(str(v) for v in sorted(self.allowed_patient_ids or ())),
            self.permission_version,
        ])
        return hashlib.sha256(material.encode("utf-8")).hexdigest()

    def permits_source(self, source: Dict[str, Any]) -> bool:
        if self.is_admin:
            return True
        module = source.get("module") or DOCUMENT_MODULE.get(source.get("document_type"))
        if not module or self.allowed_modules is None or module not in self.allowed_modules:
            return False
        if self.role == "doctor":
            patient_id = source.get("patient_id")
            if patient_id is None and str(source.get("source_record_id") or "").startswith("authorized_"):
                return source.get("doctor_id") == self.doctor_id
            return patient_id is not None and patient_id in (self.allowed_patient_ids or frozenset())
        if self.role == "radiologist":
            source_department = source.get("department") or (source.get("metadata") or {}).get("department")
            if source_department and self.department and str(source_department).casefold() != str(self.department).casefold():
                return False
            return True
        return True


def build_access_context(user: Dict[str, Any], cur) -> AccessContext:
    """Build immutable access state solely from the authenticated server dependency."""
    try:
        user_id = int(user["user_id"])
    except (KeyError, TypeError, ValueError):
        raise PermissionError(ACCESS_DENIED)
    # JWT claims identify the session, but live DB state is authoritative for role,
    # active status, department and doctor mapping. This also makes role changes
    # effective without waiting for an old token to expire.
    cur.execute("""
        SELECT u.id, u.is_active, LOWER(r.name) AS role,
               COALESCE(dept.department_name, '') AS department, d.id AS doctor_id
        FROM users u JOIN roles r ON r.id=u.role_id
        LEFT JOIN doctors d ON d.user_id=u.id
        LEFT JOIN departments dept ON dept.id=COALESCE(d.department_id,u.department_id)
        WHERE u.id=%s
        LIMIT 1
    """, (user_id,))
    identity = cur.fetchone()
    if not identity:
        raise PermissionError(ACCESS_DENIED)
    identity = dict(identity) if isinstance(identity, dict) else {
        "id": identity[0], "is_active": identity[1], "role": identity[2],
        "department": identity[3], "doctor_id": identity[4],
    }
    if not identity.get("is_active"):
        raise PermissionError(ACCESS_DENIED)
    role = str(identity.get("role") or "").strip().lower()
    if not role:
        raise PermissionError(ACCESS_DENIED)
    department = identity.get("department") or None
    session_id = user.get("session_id") or user.get("jti")
    trace_id = user.get("trace_id")

    if role in {"admin", "hospital management"}:
        return AccessContext(user_id, role, None, department, None, None, session_id, trace_id)

    if role == "radiologist":
        if not department:
            raise PermissionError(ACCESS_DENIED)
        return AccessContext(user_id, role, identity.get("doctor_id"), department, RADIOLOGY_MODULES, None, session_id, trace_id)

    if role == "doctor":
        doctor_id = identity.get("doctor_id")
        if doctor_id is None:
            raise PermissionError(ACCESS_DENIED)
        doctor_id = int(doctor_id)
        cur.execute("""
            SELECT DISTINCT patient_id FROM (
                SELECT patient_id FROM admissions WHERE doctor_id = %s
                UNION SELECT patient_id FROM appointments WHERE doctor_id = %s
                UNION SELECT patient_id FROM pre_admissions WHERE doctor_id = %s
                UNION SELECT patient_id FROM dim_admission_inputs WHERE attending_doctor IN (
                    SELECT display_name FROM doctors WHERE id = %s
                )
            ) scoped WHERE patient_id IS NOT NULL
        """, (doctor_id, doctor_id, doctor_id, doctor_id))
        ids = frozenset(int(r.get("patient_id") if isinstance(r, dict) else r[0]) for r in cur.fetchall())
        return AccessContext(user_id, role, doctor_id, department, DOCTOR_MODULES, ids, session_id, trace_id)

    # The application has no canonical RAG permission mapping for other roles yet.
    raise PermissionError(ACCESS_DENIED)


def filter_sources(context: AccessContext, sources: Iterable[Dict[str, Any]]):
    return [s for s in sources if context.permits_source(s)]
