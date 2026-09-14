"""
Radiology AI Module Router for Healthcare Application.

Exposes:
  GET  /api/radiology/health
  GET  /api/radiology/model-info
  POST /api/radiology/analyze
  GET  /api/radiology/worklist
  GET  /api/radiology/studies/{study_id}
  POST /api/radiology/studies/{study_id}/viewed
  GET  /api/pacs/health
  GET  /api/pacs/studies
  POST /api/pacs/analyze/{study_id}
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException

from radiology import config
from radiology.services.densenet_service import load_densenet_model, DenseNetInferenceError
from radiology.services.yolo_service import load_yolo_model, YoloInferenceError
from radiology.services.inference_service import run_full_analysis, InferenceError
from radiology.services.study_store import save_study, get_study, list_studies, mark_study_viewed
from radiology.services.worklist_service import to_worklist_item, sort_worklist, compute_counts
from radiology.services.pacs_watcher_service import start_watcher, stop_watcher, get_status as get_pacs_watcher_status
from radiology.services.orthanc_service import (
    health as orthanc_health,
    get_studies as orthanc_get_studies,
    get_study as orthanc_get_study,
    get_first_instance_for_study,
    get_instance_file,
    OrthancError,
)
from radiology.schemas.inference import (
    HealthResponse,
    ModelInfoResponse,
    AnalyzeResponse,
    WorklistResponse,
    StudyDetailResponse,
    PacsHealthResponse,
    PacsStudiesResponse,
    ViewedStatusResponse,
)

logger = logging.getLogger("healthcare.radiology")

router = APIRouter(tags=["AI Radiology"])

_state = {
    "device": "cpu",
    "densenet_model": None,
    "yolo_model": None,
    "initialized": False,
}


def init_radiology_models():
    """Initializes the DenseNet and YOLO models once."""
    if _state["initialized"]:
        return

    try:
        import torch
        _state["device"] = "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        _state["device"] = "cpu"

    logger.info("Initializing Radiology AI models on device: %s", _state["device"])

    try:
        _state["densenet_model"] = load_densenet_model(device=_state["device"])
        logger.info("DenseNet121 model loaded successfully.")
    except Exception as e:
        logger.error("Failed to load DenseNet model: %s", e)
        _state["densenet_model"] = None

    try:
        _state["yolo_model"] = load_yolo_model(device=_state["device"])
        logger.info("YOLO11n model loaded successfully.")
    except Exception as e:
        logger.error("Failed to load YOLO model: %s", e)
        _state["yolo_model"] = None

    if _state["densenet_model"] is not None and _state["yolo_model"] is not None:
        try:
            start_watcher(_process_pacs_study_core, interval_seconds=config.PACS_POLL_INTERVAL_SECONDS)
        except Exception as e:
            logger.warning("Could not start PACS watcher: %s", e)
    else:
        logger.warning("PACS watcher not started because AI models are not loaded.")

    _state["initialized"] = True


def shutdown_radiology_models():
    """Stops background watchers and unloads models."""
    try:
        stop_watcher()
    except Exception:
        pass
    _state["densenet_model"] = None
    _state["yolo_model"] = None
    _state["initialized"] = False


def _process_pacs_study_core(study_id: str, ingested_at: str | None = None) -> dict:
    if _state["densenet_model"] is None or _state["yolo_model"] is None:
        raise RuntimeError("Radiology AI models are not available.")

    ref = get_first_instance_for_study(study_id)
    orthanc_study = orthanc_get_study(study_id)
    study_instance_uid = (orthanc_study.get("MainDicomTags") or {}).get("StudyInstanceUID")
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

    analyzed_at = datetime.now(timezone.utc).isoformat()
    save_study({
        **result,
        "ingested_at": ingested_at,
        "analyzed_at": analyzed_at,
        "source_filename": f"orthanc:{ref.instance_id}",
    })
    return result


@router.get("/api/radiology/health", response_model=HealthResponse)
def radiology_health():
    return HealthResponse(
        status="healthy" if (_state["densenet_model"] and _state["yolo_model"]) else "degraded",
        densenet_loaded=_state["densenet_model"] is not None,
        yolo_loaded=_state["yolo_model"] is not None,
    )


@router.get("/api/radiology/model-info", response_model=ModelInfoResponse)
def model_info():
    return ModelInfoResponse(
        densenet_model_name="DenseNet121 (chest X-ray triage classifier)",
        yolo_model_name="YOLO11n (lung opacity localization)",
        classification_threshold=config.CLASSIFICATION_THRESHOLD,
        localization_threshold=config.LOCALIZATION_THRESHOLD,
        iou_match_threshold=config.IOU_MATCH_THRESHOLD,
        poc_version=config.POC_VERSION,
        densenet_preprocessing_confirmed=config.DENSENET_PREPROCESSING_CONFIRMED,
        disclaimer=config.DISCLAIMER,
    )


@router.post("/api/radiology/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile = File(...)):
    if _state["densenet_model"] is None or _state["yolo_model"] is None:
        raise HTTPException(
            status_code=503,
            detail="AI models are not available. Please verify model files and dependencies.",
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file was uploaded.")

    lower_name = file.filename.lower()
    if not (lower_name.endswith(".dcm") or lower_name.endswith(".dicom")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a chest X-ray in DICOM (.dcm) format.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        result = run_full_analysis(
            file_bytes,
            densenet_model=_state["densenet_model"],
            yolo_model=_state["yolo_model"],
            device=_state["device"],
        )
    except InferenceError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to process this X-ray. {e}",
        )
    except Exception as e:
        logger.exception("Unexpected error during analysis")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while analyzing this X-ray. Please try again.",
        )

    save_study({
        **result,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "source_filename": file.filename,
    })

    return result


@router.get("/api/radiology/worklist", response_model=WorklistResponse)
def worklist():
    records = list_studies()
    items = [to_worklist_item(r) for r in records]
    items = sort_worklist(items)
    counts = compute_counts(items)
    return {"studies": items, "counts": counts}


@router.get("/api/radiology/studies/{study_id}", response_model=StudyDetailResponse)
def study_detail(study_id: str):
    record = get_study(study_id)
    if record is None:
        raise HTTPException(status_code=404, detail="No analysis found for this study ID.")
    return record


@router.post("/api/radiology/studies/{study_id}/viewed", response_model=ViewedStatusResponse)
def mark_viewed(study_id: str):
    viewed_at = datetime.now(timezone.utc).isoformat()
    record = mark_study_viewed(study_id, viewed_at)
    if record is None:
        raise HTTPException(status_code=404, detail="No analysis found for this study ID.")
    return {
        "study_id": study_id,
        "viewed": record.get("viewed", False),
        "viewed_at": record.get("viewed_at"),
    }


@router.get("/api/pacs/health", response_model=PacsHealthResponse)
def pacs_health():
    try:
        return orthanc_health()
    except OrthancError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/api/pacs/studies", response_model=PacsStudiesResponse)
def pacs_studies():
    try:
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
        enriched.sort(
            key=lambda study: study.get("ingested_at") or "",
            reverse=True,
        )
        return {"source": "Orthanc Demo PACS", "studies": enriched}
    except OrthancError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/api/pacs/analyze/{study_id}", response_model=AnalyzeResponse)
def pacs_analyze(study_id: str):
    if _state["densenet_model"] is None or _state["yolo_model"] is None:
        raise HTTPException(
            status_code=503,
            detail="AI models are not available. Please contact support.",
        )

    try:
        status = get_pacs_watcher_status(study_id)
        return _process_pacs_study_core(study_id, status.get("ingested_at"))
    except OrthancError as e:
        status_code = 404 if "not found" in str(e).lower() else 502
        raise HTTPException(status_code=status_code, detail=str(e))
    except InferenceError as e:
        raise HTTPException(status_code=400, detail=f"Unable to analyze the selected PACS study. {e}")
    except Exception:
        logger.exception("Unexpected error during PACS study analysis")
        raise HTTPException(
            status_code=500,
            detail="Unable to analyze the selected PACS study.",
        )
