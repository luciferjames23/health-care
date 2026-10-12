"""Order-scoped, append-only AG-10 fasting/NPO evidence API."""
from datetime import datetime
from typing import Literal
from uuid import UUID

import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

import db_config
from api.auth_helper import decode_token, security

router = APIRouter(
    prefix="/api/v1/diagnostic-coordination",
    tags=["AG-10 Diagnostic Preparation Evidence"],
)

READ_ROLES = {
    "doctor", "nurse", "laboratory", "pathologist", "radiologist", "admin",
    "system admin", "hospital management", "ai administrator", "it administrator", "auditor",
}
SOURCE_TYPES = {"PATIENT_REPORT", "CAREGIVER_REPORT", "CHART_REVIEW", "OTHER"}
ASSERTIONS = {"CONFIRMED", "NOT_CONFIRMED", "UNABLE_TO_CONFIRM"}


class FastingEvidenceCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assertion: Literal["CONFIRMED", "NOT_CONFIRMED", "UNABLE_TO_CONFIRM"]
    last_meal_at: datetime | None = None
    fasting_started_at: datetime | None = None
    source_type: Literal["PATIENT_REPORT", "CAREGIVER_REPORT", "CHART_REVIEW", "OTHER"]

    @field_validator("last_meal_at", "fasting_started_at")
    @classmethod
    def require_timezone(cls, value):
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("Times must include a timezone offset.")
        return value

    @model_validator(mode="after")
    def confirmed_requires_time(self):
        if self.assertion == "CONFIRMED" and not (self.last_meal_at or self.fasting_started_at):
            raise ValueError("A confirmed entry requires the last meal time or fasting start time.")
        return self


def get_authenticated_staff(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Require a signed session and re-check the active role in the database."""
    payload = decode_token(credentials.credentials) if credentials and credentials.credentials else None
    if not payload or not payload.get("user_id"):
        raise HTTPException(status_code=401, detail="Authentication required.", headers={"WWW-Authenticate": "Bearer"})

    try:
        with db_config.get_db_connection() as conn, conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, r.name, u.is_active,
                       COALESCE(d.display_name, u.staff_name, u.username)
                FROM users u
                JOIN roles r ON r.id = u.role_id
                LEFT JOIN doctors d ON d.user_id = u.id
                WHERE u.id = %s
            """, (payload["user_id"],))
            row = cur.fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Unable to verify access. Please retry.") from exc

    if not row or not row[2]:
        raise HTTPException(status_code=403, detail="No access. Account not found or inactive.")
    role = str(row[1] or "").strip().lower()
    if role not in READ_ROLES:
        raise HTTPException(status_code=403, detail="No access to diagnostic preparation evidence.")
    return {"user_id": row[0], "role": row[1], "name": row[3] or str(row[0])}


def _order_scope_sql(user: dict) -> tuple[str, list]:
    if str(user["role"]).strip().lower() != "doctor":
        return "", []
    return """ AND (
        o.requested_by = %s OR EXISTS (
            SELECT 1 FROM admissions a
            JOIN doctors d ON d.id = a.doctor_id
            WHERE a.patient_id = o.patient_id AND d.user_id = %s
              AND a.admission_id = (
                  SELECT a2.admission_id FROM admissions a2
                  WHERE a2.patient_id = o.patient_id
                  ORDER BY a2.admission_date DESC NULLS LAST, a2.admission_id DESC
                  LIMIT 1
              )
        )
    )""", [user["user_id"], user["user_id"]]


def _serialize_evidence(row):
    if not row.get("evidence_id"):
        return None
    return {
        "evidence_id": row["evidence_id"],
        "assertion": row["assertion"],
        "last_meal_at": row["last_meal_at"],
        "fasting_started_at": row["fasting_started_at"],
        "source_type": row["source_type"],
        "recorded_by_user_id": row["recorded_by_user_id"],
        "recorded_by_role": row["recorded_by_role"],
        "recorded_by_name": row["recorded_by_name"],
        "recorded_at": row["recorded_at"],
    }


@router.get("/fasting-evidence")
def get_fasting_evidence(
    order_ids: list[UUID] = Query(..., min_length=1, max_length=100),
    user: dict = Depends(get_authenticated_staff),
):
    """Return latest evidence for each supplied order; this handler performs SELECTs only."""
    unique_ids = list(dict.fromkeys(order_ids))
    if len(unique_ids) != len(order_ids):
        raise HTTPException(status_code=422, detail="Duplicate order IDs are not allowed.")
    scope_sql, scope_params = _order_scope_sql(user)
    sql = """
        SELECT o.order_id, o.patient_id,
               e.evidence_id, e.assertion, e.last_meal_at, e.fasting_started_at,
               e.source_type, e.recorded_by_user_id, e.recorded_by_role,
               e.recorded_by_name, e.recorded_at
        FROM radiology_orders o
        LEFT JOIN LATERAL (
            SELECT evidence_id, assertion, last_meal_at, fasting_started_at,
                   source_type, recorded_by_user_id, recorded_by_role,
                   recorded_by_name, recorded_at
            FROM diagnostic_preparation_evidence
            WHERE order_id = o.order_id
            ORDER BY recorded_at DESC, evidence_id DESC
            LIMIT 1
        ) e ON TRUE
        WHERE o.order_id = ANY(%s::uuid[])
    """ + scope_sql + " ORDER BY o.order_id"
    conn = db_config.get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, [[str(order_id) for order_id in unique_ids], *scope_params])
            rows = cur.fetchall()
        if len(rows) != len(unique_ids):
            raise HTTPException(status_code=404, detail="One or more orders were not found or are not accessible.")
        return {
            "data": [
                {
                    "order_id": str(row["order_id"]),
                    "patient_id": row["patient_id"],
                    "latest_evidence": _serialize_evidence(row),
                }
                for row in rows
            ]
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Fasting/NPO evidence is unavailable.") from exc
    finally:
        conn.close()


@router.post("/orders/{order_id}/fasting-evidence", status_code=201)
def create_fasting_evidence(
    order_id: UUID,
    body: FastingEvidenceCreate,
    user: dict = Depends(get_authenticated_staff),
):
    """Append a Nurse's explicit fasting/NPO evidence without modifying the order."""
    if str(user["role"]).strip().lower() != "nurse":
        raise HTTPException(status_code=403, detail="Only authenticated Nurse users may record this evidence.")

    scope_sql, scope_params = _order_scope_sql(user)
    conn = db_config.get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT o.order_id, o.patient_id FROM radiology_orders o WHERE o.order_id = %s" + scope_sql,
                [str(order_id), *scope_params],
            )
            order = cur.fetchone()
            if not order:
                raise HTTPException(status_code=404, detail="Order not found or not accessible.")
            cur.execute("""
                INSERT INTO diagnostic_preparation_evidence (
                    order_id, assertion, last_meal_at, fasting_started_at, source_type,
                    recorded_by_user_id, recorded_by_role, recorded_by_name
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING evidence_id, assertion, last_meal_at, fasting_started_at,
                          source_type, recorded_by_user_id, recorded_by_role,
                          recorded_by_name, recorded_at
            """, (
                order["order_id"], body.assertion, body.last_meal_at,
                body.fasting_started_at, body.source_type, user["user_id"],
                user["role"], user["name"],
            ))
            evidence = cur.fetchone()
        conn.commit()
        return {
            "order_id": str(order["order_id"]),
            "patient_id": order["patient_id"],
            "evidence": _serialize_evidence(evidence),
        }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=503, detail="Unable to record fasting/NPO evidence.") from exc
    finally:
        conn.close()
