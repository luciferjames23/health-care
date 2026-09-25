from __future__ import annotations

import logging
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
import sys

from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, File, HTTPException, UploadFile, Query, Body, Depends

from api.auth_helper import require_radiologist, require_radiologist_or_doctor
from radiology_ai import config
from radiology_ai import db as radiology_db
from radiology_ai.services.densenet_service import load_densenet_model
from radiology_ai.services.inference_service import InferenceError, run_full_analysis
from radiology_ai.services.orthanc_service import (
    OrthancError,
    ensure_localized_series,
    get_first_instance_for_study,
    get_instance_file,
    get_studies as orthanc_get_studies,
    get_study as orthanc_get_study,
    health as orthanc_health,
)
from radiology_ai.services.pacs_watcher_service import (
    get_status as get_pacs_watcher_status,
    start_watcher,
    stop_watcher,
)
from radiology_ai.services.study_store import (
    get_study,
    list_studies,
    mark_study_viewed,
    save_study,
    update_review_status,
)
from radiology_ai.services.worklist_service import compute_counts, sort_worklist, to_worklist_item, enrich_study_detail
from radiology_ai.db import get_patient_mapping_by_original_ids, update_study_report_in_db
from radiology_ai.services.yolo_service import load_yolo_model
from radiology_ai.schemas.inference import (
    AnalyzeResponse,
    HealthResponse,
    ModelInfoResponse,
    PacsHealthResponse,
    PacsStudiesResponse,
    StudyDetailResponse,
    ViewedStatusResponse,
    WorklistResponse,
    ReviewStatusRequest,
)

logger = logging.getLogger("meridian.radiology.integration")
router = APIRouter(prefix="/api/radiology", tags=["Radiology AI"])
pacs_router = APIRouter(prefix="/api/pacs", tags=["Radiology Demo PACS"], dependencies=[Depends(require_radiologist)])
# Scan-viewing endpoints are open to Doctors AND Radiologists; no router-level guard here.
scans_router = APIRouter(prefix="/api/radiology", tags=["Radiology Scans"])

_state = {"device": "cuda" if __import__("torch").cuda.is_available() else "cpu", "densenet_model": None, "yolo_model": None}
_initialized = False


def initialize_radiology() -> None:
    """Load the existing models once and start the existing PACS watcher."""
    global _initialized
    if _initialized:
        return
    _initialized = True
    logger.info("Starting integrated Meridian Radiology AI backend. Device: %s", _state["device"])
    try:
        _state["densenet_model"] = load_densenet_model(device=_state["device"])
        logger.info("DenseNet121 model loaded successfully.")
    except Exception:
        logger.exception("Failed to load DenseNet121 model")
    try:
        _state["yolo_model"] = load_yolo_model(device=_state["device"])
        logger.info("YOLO11n model loaded successfully.")
    except Exception:
        logger.exception("Failed to load YOLO11n model")

    if _state["densenet_model"] is not None and _state["yolo_model"] is not None:
        start_watcher(_process_pacs_study_core, interval_seconds=config.PACS_POLL_INTERVAL_SECONDS)


def shutdown_radiology() -> None:
    global _initialized
    stop_watcher()
    _state["densenet_model"] = None
    _state["yolo_model"] = None
    _initialized = False


def _require_models() -> None:
    initialize_radiology()
    if _state["densenet_model"] is None or _state["yolo_model"] is None:
        raise HTTPException(status_code=503, detail="AI models are not available. Please contact support.")


def _process_pacs_study_core(study_id: str, ingested_at: str | None = None) -> dict:
    orthanc_study = orthanc_get_study(study_id)
    study_instance_uid = (orthanc_study.get("MainDicomTags") or {}).get("StudyInstanceUID")
    from routers.imaging_orders import patient_for_ordered_study
    order = patient_for_ordered_study(study_instance_uid)
    if not order:
        raise HTTPException(409, 'This PACS study is not linked to an uploaded X-ray order. Use X-ray Orders to upload the requested image.')
    existing = get_study(str(order['study_key']))
    if existing:
        return existing
    ref = get_first_instance_for_study(study_id, order['orthanc_instance_id'])
    file_bytes = get_instance_file(ref.instance_id)
    result = run_full_analysis(
        file_bytes,
        densenet_model=_state["densenet_model"],
        yolo_model=_state["yolo_model"],
        device=_state["device"],
    )
    result["source"] = {
        "type": "demo_pacs",
        "system": "Orthanc",
        "study_id": ref.study_id,
        "series_id": ref.series_id,
        "instance_id": ref.instance_id,
        "study_instance_uid": study_instance_uid,
    }
    result.update(ingested_at=ingested_at, analyzed_at=datetime.now(timezone.utc).isoformat(),
                  source_filename=f"orthanc:{ref.instance_id}")
    save_study(result)

    return result


@router.get("/health", response_model=HealthResponse)
def radiology_health():
    initialize_radiology()
    return {
        "status": "healthy" if (_state["densenet_model"] is not None and _state["yolo_model"] is not None) else "degraded",
        "densenet_loaded": _state["densenet_model"] is not None,
        "yolo_loaded": _state["yolo_model"] is not None,
    }


@router.get("/model-info", response_model=ModelInfoResponse)
def model_info():
    return {
        "densenet_model_name": "DenseNet121 (chest X-ray triage classifier)",
        "yolo_model_name": "YOLO11n (lung opacity localization)",
        "classification_threshold": config.CLASSIFICATION_THRESHOLD,
        "localization_threshold": config.LOCALIZATION_THRESHOLD,
        "iou_match_threshold": config.IOU_MATCH_THRESHOLD,
        "poc_version": config.POC_VERSION,
        "densenet_preprocessing_confirmed": config.DENSENET_PREPROCESSING_CONFIRMED,
        "disclaimer": config.DISCLAIMER,
    }


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile = File(...), _user: dict = Depends(require_radiologist)):
    raise HTTPException(409, 'Select the patient request in X-ray Orders and upload there. Analysis starts after the order upload completes.')


@router.get("/worklist", response_model=WorklistResponse)
def worklist(user: dict = Depends(require_radiologist_or_doctor)):
    role = str(user.get("role", "")).lower()
    is_doctor = role == "doctor"
    doctor_user_id = user.get("user_id") if is_doctor else None
    doctor_id = user.get("doctor_id") if is_doctor else None
    doctor_name = user.get("name") if is_doctor else None
    records = list_studies(doctor_user_id=doctor_user_id, doctor_id=doctor_id, doctor_name=doctor_name)
    raw_ids = [
        r.get("original_patient_id") or r.get("metadata", {}).get("patient_id") or r.get("study_id")
        for r in records
    ]
    mapping = get_patient_mapping_by_original_ids([x for x in raw_ids if x])
    items = sort_worklist([to_worklist_item(r, mapping) for r in records])
    return {"studies": items, "counts": compute_counts(items)}


def authorize_study(record, user):
    if str(user.get('role', '')).lower() == 'doctor':
        from routers.radiology_clarifications import order_access
        from psycopg2.extras import RealDictCursor
        import db_config
        with db_config.get_db_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            order_access(cur, record['order_id'], {**user, 'role': 'doctor'})


@router.get("/studies/{study_id}", response_model=StudyDetailResponse)
def study_detail(study_id: str, _user: dict = Depends(require_radiologist_or_doctor)):
    record = get_study(study_id)
    if record is None:
        raise HTTPException(status_code=404, detail="No analysis found for this study ID.")
    authorize_study(record, _user)
    record = enrich_study_detail(record)
    return record


@router.post("/studies/{study_id}/ohif-localized")
def localized_ohif(study_id: str, _user: dict = Depends(require_radiologist_or_doctor)):
    record = get_study(study_id)
    if record is None:
        raise HTTPException(status_code=404, detail="No analysis found for this study ID.")
    authorize_study(record, _user)
    try:
        return ensure_localized_series(record)
    except OrthancError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/studies/{study_id}/viewed", response_model=ViewedStatusResponse)
def viewed(study_id: str, _user: dict = Depends(require_radiologist_or_doctor)):
    existing = get_study(study_id)
    if existing is None:
        raise HTTPException(404, 'No analysis found for this study ID.')
    authorize_study(existing, _user)
    stamp = datetime.now(timezone.utc).isoformat()
    record = mark_study_viewed(study_id, stamp)
    if record is None:
        raise HTTPException(status_code=404, detail="No analysis found for this study ID.")
    return {"study_id": study_id, "viewed": record.get("viewed", False), "viewed_at": record.get("viewed_at")}


@router.post("/studies/{study_id}/review", response_model=StudyDetailResponse)
def review_study(study_id: str, request: ReviewStatusRequest, reviewer: dict = Depends(require_radiologist)):
    """Record radiologist review workflow state and revised clinical report."""
    allowed = {
        "No acute finding",
        "Finding not confirmed",
        "Reviewed",
        "Confirm AI Finding",
        "Finding Not Confirmed",
        "Needs Further Review",
        "Confirmed",
        "Confirmed (Finding Revised)",
    }
    if request.review_status not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported review status.")

    existing = get_study(study_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="No analysis found for this study ID.")

    report = request.report
    if not report:
        report = existing.get("radiologist_report") or existing.get("interpretation", {}).get("summary") or existing.get("scan_report")
    finding = request.finding or existing.get("radiologist_finding") or existing.get("interpretation", {}).get("finding")

    reviewed_at = datetime.now(timezone.utc).isoformat()
    record = update_review_status(
        study_id,
        request.review_status,
        reviewed_at,
        reviewed_by=reviewer["name"],
        report=report,
        finding=finding,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="No analysis found for this study ID.")

    authorize_study(record, _user)
    record = enrich_study_detail(record)
    return record




@pacs_router.get("/health", response_model=PacsHealthResponse)
def pacs_health():
    try:
        return orthanc_health()
    except OrthancError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@pacs_router.get("/studies", response_model=PacsStudiesResponse)
def pacs_studies():
    initialize_radiology()
    try:
        # Check and process any unanalyzed studies immediately
        if _state["densenet_model"] is not None and _state["yolo_model"] is not None:
            try:
                from radiology_ai.services.pacs_watcher_service import scan_once
                scan_once(_process_pacs_study_core)
            except Exception as e:
                logger.warning("Immediate PACS scan error: %s", e)

        studies = orthanc_get_studies()
        enriched = []
        for study in studies:
            status = get_pacs_watcher_status(study["study_id"])
            enriched.append({
                **study,
                "ingested_at": status.get("ingested_at") or study.get("ingested_at"),
                "analysis_status": status.get("analysis_status", "PENDING"),
                "analysis_error": status.get("analysis_error"),
                "analyzed_at": status.get("analyzed_at"),
            })
        enriched.sort(key=lambda s: s.get("ingested_at") or "", reverse=True)
        return {"source": "Orthanc Demo PACS", "studies": enriched}
    except OrthancError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@pacs_router.post("/analyze/{study_id}", response_model=AnalyzeResponse)
def pacs_analyze(study_id: str):
    _require_models()
    try:
        status = get_pacs_watcher_status(study_id)
        return _process_pacs_study_core(study_id, status.get("ingested_at"))
    except OrthancError as exc:
        raise HTTPException(status_code=404 if "not found" in str(exc).lower() else 502, detail=str(exc)) from exc
    except InferenceError as exc:
        raise HTTPException(status_code=400, detail=f"Unable to analyze the selected PACS study. {exc}") from exc


# Backward-compatible alias used by the integration tests/consumers.
radiology_state = _state

class UpdateScanRequest(BaseModel):
    image: Optional[str] = None
    scan_report: Optional[str] = None


# ── Scan-viewing endpoints (Doctor + Radiologist) ─────────────────────────────
# These live on scans_router which has NO router-level require_radiologist guard.
# Per-route require_radiologist_or_doctor enforces that only clinical staff can
# read scan data; the full radiology review/worklist workflow remains locked to
# Radiologists via the main `router` above.

@scans_router.get("/scans")
def list_scans_endpoint(
    patient_id: Optional[int] = Query(None, description="Filter by admitted patient ID"),
    patient_code: Optional[str] = Query(None, description="Filter by patient code (e.g., MER-PAT-0087374)"),
    search: Optional[str] = Query(None, description="Search by patient code, name, or original patient ID"),
    target: Optional[int] = Query(None, description="Filter by target (1=opacity, 0=normal)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _user: dict = Depends(require_radiologist_or_doctor),
):
    """Retrieve radiology scans stored in PostgreSQL (accessible to Doctors and Radiologists)."""
    return radiology_db.list_scans(
        patient_id=patient_id,
        patient_code=patient_code,
        search=search,
        target=target,
        limit=limit,
        offset=offset
    )


@scans_router.get("/scans/{scan_id}")
def get_scan_endpoint(scan_id: int, _user: dict = Depends(require_radiologist_or_doctor)):
    """Retrieve a single radiology scan by scan_id (accessible to Doctors and Radiologists)."""
    scan = radiology_db.get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Radiology scan record not found")
    return scan


@router.put("/scans/{scan_id}")
def update_scan_endpoint(scan_id: int, payload: UpdateScanRequest, _user: dict = Depends(require_radiologist)):
    """Update empty image data and/or scan report text for a radiology scan."""
    updated = radiology_db.update_scan_image_and_report(
        scan_id=scan_id,
        image=payload.image,
        scan_report=payload.scan_report,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Radiology scan record not found")
    return {"status": "success", "scan": updated}


@scans_router.get("/admitted-patients")
def get_admitted_patients_endpoint(_user: dict = Depends(require_radiologist_or_doctor)):
    """List currently admitted patients available in the PostgreSQL Lakehouse."""
    patients = radiology_db.get_currently_admitted_patients()
    return {"count": len(patients), "patients": patients}
