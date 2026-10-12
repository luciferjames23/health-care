"""Authenticated, role-scoped read and explicit lifecycle APIs for AG-10 alerts."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field, field_validator

from api.auth_helper import decode_token, security
from db.postgres_connector import PostgresConnector

router = APIRouter(prefix="/api/v1/clinical-ops/lab-critical-alerts", tags=["AG-10 Critical Alerts"])
db_connector = PostgresConnector()
READ_ROLES = {
    "doctor", "nurse", "laboratory", "pathologist", "radiologist", "admin",
    "system admin", "hospital management", "ai administrator", "it administrator", "auditor",
}


class CloseBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(..., min_length=1, max_length=2000)

    @field_validator("reason")
    @classmethod
    def nonblank_reason(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Closure reason is required")
        return value


def require_alert_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials if credentials else None
    payload = decode_token(token) if token else None
    if not payload or not payload.get("user_id") or str(payload.get("auth_method", "")).lower() in {
        "demo", "development-fallback"
    }:
        raise HTTPException(status_code=401, detail="Authentication required.", headers={"WWW-Authenticate": "Bearer"})
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT u.id AS user_id, u.is_active, r.name AS role,
                   COALESCE(d.display_name,u.staff_name,u.username) AS display_name
              FROM users u JOIN roles r ON r.id=u.role_id
              LEFT JOIN doctors d ON d.user_id=u.id WHERE u.id=%s
        """, (payload["user_id"],))
        user = cur.fetchone()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Unable to verify alert access.") from exc
    finally:
        conn.close()
    if not user or not user.get("is_active"):
        raise HTTPException(status_code=403, detail="Account is not active or no longer exists.")
    role = str(user.get("role") or "").strip().lower()
    if role not in READ_ROLES:
        raise HTTPException(status_code=403, detail="No access to clinical alert records.")
    return {"user_id": int(user["user_id"]), "role": user["role"], "display_name": user.get("display_name")}


def _doctor_scope(user):
    if str(user["role"]).strip().lower() == "doctor":
        return " AND EXISTS (SELECT 1 FROM lab_critical_alert_recipients ar WHERE ar.alert_id=a.alert_id AND ar.recipient_user_id=%s AND ar.recipient_type='ORDERING_DOCTOR')", [user["user_id"]]
    return "", []


def _alert_select(scope_sql=""):
    return """
        SELECT a.alert_id, a.evaluation_event_id, a.lab_result_id, a.lab_order_id, a.patient_id,
               p.patient_code, (p.first_name || ' ' || COALESCE(p.last_name,'')) AS patient_name,
               a.rule_id, a.rule_version, a.parameter_snapshot, a.result_value_snapshot,
               a.unit_snapshot, a.normalized_verified_result_time, a.created_at, a.status,
               a.recipient_resolution_status,
               COALESCE((SELECT jsonb_agg(jsonb_build_object(
                   'user_id', ar.recipient_user_id, 'role', ar.role_snapshot,
                   'recipient_type', ar.recipient_type, 'assignment_source', ar.assignment_source,
                   'assigned_at', ar.assigned_at,
                   'display_name', COALESCE(u.staff_name,u.username)
               ) ORDER BY ar.recipient_user_id) FROM lab_critical_alert_recipients ar
                 JOIN users u ON u.id=ar.recipient_user_id WHERE ar.alert_id=a.alert_id),'[]'::jsonb) AS recipients,
               (SELECT jsonb_build_object(
                    'actor_id',le.actor_id,'actor_role',le.actor_role,
                    'actor_name',COALESCE(au.staff_name,au.username),'timestamp',le.server_timestamp)
                  FROM lab_critical_alert_lifecycle_events le
                  LEFT JOIN users au ON au.id=le.actor_id
                 WHERE le.alert_id=a.alert_id AND le.event_type='ACKNOWLEDGED'
                 ORDER BY le.server_timestamp DESC, le.lifecycle_event_id DESC LIMIT 1) AS acknowledgement
          FROM lab_critical_alerts a
          JOIN patients p ON p.id=a.patient_id
         WHERE TRUE """ + scope_sql


@router.get("")
def list_alerts(limit: int = Query(200, ge=1, le=500), offset: int = Query(0, ge=0), user=Depends(require_alert_user)):
    scope_sql, params = _doctor_scope(user)
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute(_alert_select(scope_sql) + " ORDER BY a.created_at DESC, a.alert_id DESC LIMIT %s OFFSET %s", (*params, limit, offset))
        return {"alerts": cur.fetchall(), "limit": limit, "offset": offset}
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Critical alert data is unavailable.") from exc
    finally:
        conn.close()


@router.get("/{alert_id}")
def get_alert(alert_id: int, user=Depends(require_alert_user)):
    scope_sql, params = _doctor_scope(user)
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute(_alert_select(scope_sql) + " AND a.alert_id=%s", (*params, alert_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Critical alert not found or not accessible.")
        return row
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Critical alert data is unavailable.") from exc
    finally:
        conn.close()


def _transition(alert_id: int, user: dict, target: str, closure_reason: str | None = None):
    if str(user["role"]).strip().lower() != "doctor":
        raise HTTPException(status_code=403, detail="Only the assigned ordering Doctor may change this alert state.")
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT a.alert_id, a.status
              FROM lab_critical_alerts a
              JOIN lab_critical_alert_recipients ar ON ar.alert_id=a.alert_id
             WHERE a.alert_id=%s AND ar.recipient_user_id=%s
               AND ar.recipient_type='ORDERING_DOCTOR'
             FOR UPDATE OF a
        """, (alert_id, user["user_id"]))
        alert = cur.fetchone()
        if not alert:
            raise HTTPException(status_code=404, detail="Assigned critical alert not found.")
        expected = "OPEN" if target == "ACKNOWLEDGED" else "ACKNOWLEDGED"
        if alert["status"] != expected:
            raise HTTPException(status_code=409, detail=f"Alert must be {expected} before it can become {target}.")
        cur.execute("UPDATE lab_critical_alerts SET status=%s WHERE alert_id=%s", (target, alert_id))
        cur.execute("""
            INSERT INTO lab_critical_alert_lifecycle_events
                (alert_id,event_type,actor_id,actor_role,closure_reason)
            VALUES (%s,%s,%s,%s,%s)
        """, (alert_id, target, user["user_id"], user["role"], closure_reason))
        conn.commit()
        return {"alert_id": alert_id, "status": target}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=503, detail="Unable to update critical alert lifecycle.") from exc
    finally:
        conn.close()


@router.post("/{alert_id}/acknowledgements")
def acknowledge_alert(alert_id: int, user=Depends(require_alert_user)):
    return _transition(alert_id, user, "ACKNOWLEDGED")


@router.post("/{alert_id}/close")
def close_alert(alert_id: int, body: CloseBody, user=Depends(require_alert_user)):
    return _transition(alert_id, user, "CLOSED", body.reason)
