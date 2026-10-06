"""
feedback_routes.py
==================
FastAPI REST router for Admin Portal Feedback & Service Recovery Module.

Endpoints:
  GET   /api/feedback/summary            — KPI metrics & category/sentiment breakdown
  GET   /api/feedback                    — Paginated, filtered feedback list
  GET   /api/feedback/{id}               — Detailed view of single feedback record
  PATCH /api/feedback/{id}/status        — Update status, resolution notes & escalation sync

All endpoints enforce authentication and query live PostgreSQL data.
"""

import sys
import os
import json
import traceback
from datetime import datetime, date, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Query, HTTPException, Body, Depends
from pydantic import BaseModel

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
from api.auth_helper import get_current_user
from utils.phone_utils import extract_whatsapp_number

router = APIRouter(
    prefix="/api/feedback",
    tags=["Admin Feedback Module"],
    dependencies=[Depends(get_current_user)]
)


class FeedbackStatusUpdate(BaseModel):
    status: str  # OPEN | IN_PROGRESS | RESOLVED | CLOSED
    resolution_notes: Optional[str] = None
    assigned_to_user_id: Optional[int] = None


def format_patient_name(first_name: Optional[str], last_name: Optional[str]) -> str:
    parts = [p for p in [first_name, last_name] if p]
    return " ".join(parts) if parts else "Anonymous Patient"


def resolve_whatsapp_phone(raw_wa_num: Optional[str], patient_phone: Optional[str], conv_code: Optional[str]) -> str:
    if raw_wa_num and str(raw_wa_num).strip() and str(raw_wa_num).strip() not in ("--", "N/A", "919999999999"):
        val = str(raw_wa_num).strip()
        if not val.startswith("+") and val.isdigit():
            if len(val) == 10:
                return f"+91 {val[:5]} {val[5:]}"
            elif len(val) == 11 and val.startswith("1"):
                return f"+1 {val[1:4]} {val[4:7]} {val[7:]}"
            elif len(val) == 12 and val.startswith("91"):
                return f"+91 {val[2:7]} {val[7:]}"
            elif len(val) == 11 and val.startswith("91"):
                return f"+91 {val[2:]}"
            return f"+{val}"
        return val

    if patient_phone and str(patient_phone).strip() and str(patient_phone).strip() not in ("--", "N/A", "919999999999"):
        val = str(patient_phone).strip()
        if not val.startswith("+") and val.isdigit():
            if len(val) == 10:
                return f"+91 {val[:5]} {val[5:]}"
            elif len(val) == 12 and val.startswith("91"):
                return f"+91 {val[2:7]} {val[7:]}"
            return f"+{val}"
        return val

    if conv_code:
        extracted = extract_whatsapp_number(conv_code)
        if extracted and extracted not in ("919999999999", "N/A"):
            if extracted.isdigit() and len(extracted) == 12 and extracted.startswith("91"):
                return f"+91 {extracted[2:7]} {extracted[7:]}"
            elif extracted.isdigit() and len(extracted) == 11 and extracted.startswith("1"):
                return f"+1 {extracted[1:4]} {extracted[4:7]} {extracted[7:]}"
            elif extracted.isdigit() and len(extracted) == 10:
                return f"+91 {extracted[:5]} {extracted[5:]}"
            return f"+{extracted}" if extracted.isdigit() else extracted

    return "N/A"


@router.get("/summary", summary="Get Feedback KPI summary metrics")
def get_feedback_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    """
    Returns live KPI counts: total feedback, positive, negative, neutral, mixed,
    average rating, open grievances, high priority count, and category breakdown.
    """
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor()
        
        where_clauses = ["1=1"]
        params = []
        if date_from:
            where_clauses.append("f.created_at >= %s")
            params.append(date_from)
        if date_to:
            where_clauses.append("f.created_at <= %s")
            params.append(date_to)

        where_sql = " AND ".join(where_clauses)

        # 1. Total & Sentiment Counts
        cur.execute(f"""
            SELECT 
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE UPPER(sentiment) = 'POSITIVE') AS positive_cnt,
                COUNT(*) FILTER (WHERE UPPER(sentiment) = 'NEGATIVE') AS negative_cnt,
                COUNT(*) FILTER (WHERE UPPER(sentiment) = 'NEUTRAL') AS neutral_cnt,
                COUNT(*) FILTER (WHERE UPPER(sentiment) = 'MIXED') AS mixed_cnt,
                AVG(rating) FILTER (WHERE rating IS NOT NULL) AS avg_rating,
                COUNT(*) FILTER (WHERE requires_action = TRUE AND UPPER(status) IN ('OPEN', 'IN_PROGRESS')) AS open_grievances,
                COUNT(*) FILTER (WHERE UPPER(severity) IN ('HIGH', 'CRITICAL')) AS high_priority,
                COUNT(*) FILTER (WHERE UPPER(status) IN ('RESOLVED', 'CLOSED')) AS resolved_cnt
            FROM patient_feedback f
            WHERE {where_sql};
        """, tuple(params))
        row = cur.fetchone()

        total = row[0] or 0
        pos_cnt = row[1] or 0
        neg_cnt = row[2] or 0
        neu_cnt = row[3] or 0
        mix_cnt = row[4] or 0
        avg_rating = round(float(row[5]), 1) if row[5] is not None else 0.0
        open_grievances = row[6] or 0
        high_priority = row[7] or 0
        resolved_cnt = row[8] or 0

        # 2. Category distribution
        cur.execute(f"""
            SELECT jsonb_array_elements_text(categories) AS cat, COUNT(*)
            FROM patient_feedback f
            WHERE {where_sql} AND categories IS NOT NULL AND jsonb_array_length(categories) > 0
            GROUP BY cat
            ORDER BY COUNT(*) DESC;
        """, tuple(params))
        cat_rows = cur.fetchall()
        category_breakdown = [{"category": r[0], "count": r[1]} for r in cat_rows]

        return {
            "success": True,
            "summary": {
                "total_feedback": total,
                "positive_count": pos_cnt,
                "negative_count": neg_cnt,
                "neutral_count": neu_cnt,
                "mixed_count": mix_cnt,
                "average_rating": avg_rating,
                "open_grievances": open_grievances,
                "high_priority_count": high_priority,
                "resolved_count": resolved_cnt,
                "positive_percentage": round((pos_cnt / total * 100), 1) if total > 0 else 0,
                "negative_percentage": round((neg_cnt / total * 100), 1) if total > 0 else 0,
                "neutral_percentage": round((neu_cnt / total * 100), 1) if total > 0 else 0,
            },
            "category_breakdown": category_breakdown
        }
    except Exception as e:
        print(f"[FEEDBACK_SUMMARY_ERR] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("", summary="Get paginated, filtered feedback list")
def get_feedback_list(
    limit: int = Query(default=50, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = None,
    sentiment: Optional[str] = None,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    requires_action: Optional[str] = None,
    patient_id: Optional[int] = None
):
    """
    Returns paginated list of feedback records with patient details and AI analysis.
    """
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor()

        where_clauses = ["1=1"]
        params = []

        if patient_id:
            where_clauses.append("f.patient_id = %s")
            params.append(patient_id)

        if sentiment and sentiment.upper() != "ALL":
            where_clauses.append("UPPER(f.sentiment) = %s")
            params.append(sentiment.upper())

        if severity and severity.upper() != "ALL":
            where_clauses.append("UPPER(f.severity) = %s")
            params.append(severity.upper())

        if status and status.upper() != "ALL":
            where_clauses.append("UPPER(f.status) = %s")
            params.append(status.upper())

        if source and source.upper() != "ALL":
            where_clauses.append("UPPER(f.source) LIKE %s")
            params.append(f"%{source.upper()}%")

        if requires_action is not None and str(requires_action).strip() != "":
            req_val = str(requires_action).strip().lower()
            if req_val in ("true", "1"):
                where_clauses.append("f.requires_action = TRUE")
            elif req_val in ("false", "0"):
                where_clauses.append("f.requires_action = FALSE")

        if category and category.upper() != "ALL":
            where_clauses.append("f.categories @> %s::jsonb")
            params.append(json.dumps([category]))

        if search:
            s_pat = f"%{search.strip().lower()}%"
            where_clauses.append("(LOWER(f.original_feedback) LIKE %s OR LOWER(f.ai_summary) LIKE %s OR LOWER(p.first_name || ' ' || p.last_name) LIKE %s OR LOWER(p.patient_code) LIKE %s)")
            params.extend([s_pat, s_pat, s_pat, s_pat])

        where_sql = " AND ".join(where_clauses)

        # Count query
        cur.execute(f"""
            SELECT COUNT(*)
            FROM patient_feedback f
            LEFT JOIN patients p ON f.patient_id = p.id
            WHERE {where_sql};
        """, tuple(params))
        total_count = cur.fetchone()[0]

        # Data query
        query_sql = f"""
            SELECT 
                f.id,
                f.patient_id,
                p.patient_code,
                p.first_name,
                p.last_name,
                p.phone,
                f.rating,
                f.sentiment,
                f.categories,
                f.issues,
                f.ai_summary,
                f.original_feedback,
                f.severity,
                f.requires_action,
                f.recommended_action,
                f.confidence,
                f.status,
                f.source,
                f.created_at,
                f.resolved_at,
                f.resolution_notes,
                (SELECT id FROM escalations e WHERE e.conversation_id = f.conversation_id LIMIT 1) AS escalation_id,
                c.whatsapp_number,
                c.conversation_code
            FROM patient_feedback f
            LEFT JOIN patients p ON f.patient_id = p.id
            LEFT JOIN conversations c ON f.conversation_id = c.id
            WHERE {where_sql}
            ORDER BY f.created_at DESC
            LIMIT %s OFFSET %s;
        """
        cur.execute(query_sql, tuple(params + [limit, offset]))
        rows = cur.fetchall()

        items = []
        for r in rows:
            pat_name = format_patient_name(r[3], r[4])
            pat_code = r[2] or (f"P{r[1]}" if r[1] else "P9999")
            
            created_str = r[18].strftime("%d %b %Y, %I:%M %p") if r[18] else "Recent"
            resolved_str = r[19].strftime("%d %b %Y, %I:%M %p") if r[19] else None

            cats = r[8] if isinstance(r[8], list) else (json.loads(r[8]) if r[8] else [])
            issues = r[9] if isinstance(r[9], list) else (json.loads(r[9]) if r[9] else [])

            wa_num = resolve_whatsapp_phone(r[22], r[5], r[23])

            items.append({
                "id": r[0],
                "patient_id": r[1],
                "patient_code": pat_code,
                "patient_name": pat_name,
                "phone": wa_num,
                "phone_number": wa_num,
                "whatsapp_phone": wa_num,
                "rating": r[6],
                "rating_display": f"{r[6]}/10" if r[6] is not None else "--",
                "sentiment": r[7],
                "categories": cats,
                "issues": issues,
                "ai_summary": r[10] or r[11][:120],
                "original_feedback": r[11],
                "severity": r[12],
                "requires_action": bool(r[13]),
                "recommended_action": r[14],
                "confidence": float(r[15]) if r[15] is not None else 1.0,
                "status": r[16],
                "source": r[17],
                "created_at": created_str,
                "resolved_at": resolved_str,
                "resolution_notes": r[20],
                "escalation_id": r[21]
            })

        return {
            "success": True,
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "data": items
        }

    except Exception as e:
        print(f"[FEEDBACK_LIST_ERR] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("/{feedback_id}", summary="Get detailed view of a feedback record")
def get_feedback_detail(feedback_id: int):
    """
    Returns complete details of a single feedback record.
    """
    conn = db_config.get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                f.id, f.patient_id, p.patient_code, p.first_name, p.last_name, p.phone,
                f.rating, f.sentiment, f.categories, f.issues, f.ai_summary,
                f.original_feedback, f.severity, f.requires_action, f.recommended_action,
                f.confidence, f.status, f.source, f.created_at, f.resolved_at,
                f.resolution_notes, f.conversation_id,
                e.id AS escalation_id, e.status AS escalation_status, e.resolution_notes AS escalation_notes,
                c.whatsapp_number, c.conversation_code
            FROM patient_feedback f
            LEFT JOIN patients p ON f.patient_id = p.id
            LEFT JOIN conversations c ON f.conversation_id = c.id
            LEFT JOIN escalations e ON e.conversation_id = f.conversation_id
            WHERE f.id = %s
            LIMIT 1;
        """, (feedback_id,))
        r = cur.fetchone()

        if not r:
            raise HTTPException(status_code=404, detail=f"Feedback ID {feedback_id} not found")

        pat_name = format_patient_name(r[3], r[4])
        pat_code = r[2] or (f"P{r[1]}" if r[1] else "P9999")
        created_str = r[18].strftime("%d %b %Y, %I:%M %p") if r[18] else "Recent"
        resolved_str = r[19].strftime("%d %b %Y, %I:%M %p") if r[19] else None

        cats = r[8] if isinstance(r[8], list) else (json.loads(r[8]) if r[8] else [])
        issues = r[9] if isinstance(r[9], list) else (json.loads(r[9]) if r[9] else [])

        wa_num = resolve_whatsapp_phone(r[25], r[5], r[26])

        return {
            "success": True,
            "data": {
                "id": r[0],
                "patient_id": r[1],
                "patient_code": pat_code,
                "patient_name": pat_name,
                "phone": wa_num,
                "phone_number": wa_num,
                "whatsapp_phone": wa_num,
                "rating": r[6],
                "rating_display": f"{r[6]}/10" if r[6] is not None else "--",
                "sentiment": r[7],
                "categories": cats,
                "issues": issues,
                "ai_summary": r[10] or r[11][:120],
                "original_feedback": r[11],
                "severity": r[12],
                "requires_action": bool(r[13]),
                "recommended_action": r[14],
                "confidence": float(r[15]) if r[15] is not None else 1.0,
                "status": r[16],
                "source": r[17],
                "created_at": created_str,
                "resolved_at": resolved_str,
                "resolution_notes": r[20],
                "conversation_id": r[21],
                "escalation": {
                    "id": r[22],
                    "status": r[23],
                    "notes": r[24]
                } if r[22] else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FEEDBACK_DETAIL_ERR] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.api_route("/{feedback_id}/status", methods=["PATCH", "POST", "PUT"], summary="Update feedback status and resolution notes")
def update_feedback_status(
    feedback_id: int,
    payload: FeedbackStatusUpdate,
    user: dict = Depends(get_current_user)
):
    """
    Updates status ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') and resolution notes.
    Synchronizes status with linked escalation ticket in PostgreSQL.
    """
    new_status = payload.status.upper().strip()
    if new_status not in ("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"):
        raise HTTPException(status_code=400, detail=f"Invalid status '{new_status}'. Must be OPEN, IN_PROGRESS, RESOLVED, or CLOSED")

    notes = payload.resolution_notes.strip() if payload.resolution_notes is not None and payload.resolution_notes.strip() else payload.resolution_notes
    raw_user_id = user.get("user_id") if isinstance(user, dict) else None

    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Check feedback record existence
        cur.execute("SELECT conversation_id, status FROM patient_feedback WHERE id = %s LIMIT 1;", (feedback_id,))
        f_row = cur.fetchone()
        if not f_row:
            conn.rollback()
            raise HTTPException(status_code=404, detail=f"Feedback ID {feedback_id} not found")

        conv_id = f_row[0]

        valid_user_id = None
        if raw_user_id:
            cur.execute("SELECT id FROM users WHERE id = %s LIMIT 1;", (raw_user_id,))
            u_row = cur.fetchone()
            if u_row:
                valid_user_id = u_row[0]

        # Update patient_feedback record
        if notes is not None:
            if new_status in ("RESOLVED", "CLOSED"):
                cur.execute("""
                    UPDATE patient_feedback 
                    SET status = %s,
                        resolution_notes = %s,
                        resolved_by_user_id = %s,
                        resolved_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (new_status, notes, valid_user_id, feedback_id))
            else:
                cur.execute("""
                    UPDATE patient_feedback 
                    SET status = %s,
                        resolution_notes = %s,
                        assigned_to_user_id = COALESCE(%s, assigned_to_user_id),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (new_status, notes, payload.assigned_to_user_id, feedback_id))
        else:
            if new_status in ("RESOLVED", "CLOSED"):
                cur.execute("""
                    UPDATE patient_feedback 
                    SET status = %s,
                        resolved_by_user_id = %s,
                        resolved_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (new_status, valid_user_id, feedback_id))
            else:
                cur.execute("""
                    UPDATE patient_feedback 
                    SET status = %s,
                        assigned_to_user_id = COALESCE(%s, assigned_to_user_id),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s;
                """, (new_status, payload.assigned_to_user_id, feedback_id))

        # Sync linked escalation record if present
        if conv_id:
            esc_status = "RESOLVED" if new_status in ("RESOLVED", "CLOSED") else new_status
            if esc_status in ("OPEN", "IN_PROGRESS", "RESOLVED"):
                if notes is not None:
                    cur.execute("""
                        UPDATE escalations 
                        SET status = %s,
                            resolution_notes = %s,
                            resolved_by_user_id = COALESCE(%s, resolved_by_user_id),
                            resolved_at = CASE WHEN %s = 'RESOLVED' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE conversation_id = %s;
                    """, (esc_status, notes, valid_user_id, esc_status, conv_id))
                else:
                    cur.execute("""
                        UPDATE escalations 
                        SET status = %s,
                            resolved_by_user_id = COALESCE(%s, resolved_by_user_id),
                            resolved_at = CASE WHEN %s = 'RESOLVED' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE conversation_id = %s;
                    """, (esc_status, valid_user_id, esc_status, conv_id))

        conn.commit()
        print(f"[FEEDBACK_STATUS_UPDATED] feedback_id={feedback_id}, new_status={new_status}, notes={notes}")

        return {
            "success": True,
            "feedback_id": feedback_id,
            "status": new_status,
            "resolution_notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        print(f"[FEEDBACK_STATUS_UPDATE_ERR] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
