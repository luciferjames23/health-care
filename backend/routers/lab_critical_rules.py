"""AG-10 governed Lab critical-value rule catalog.

This router manages rule configuration only. It never reads or evaluates
lab_results and never creates alerts or notifications.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, root_validator, validator

from api.auth_helper import decode_token, security
from db.postgres_connector import PostgresConnector

router = APIRouter(prefix="/api/v1/admin/lab-critical-rules", tags=["Lab Critical Rule Governance"])
db_connector = PostgresConnector()

AUTHOR_ROLE = "lab rule author"
APPROVER_ROLE = "lab rule approver"
READER_ROLES = {AUTHOR_ROLE, APPROVER_ROLE, "auditor"}


class RuleDraft(BaseModel):
    class Config:
        extra = "forbid"

    parameter_name: str = Field(..., min_length=1, max_length=255)
    test_identifier: str | None = Field(None, max_length=100)
    unit: str = Field(..., min_length=1, max_length=64)
    operator: Literal["LT", "LTE", "GT", "GTE", "EQ", "INSIDE_RANGE", "OUTSIDE_RANGE"]
    threshold_value: Decimal | None = None
    lower_critical_bound: Decimal | None = None
    upper_critical_bound: Decimal | None = None
    is_active: bool = False
    effective_from: datetime
    effective_to: datetime | None = None
    source_provenance: str = Field(..., min_length=1, max_length=2000)
    change_reason: str = Field(..., min_length=1, max_length=2000)

    @validator("parameter_name", "unit", "source_provenance", "change_reason")
    def strip_required_text(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value

    @validator("test_identifier")
    def strip_optional_identifier(cls, value):
        return value.strip() or None if value is not None else None

    @validator("threshold_value", "lower_critical_bound", "upper_critical_bound")
    def finite_decimal(cls, value):
        if value is not None and not value.is_finite():
            raise ValueError("Thresholds must be finite numeric values")
        return value

    @validator("effective_from", "effective_to")
    def require_timezone(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError("Effective timestamps must include a timezone")
        return value

    @root_validator(skip_on_failure=True)
    def validate_rule_shape(cls, values):
        operator = values.get("operator")
        threshold = values.get("threshold_value")
        lower = values.get("lower_critical_bound")
        upper = values.get("upper_critical_bound")
        if operator in {"INSIDE_RANGE", "OUTSIDE_RANGE"}:
            if threshold is not None or lower is None or upper is None or lower > upper:
                raise ValueError("Range operators require ordered lower and upper bounds and no single threshold")
        elif operator and (threshold is None or lower is not None or upper is not None):
            raise ValueError("A comparison operator requires one threshold and no bounds")
        start, end = values.get("effective_from"), values.get("effective_to")
        if start is not None and end is not None and end <= start:
            raise ValueError("effective_to must be later than effective_from")
        return values


class RejectionBody(BaseModel):
    class Config:
        extra = "forbid"

    reason: str = Field(..., min_length=1, max_length=2000)

    @validator("reason")
    def strip_reason(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Reason must not be blank")
        return value


def require_rule_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Require a real signed-in account and revalidate active role in the DB."""
    payload = decode_token(credentials.credentials) if credentials and credentials.credentials else None
    if not payload or not payload.get("user_id") or str(payload.get("auth_method", "")).lower() in {
        "demo", "development-fallback"
    }:
        raise HTTPException(status_code=401, detail="A verified user session is required.", headers={"WWW-Authenticate": "Bearer"})
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT u.id AS user_id, u.is_active, r.name AS role,
                   COALESCE(u.staff_name, u.username) AS display_name
              FROM users u JOIN roles r ON r.id=u.role_id
             WHERE u.id=%s
        """, (payload["user_id"],))
        user = cur.fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Unable to verify rule governance access.") from exc
    finally:
        conn.close()
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=403, detail="Account is not active or no longer exists.")
    return {"user_id": int(user["user_id"]), "role": str(user["role"] or "").strip().lower(),
            "display_name": user.get("display_name") or str(user["user_id"])}


def require_reader(user=Depends(require_rule_user)):
    if user["role"] not in READER_ROLES:
        raise HTTPException(status_code=403, detail="Lab critical-rule governance access is required.")
    return user


def require_author(user=Depends(require_rule_user)):
    if user["role"] != AUTHOR_ROLE:
        raise HTTPException(status_code=403, detail="Lab rule author authorization is required.")
    return user


def require_approver(user=Depends(require_rule_user)):
    if user["role"] != APPROVER_ROLE:
        raise HTTPException(status_code=403, detail="Lab rule approver authorization is required.")
    return user


def _db_error(conn, message: str, status: int = 503):
    conn.rollback()
    raise HTTPException(status_code=status, detail=message)


@router.get("")
def list_rules(
    approval_status: str | None = Query(None, pattern="^(DRAFT|PENDING_APPROVAL|APPROVED|REJECTED|RETIRED)$"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user=Depends(require_reader),
):
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT rule_id, parameter_name, test_identifier, unit, operator,
                   threshold_value, lower_critical_bound, upper_critical_bound,
                   is_active, effective_from, effective_to, rule_version,
                   approval_status, approved_by, approved_at, created_by, created_at,
                   source_provenance, change_reason, decision_reason
              FROM lab_critical_rules
             WHERE (%s::VARCHAR IS NULL OR approval_status=%s::VARCHAR)
             ORDER BY LOWER(parameter_name), unit, rule_version DESC, rule_id DESC
             LIMIT %s OFFSET %s
        """, (approval_status, approval_status, limit, offset))
        return {"rules": cur.fetchall(), "limit": limit, "offset": offset}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Lab critical-rule catalog is unavailable.") from exc
    finally:
        conn.close()


@router.get("/{rule_id}")
def get_rule(rule_id: int, user=Depends(require_reader)):
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT * FROM lab_critical_rules WHERE rule_id=%s", (rule_id,))
        rule = cur.fetchone()
        if not rule:
            raise HTTPException(status_code=404, detail="Lab critical-rule version not found.")
        return {"rule": rule}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Lab critical-rule catalog is unavailable.") from exc
    finally:
        conn.close()


@router.post("", status_code=201)
def create_draft(body: RuleDraft, user=Depends(require_author)):
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(LOWER(%s)), hashtext(%s))", (body.parameter_name, body.unit))
        cur.execute("""
            SELECT COALESCE(MAX(rule_version), 0) + 1 AS next_version
              FROM lab_critical_rules
             WHERE LOWER(parameter_name)=LOWER(%s) AND unit=%s
        """, (body.parameter_name, body.unit))
        version = cur.fetchone()["next_version"]
        cur.execute("""
            INSERT INTO lab_critical_rules (
                parameter_name, test_identifier, unit, operator, threshold_value,
                lower_critical_bound, upper_critical_bound, is_active,
                effective_from, effective_to, rule_version, approval_status,
                created_by, source_provenance, change_reason
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'DRAFT',%s,%s,%s)
            RETURNING *
        """, (body.parameter_name, body.test_identifier, body.unit, body.operator,
              body.threshold_value, body.lower_critical_bound, body.upper_critical_bound,
              body.is_active, body.effective_from, body.effective_to, version,
              user["user_id"], body.source_provenance, body.change_reason))
        rule = cur.fetchone()
        conn.commit()
        return {"rule": rule}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        _db_error(conn, "Unable to create Lab critical-rule draft.")
    finally:
        conn.close()


@router.post("/{rule_id}/submit")
def submit_rule(rule_id: int, user=Depends(require_author)):
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            UPDATE lab_critical_rules SET approval_status='PENDING_APPROVAL'
             WHERE rule_id=%s AND created_by=%s AND approval_status='DRAFT'
             RETURNING *
        """, (rule_id, user["user_id"]))
        rule = cur.fetchone()
        if not rule:
            cur.execute("SELECT rule_id FROM lab_critical_rules WHERE rule_id=%s", (rule_id,))
            exists = cur.fetchone()
            conn.rollback()
            raise HTTPException(status_code=404 if not exists else 409,
                                detail="Rule not found." if not exists else "Only your draft rule can be submitted.")
        conn.commit()
        return {"rule": rule}
    except HTTPException:
        raise
    except Exception as exc:
        _db_error(conn, "Unable to submit Lab critical-rule draft.")
    finally:
        conn.close()


@router.post("/{rule_id}/approve")
def approve_rule(rule_id: int, user=Depends(require_approver)):
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT created_by, approval_status FROM lab_critical_rules WHERE rule_id=%s", (rule_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Lab critical-rule version not found.")
        if int(existing["created_by"]) == user["user_id"]:
            raise HTTPException(status_code=403, detail="Rule authors cannot approve their own rule.")
        if existing["approval_status"] != "PENDING_APPROVAL":
            raise HTTPException(status_code=409, detail="Only a submitted rule can be approved.")
        cur.execute("""
            UPDATE lab_critical_rules
               SET approval_status='APPROVED',
                   approved_by=%s, approved_at=%s
             WHERE rule_id=%s AND approval_status='PENDING_APPROVAL'
             RETURNING *
        """, (user["user_id"], datetime.now(timezone.utc), rule_id))
        rule = cur.fetchone()
        conn.commit()
        return {"rule": rule}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        message = str(exc).lower()
        if "overlap" in message or "already overlaps" in message:
            _db_error(conn, "An approved rule already overlaps this parameter and unit interval.", 409)
        _db_error(conn, "Unable to approve Lab critical-rule version.")
    finally:
        conn.close()


@router.post("/{rule_id}/reject")
def reject_rule(rule_id: int, body: RejectionBody, user=Depends(require_approver)):
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("SELECT created_by, approval_status FROM lab_critical_rules WHERE rule_id=%s", (rule_id,))
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Lab critical-rule version not found.")
        if int(existing["created_by"]) == user["user_id"]:
            raise HTTPException(status_code=403, detail="Rule authors cannot decide their own rule.")
        if existing["approval_status"] != "PENDING_APPROVAL":
            raise HTTPException(status_code=409, detail="Only a submitted rule can be rejected.")
        cur.execute("""
            UPDATE lab_critical_rules SET approval_status='REJECTED', decision_reason=%s
             WHERE rule_id=%s AND approval_status='PENDING_APPROVAL' RETURNING *
        """, (body.reason, rule_id))
        rule = cur.fetchone()
        conn.commit()
        return {"rule": rule}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        _db_error(conn, "Unable to reject Lab critical-rule version.")
    finally:
        conn.close()


@router.post("/{rule_id}/retire")
def retire_rule(rule_id: int, user=Depends(require_approver)):
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            UPDATE lab_critical_rules SET approval_status='RETIRED', is_active=FALSE
             WHERE rule_id=%s AND approval_status='APPROVED' RETURNING *
        """, (rule_id,))
        rule = cur.fetchone()
        if not rule:
            cur.execute("SELECT rule_id FROM lab_critical_rules WHERE rule_id=%s", (rule_id,))
            exists = cur.fetchone()
            conn.rollback()
            raise HTTPException(status_code=404 if not exists else 409,
                                detail="Rule not found." if not exists else "Only an approved rule can be retired.")
        conn.commit()
        return {"rule": rule}
    except HTTPException:
        raise
    except Exception:
        _db_error(conn, "Unable to retire Lab critical-rule version.")
    finally:
        conn.close()
