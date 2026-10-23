"""
ag11_followup_routes.py
========================
FastAPI Router for AG-11 — Follow-up Agent Hospital Dashboard.

Provides API endpoints for:
- Operational Overview & Metrics
- Patient Follow-up Queue & Filters
- Patient Follow-up Detail View & Interactive Timeline
- Clinical Escalations Management Desk
- Callback Request Desk
- Scheduler Control & Manual Trigger
- Test Simulator for Discharge & Check-in Execution
"""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import datetime
import traceback
import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

import db_config
import services.ag11_followup_service as ag11_service
import services.ag11_followup_scheduler as ag11_scheduler

router = APIRouter(prefix="/api/ag11-followup", tags=["AG-11 Follow-up Agent"])


# Request Schemas
class EscalationActionRequest(BaseModel):
    user_id: Optional[int] = None
    disposition_notes: Optional[str] = "Clinical follow-up completed."

class CallbackActionRequest(BaseModel):
    user_id: Optional[int] = None
    outcome_notes: Optional[str] = "Patient contacted via telephone."

class SimulateDischargeRequest(BaseModel):
    patient_id: Optional[int] = None
    first_name: Optional[str] = "Test"
    last_name: Optional[str] = "Patient"
    phone: Optional[str] = "+919876543210"
    procedure: Optional[str] = "Laparoscopic Cholecystectomy"
    force_due_now: Optional[bool] = True


@router.get("/overview-metrics")
def get_overview_metrics():
    """Returns dynamically calculated metrics for Screen A Follow-up Overview."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT COUNT(*) FROM ag11_followup_plans WHERE status = 'ACTIVE';")
        active_plans = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM ag11_followup_plans WHERE status = 'COMPLETED';")
        completed_plans = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM ag11_followup_tasks WHERE status IN ('SCHEDULED', 'SENT');")
        due_tasks = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM ag11_followup_tasks WHERE status = 'OVERDUE';")
        overdue_tasks = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM ag11_clinical_escalations WHERE status = 'OPEN';")
        open_escalations = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM ag11_callbacks WHERE status = 'PENDING';")
        pending_callbacks = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM ag11_followup_tasks WHERE status = 'FAILED';")
        failed_deliveries = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM ag11_patient_responses;")
        total_responses = cur.fetchone()[0]

        return {
            "success": True,
            "metrics": {
                "active_plans": active_plans,
                "completed_plans": completed_plans,
                "due_tasks": due_tasks,
                "overdue_tasks": overdue_tasks,
                "open_escalations": open_escalations,
                "pending_callbacks": pending_callbacks,
                "failed_deliveries": failed_deliveries,
                "total_responses": total_responses,
            }
        }
    except Exception as e:
        print(f"[AG11_METRICS_ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("/queue")
def get_patient_followup_queue(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Returns paginated patient follow-up queue for Screen B."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        offset = (page - 1) * limit
        where_clauses = ["1=1"]
        params = []

        if status and status.upper() != "ALL":
            where_clauses.append("plan.status = %s")
            params.append(status.upper())

        if search:
            where_clauses.append("(p.first_name ILIKE %s OR p.last_name ILIKE %s OR p.patient_code ILIKE %s OR plan.procedure_name ILIKE %s)")
            term = f"%{search}%"
            params.extend([term, term, term, term])

        where_sql = " AND ".join(where_clauses)

        # Count query
        cur.execute(f"""
            SELECT COUNT(*)
            FROM ag11_followup_plans plan
            JOIN patients p ON plan.patient_id = p.id
            WHERE {where_sql};
        """, params)
        total_count = cur.fetchone()[0]

        # Data query
        query_params = params + [limit, offset]
        cur.execute(f"""
            SELECT 
                plan.id AS plan_id,
                plan.patient_id,
                p.patient_code,
                p.first_name,
                p.last_name,
                p.phone,
                plan.procedure_name,
                plan.discharge_date,
                plan.status AS plan_status,
                (
                    SELECT followup_day FROM ag11_followup_tasks 
                    WHERE plan_id = plan.id ORDER BY due_date ASC LIMIT 1
                ) AS next_day,
                (
                    SELECT status FROM ag11_followup_tasks 
                    WHERE plan_id = plan.id ORDER BY due_date ASC LIMIT 1
                ) AS next_task_status,
                (
                    SELECT COUNT(*) FROM ag11_clinical_escalations 
                    WHERE plan_id = plan.id AND status = 'OPEN'
                ) AS open_esc_count,
                (
                    SELECT COUNT(*) FROM ag11_callbacks 
                    WHERE plan_id = plan.id AND status = 'PENDING'
                ) AS pending_cb_count
            FROM ag11_followup_plans plan
            JOIN patients p ON plan.patient_id = p.id
            WHERE {where_sql}
            ORDER BY plan.created_at DESC
            LIMIT %s OFFSET %s;
        """, query_params)

        rows = cur.fetchall()
        items = []
        for r in rows:
            p_name = f"{r[3] or ''} {r[4] or ''}".strip()
            items.append({
                "plan_id": r[0],
                "patient_id": r[1],
                "patient_code": r[2],
                "patient_name": p_name,
                "phone": r[5],
                "procedure_name": r[6],
                "discharge_date": r[7].isoformat() if r[7] else None,
                "plan_status": r[8],
                "next_followup_day": r[9] or 3,
                "next_task_status": r[10] or "SCHEDULED",
                "open_escalations": r[11],
                "pending_callbacks": r[12]
            })

        return {
            "success": True,
            "page": page,
            "limit": limit,
            "total_count": total_count,
            "items": items
        }
    except Exception as e:
        print(f"[AG11_QUEUE_ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("/patient/{patient_id}/detail")
def get_patient_followup_detail(patient_id: int):
    """Returns full AG-11 detail for a patient: Plan, Tasks, Responses, Escalations, Callbacks, WhatsApp thread."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # Patient info
        cur.execute("SELECT id, patient_code, first_name, last_name, phone, whatsapp_number, gender, date_of_birth FROM patients WHERE id = %s;", (patient_id,))
        pat_row = cur.fetchone()
        if not pat_row:
            raise HTTPException(status_code=404, detail="Patient not found")

        pat_info = {
            "id": pat_row[0],
            "patient_code": pat_row[1],
            "patient_name": f"{pat_row[2] or ''} {pat_row[3] or ''}".strip(),
            "phone": pat_row[4],
            "whatsapp_number": pat_row[5],
            "gender": pat_row[6],
            "dob": str(pat_row[7]) if pat_row[7] else None
        }

        # Plan info
        cur.execute("""
            SELECT id, discharge_summary_id, admission_id, procedure_name, discharge_date, status, care_plan_notes, created_at
            FROM ag11_followup_plans
            WHERE patient_id = %s
            ORDER BY created_at DESC LIMIT 1;
        """, (patient_id,))
        plan_row = cur.fetchone()
        plan_info = None
        plan_id = None

        if plan_row:
            plan_id = plan_row[0]
            plan_info = {
                "id": plan_row[0],
                "discharge_summary_id": plan_row[1],
                "admission_id": plan_row[2],
                "procedure_name": plan_row[3],
                "discharge_date": plan_row[4].isoformat() if plan_row[4] else None,
                "status": plan_row[5],
                "care_plan_notes": plan_row[6],
                "created_at": plan_row[7].isoformat() if plan_row[7] else None
            }

        tasks = []
        responses = []
        escalations = []
        callbacks = []

        if plan_id:
            # Scheduled tasks
            cur.execute("""
                SELECT id, followup_day, due_date, status, outbound_wamid, sent_at, completed_at, last_error
                FROM ag11_followup_tasks
                WHERE plan_id = %s
                ORDER BY followup_day ASC;
            """, (plan_id,))
            for t in cur.fetchall():
                tasks.append({
                    "id": t[0],
                    "followup_day": t[1],
                    "due_date": t[2].isoformat() if t[2] else None,
                    "status": t[3],
                    "outbound_wamid": t[4],
                    "sent_at": t[5].isoformat() if t[5] else None,
                    "completed_at": t[6].isoformat() if t[6] else None,
                    "last_error": t[7]
                })

            # Responses
            cur.execute("""
                SELECT id, task_id, response_type, raw_text, structured_answers, created_at
                FROM ag11_patient_responses
                WHERE plan_id = %s
                ORDER BY created_at DESC;
            """, (plan_id,))
            for r in cur.fetchall():
                responses.append({
                    "id": r[0],
                    "task_id": r[1],
                    "response_type": r[2],
                    "raw_text": r[3],
                    "structured_answers": r[4],
                    "created_at": r[5].isoformat() if r[5] else None
                })

            # Escalations
            cur.execute("""
                SELECT id, escalation_id, symptom_summary, severity, status, assigned_team, disposition_notes, created_at, resolved_at
                FROM ag11_clinical_escalations
                WHERE plan_id = %s
                ORDER BY created_at DESC;
            """, (plan_id,))
            for e in cur.fetchall():
                escalations.append({
                    "id": e[0],
                    "central_escalation_id": e[1],
                    "symptom_summary": e[2],
                    "severity": e[3],
                    "status": e[4],
                    "assigned_team": e[5],
                    "disposition_notes": e[6],
                    "created_at": e[7].isoformat() if e[7] else None,
                    "resolved_at": e[8].isoformat() if e[8] else None
                })

            # Callbacks
            cur.execute("""
                SELECT id, requested_reason, priority, status, outcome_notes, created_at, completed_at
                FROM ag11_callbacks
                WHERE plan_id = %s
                ORDER BY created_at DESC;
            """, (plan_id,))
            for cb in cur.fetchall():
                callbacks.append({
                    "id": cb[0],
                    "requested_reason": cb[1],
                    "priority": cb[2],
                    "status": cb[3],
                    "outcome_notes": cb[4],
                    "created_at": cb[5].isoformat() if cb[5] else None,
                    "completed_at": cb[6].isoformat() if cb[6] else None
                })

        return {
            "success": True,
            "patient": pat_info,
            "plan": plan_info,
            "tasks": tasks,
            "responses": responses,
            "escalations": escalations,
            "callbacks": callbacks
        }

    except Exception as e:
        print(f"[AG11_DETAIL_ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.get("/escalations")
def get_escalations_queue(status: Optional[str] = Query("OPEN")):
    """Returns Clinical Escalations Queue for Screen D."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        where_clause = "WHERE 1=1"
        params = []
        if status and status.upper() != "ALL":
            where_clause += " AND e.status = %s"
            params.append(status.upper())

        cur.execute(f"""
            SELECT 
                e.id,
                e.plan_id,
                e.patient_id,
                p.patient_code,
                p.first_name,
                p.last_name,
                p.phone,
                e.symptom_summary,
                e.severity,
                e.status,
                e.assigned_team,
                e.disposition_notes,
                e.created_at
            FROM ag11_clinical_escalations e
            JOIN patients p ON e.patient_id = p.id
            {where_clause}
            ORDER BY e.created_at DESC;
        """, params)

        items = []
        for r in cur.fetchall():
            p_name = f"{r[4] or ''} {r[5] or ''}".strip()
            items.append({
                "id": r[0],
                "plan_id": r[1],
                "patient_id": r[2],
                "patient_code": r[3],
                "patient_name": p_name,
                "phone": r[6],
                "symptom_summary": r[7],
                "severity": r[8],
                "status": r[9],
                "assigned_team": r[10],
                "disposition_notes": r[11],
                "created_at": r[12].isoformat() if r[12] else None
            })

        return {"success": True, "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post("/escalations/{escalation_id}/resolve")
def resolve_clinical_escalation(escalation_id: int, payload: EscalationActionRequest):
    """Staff resolves a clinical escalation with disposition notes."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # Check existing escalation record
        cur.execute("SELECT escalation_id, status FROM ag11_clinical_escalations WHERE id = %s;", (escalation_id,))
        esc_row = cur.fetchone()
        if not esc_row:
            raise HTTPException(status_code=404, detail="Escalation not found")

        central_id, curr_status = esc_row
        if curr_status == 'RESOLVED':
            return {"success": True, "message": "Clinical escalation is already resolved.", "already_resolved": True}

        # Safely validate user_id against users table
        valid_user_id = None
        if payload.user_id:
            cur.execute("SELECT id FROM users WHERE id = %s;", (payload.user_id,))
            if cur.fetchone():
                valid_user_id = payload.user_id

        cur.execute("""
            UPDATE ag11_clinical_escalations
            SET status = 'RESOLVED',
                assigned_to_user_id = %s,
                disposition_notes = %s,
                resolved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s RETURNING escalation_id;
        """, (valid_user_id, payload.disposition_notes or 'Resolved by clinical staff.', escalation_id))

        if central_id:
            cur.execute("""
                UPDATE escalations
                SET status = 'RESOLVED',
                    resolution_notes = %s,
                    resolved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING conversation_id;
            """, (payload.disposition_notes or 'Resolved by clinical staff.', central_id))
            esc_res = cur.fetchone()
            if esc_res and esc_res[0]:
                cur.execute("""
                    UPDATE patient_feedback
                    SET status = 'RESOLVED',
                        resolution_notes = %s,
                        resolved_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE conversation_id = %s;
                """, (payload.disposition_notes or 'Resolved by clinical staff.', esc_res[0]))

        conn.commit()
        return {"success": True, "message": "Clinical escalation resolved successfully."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        print(f"[AG11_RESOLVE_ESCALATION_ERROR] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed resolving escalation: {e}")
    finally:
        cur.close()
        conn.close()


@router.get("/callbacks")
def get_callbacks_queue(status: Optional[str] = Query("PENDING")):
    """Returns Callbacks Queue for Screen D."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        where_clause = "WHERE 1=1"
        params = []
        if status and status.upper() != "ALL":
            where_clause += " AND cb.status = %s"
            params.append(status.upper())

        cur.execute(f"""
            SELECT 
                cb.id,
                cb.plan_id,
                cb.patient_id,
                p.patient_code,
                p.first_name,
                p.last_name,
                p.phone,
                cb.requested_reason,
                cb.priority,
                cb.status,
                cb.outcome_notes,
                cb.created_at
            FROM ag11_callbacks cb
            JOIN patients p ON cb.patient_id = p.id
            {where_clause}
            ORDER BY cb.created_at DESC;
        """, params)

        items = []
        for r in cur.fetchall():
            p_name = f"{r[4] or ''} {r[5] or ''}".strip()
            items.append({
                "id": r[0],
                "plan_id": r[1],
                "patient_id": r[2],
                "patient_code": r[3],
                "patient_name": p_name,
                "phone": r[6],
                "requested_reason": r[7],
                "priority": r[8],
                "status": r[9],
                "outcome_notes": r[10],
                "created_at": r[11].isoformat() if r[11] else None
            })

        return {"success": True, "items": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@router.post("/callbacks/{callback_id}/complete")
def complete_callback(callback_id: int, payload: CallbackActionRequest):
    """Staff documents completion of callback request."""
    conn = db_config.get_db_connection()
    cur = conn.cursor()
    try:
        # Check existing callback record
        cur.execute("SELECT status FROM ag11_callbacks WHERE id = %s;", (callback_id,))
        cb_row = cur.fetchone()
        if not cb_row:
            raise HTTPException(status_code=404, detail="Callback request not found")

        curr_status = cb_row[0]
        if curr_status == 'COMPLETED':
            return {"success": True, "message": "Callback request is already completed.", "already_completed": True}

        # Safely validate user_id against users table
        valid_user_id = None
        if payload.user_id:
            cur.execute("SELECT id FROM users WHERE id = %s;", (payload.user_id,))
            if cur.fetchone():
                valid_user_id = payload.user_id

        cur.execute("""
            UPDATE ag11_callbacks
            SET status = 'COMPLETED',
                assigned_to_user_id = %s,
                outcome_notes = %s,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (valid_user_id, payload.outcome_notes or 'Patient contacted via telephone.', callback_id))

        conn.commit()
        return {"success": True, "message": "Callback marked as completed successfully."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        print(f"[AG11_COMPLETE_CALLBACK_ERROR] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed completing callback: {e}")
    finally:
        cur.close()
        conn.close()


@router.post("/trigger-scan")
def trigger_ag11_scan():
    """Manual API trigger to run AG-11 scan & task process cycle immediately."""
    result = ag11_scheduler.run_ag11_cycle()
    return {"success": True, "result": result}


@router.post("/simulate-discharge")
def simulate_discharge(req: SimulateDischargeRequest):
    """
    Test Simulator Endpoint: Creates a test patient & discharge, creates AG-11 plan + Day 3/7/14 tasks,
    forces task due dates to NOW(), and immediately triggers process_due_followup_tasks().
    """
    conn = db_config.get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()
    try:
        p_id = req.patient_id
        if not p_id:
            # Create test patient if not supplied
            code = f"PAT_AG11_{uuid.uuid4().hex[:6].upper()}"
            cur.execute("""
                INSERT INTO patients (
                    patient_code, first_name, last_name, date_of_birth, gender, phone, whatsapp_number, status
                ) VALUES (
                    %s, %s, %s, '1985-05-15', 'MALE', %s, %s, 'ACTIVE'
                ) RETURNING id;
            """, (code, req.first_name, req.last_name, req.phone, req.phone))
            p_id = cur.fetchone()[0]

        # Create dim_generated_discharge_summaries record
        cur.execute("""
            INSERT INTO dim_generated_discharge_summaries (
                patient_id, diagnoses, discharge_advice, approval_status, generated_at, discharge_date
            ) VALUES (
                %s, %s, 'Continue prescribed medications and attend Day 14 follow-up', 'Approved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING summary_id;
        """, (p_id, req.procedure))

        sum_id = cur.fetchone()[0]
        conn.commit()

        # Run AG-11 Plan Creation
        ag11_service.scan_and_create_followup_plans()

        if req.force_due_now:
            # Force due date to past so scheduler picks it up immediately
            cur.execute("""
                UPDATE ag11_followup_tasks
                SET due_date = CURRENT_TIMESTAMP - INTERVAL '1 minute'
                WHERE patient_id = %s;
            """, (p_id,))
            conn.commit()

        # Process due tasks
        run_res = ag11_service.process_due_followup_tasks()

        return {
            "success": True,
            "patient_id": p_id,
            "discharge_summary_id": sum_id,
            "procedure": req.procedure,
            "run_result": run_res
        }
    except Exception as e:
        conn.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()
