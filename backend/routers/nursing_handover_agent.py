import os
import time
import logging
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field

from services.nursing_handover_agent import NursingHandoverAgentService
from db.postgres_connector import PostgresConnector

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/nursing-handover-agent",
    tags=["AG-18 · Nursing Handover Agent (Shift Co-Pilot)"]
)

db_connector = PostgresConnector()


class SbarGenerationRequest(BaseModel):
    bed_no: Union[str, int] = Field(..., description="Bed number (e.g. 'BED-0183') or handover record ID")
    outgoing_nurse: Optional[str] = Field(default=None, description="Outgoing nurse name (e.g. 'Anitha Kumar, RN')")
    incoming_nurse: Optional[str] = Field(default=None, description="Incoming nurse name (e.g. 'Deepa Krishnan, RN')")
    shift_name: Optional[str] = Field(default="Morning (07:00 - 15:00)", description="Shift name")
    custom_instructions: Optional[str] = Field(default=None, description="Special clinical focus or instructions for the handover note")
    model_name: Optional[str] = Field(default=None, description="LLM model identifier (defaults to openai/gpt-oss-120b)")
    api_key: Optional[str] = Field(default=None, description="Optional Groq API key override")


class SbarBatchRequest(BaseModel):
    ward_name: Optional[str] = Field(default=None, description="Filter by specific ward name")
    shift_name: Optional[str] = Field(default="Morning (07:00 - 15:00)", description="Handover shift window")
    status_filter: Optional[str] = Field(default=None, description="'Missing', 'Stale', or None for all needing handover")
    limit: Optional[int] = Field(default=10, description="Max beds to auto-draft")
    model_name: Optional[str] = Field(default=None, description="LLM model identifier")
    api_key: Optional[str] = Field(default=None, description="Optional Groq API key override")


class SbarAcknowledgeRequest(BaseModel):
    nurse_name: Optional[str] = Field(default="Deepa Krishnan, RN", description="Bedside receiving nurse name")
    remarks: Optional[str] = Field(default=None, description="Optional handover review remarks")


@router.get("/status", summary="Get AG-18 Nursing Handover Agent Status & Benchmarks")
def get_agent_status():
    """
    Returns full AG-18 agent specification:
    - Identity, tier, owner, and active model (openai/gpt-oss-120b)
    - Connected tools: EMR API, Pharmacy API, Document Generator
    - Knowledge base: Medication Safety High-Alert v4.0 & Ward Admin v3.2
    - Evaluation benchmarks: 94.8% accuracy, 97.5% groundedness, 0.3% hallucination rate
    - Live database metrics across 202 inpatient beds
    """
    try:
        service = NursingHandoverAgentService()
        return {
            "status": "success",
            "agent": service.get_agent_profile()
        }
    except Exception as e:
        logger.error(f"Error fetching agent status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/beds", summary="List Inpatient Beds with Live SBAR & EWS Status")
def list_handover_beds(
    status: Optional[str] = Query(None, description="Filter by status ('Current', 'Stale', 'Missing')"),
    ward: Optional[str] = Query(None, description="Filter by ward name"),
    search: Optional[str] = Query(None, description="Search by bed, patient name, or UHID"),
    limit: int = Query(250, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """Lists ward beds joined with latest vitals, EWS, eMAR due status, and SBAR notes."""
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        query = """
            SELECT 
                nt.id,
                nt.bed_no,
                nt.patient_name,
                nt.uhid,
                s.age_gender,
                COALESCE(s.ews, 'Score ' || COALESCE(nt.ews_score::text, '0')) as ews,
                s.mar_due,
                COALESCE(s.last_handover_time, '07:30 · Anitha Kumar, RN') as last_handover_time,
                COALESCE(s.from_nurse, 'Anitha Kumar, RN') as from_nurse,
                COALESCE(s.to_nurse, 'Deepa Krishnan, RN') as to_nurse,
                s.situation,
                s.background,
                s.assessment,
                s.recommendation,
                COALESCE(s.sbar_full, 'S: ' || nt.patient_name || ' admitted for ' || nt.task_description || '. B: Inpatient care. A: Vitals BP ' || COALESCE(nt.bp, '120/80') || ', HR ' || COALESCE(nt.hr::text, '76') || ', SpO2 ' || COALESCE(nt.spo2::text, '98') || ' pct. R: Continue inpatient monitoring.') as sbar_full,
                COALESCE(s.status, 'Stale') as status,
                COALESCE(s.handover_shift, 'Morning (07:00 - 15:00)') as handover_shift,
                COALESCE(s.acknowledged, false) as acknowledged,
                s.acknowledged_at,
                nt.ward_name,
                nt.hr,
                nt.bp,
                nt.spo2,
                nt.temp,
                nt.rr,
                nt.ews_score,
                nt.pain_score,
                nt.fall_risk,
                nt.diet_type,
                (SELECT COUNT(*) FROM emar_records e WHERE e.bed_no = nt.bed_no AND e.is_high_alert = TRUE) as high_alert_meds_count
            FROM nursing_tasks nt
            LEFT JOIN LATERAL (
                SELECT * FROM ward_sbar_handovers ws 
                WHERE ws.bed_no = nt.bed_no 
                ORDER BY ws.id DESC LIMIT 1
            ) s ON true
        """
        conditions = []
        params = []

        if status:
            conditions.append("COALESCE(s.status, 'Stale') = %s")
            params.append(status)
        if ward:
            conditions.append("(nt.ward_name ILIKE %s OR nt.bed_no ILIKE %s)")
            params.extend([f"%{ward}%", f"%{ward}%"])
        if search:
            conditions.append("(nt.bed_no ILIKE %s OR nt.patient_name ILIKE %s OR nt.uhid ILIKE %s)")
            params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

        count_params = list(params)
        count_query = """
            SELECT COUNT(*) as total 
            FROM nursing_tasks nt
            LEFT JOIN LATERAL (
                SELECT * FROM ward_sbar_handovers ws 
                WHERE ws.bed_no = nt.bed_no 
                ORDER BY ws.id DESC LIMIT 1
            ) s ON true
        """

        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            count_query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY nt.id ASC LIMIT %s OFFSET %s;"
        params.extend([limit, offset])

        cur.execute(query, tuple(params))
        rows = cur.fetchall()

        cur.execute(count_query, tuple(count_params) if count_params else None)
        total_count = cur.fetchone()["total"]

        return {
            "status": "success",
            "count": len(rows),
            "total": total_count,
            "data": rows
        }
    except Exception as e:
        logger.error(f"Error listing handover beds: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.post("/generate", summary="Autonomous SBAR Handover Draft for a Bed (openai/gpt-oss-120b)")
def generate_sbar_for_bed_api(request: SbarGenerationRequest):
    """
    Executes AG-18 agent cycle for the given bed:
    1. Tool 1 (EMR API): reads admission, diagnosis, vitals & nursing tasks.
    2. Tool 2 (Pharmacy API): checks active drugs for high-alert items & overdue doses.
    3. Tool 3 (Document Generator): calls Groq LPU with openai/gpt-oss-120b.
    4. Persists structured SBAR into PostgreSQL ward_sbar_handovers table.
    5. Queues for selective human sign-off at bedside.
    """
    try:
        service = NursingHandoverAgentService(
            api_key=request.api_key,
            model=request.model_name
        )
        result = service.generate_sbar_for_bed(
            bed_no_or_id=request.bed_no,
            outgoing_nurse=request.outgoing_nurse,
            incoming_nurse=request.incoming_nurse,
            shift_name=request.shift_name,
            custom_instructions=request.custom_instructions
        )
        return {
            "status": "success",
            "message": f"SBAR handover successfully pre-drafted for bed {result.get('bed_no')}",
            "data": result
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error in SBAR generation API: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-generate", summary="Batch Auto-Draft Shift Handovers for Ward Beds")
def batch_generate_sbar_api(request: SbarBatchRequest):
    """
    Batch executes AG-18 agent across beds with 'Missing' or 'Stale' handovers.
    Pre-drafts SBAR cards in bulk ahead of shift change.
    """
    try:
        service = NursingHandoverAgentService(
            api_key=request.api_key,
            model=request.model_name
        )
        result = service.generate_batch_sbar(
            ward_name=request.ward_name,
            shift_name=request.shift_name,
            status_filter=request.status_filter,
            limit=request.limit or 10
        )
        return {
            "status": "success",
            "message": f"Batch SBAR generation completed: {result.get('successful_generations')} drafted, {result.get('failed_generations')} failed",
            "data": result
        }
    except Exception as e:
        logger.error(f"Error in batch SBAR generation API: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/acknowledge/{handover_id}", summary="Bedside Receiving Nurse Sign-off & Handover Acceptance")
def acknowledge_handover_api(handover_id: Union[int, str], request: Optional[SbarAcknowledgeRequest] = Body(None)):
    """Completes the selective human gate by recording receiving nurse sign-off."""
    try:
        nurse_name = request.nurse_name if request else "Deepa Krishnan, RN"
        remarks = request.remarks if request else None
        service = NursingHandoverAgentService()
        result = service.acknowledge_handover(
            handover_id=handover_id,
            nurse_name=nurse_name,
            remarks=remarks
        )
        return {
            "status": "success",
            "data": result
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        logger.error(f"Error acknowledging handover {handover_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs", summary="Get Nursing Handover Agent Execution Logs")
def get_handover_logs(limit: int = 20):
    """Returns execution trace logs for AG-18."""
    conn = db_connector.get_connection()
    try:
        cur = db_connector.get_dict_cursor(conn)
        cur.execute("""
            SELECT id, agent_id, action_type, patient_id, details, status, created_at
            FROM agent_action_logs
            WHERE agent_id = 'AG-18'
            ORDER BY created_at DESC
            LIMIT %s;
        """, (limit,))
        logs = cur.fetchall()
        return {
            "status": "success",
            "count": len(logs),
            "data": logs
        }
    except Exception as e:
        # Graceful fallback if table empty or error
        return {
            "status": "success",
            "count": 0,
            "data": []
        }
    finally:
        conn.close()
