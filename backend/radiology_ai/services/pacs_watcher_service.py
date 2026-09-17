"""Background watcher for the Orthanc Demo PACS.

The watcher is intentionally small and PoC-focused:
- polls Orthanc for newly arrived studies,
- records the Orthanc ingestion timestamp,
- analyzes each Orthanc study once per backend process,
- saves the completed result through the existing study store/worklist path.

It does NOT contain any DICOM/model/decision logic.  The caller supplies a
single analyze callback that reuses the application's existing inference
pipeline.
"""
from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from typing import Callable, Optional

from radiology_ai.services.orthanc_service import get_studies, OrthancError

logger = logging.getLogger("meridian.pacs_watcher")

_lock = threading.Lock()
_states: dict[str, dict] = {}
_thread: Optional[threading.Thread] = None
_stop_event: Optional[threading.Event] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_state(study: dict) -> dict:
    study_id = study["study_id"]
    with _lock:
        state = _states.get(study_id)
        if state is None:
            from radiology_ai.services.study_store import get_study
            existing = get_study(study_id)
            if existing:
                state = {
                    "study_id": study_id,
                    "ingested_at": existing.get("ingested_at") or study.get("ingested_at") or _now_iso(),
                    "analysis_status": "ANALYZED",
                    "analysis_error": None,
                    "analyzed_at": existing.get("analyzed_at") or _now_iso(),
                }
            else:
                state = {
                    "study_id": study_id,
                    "ingested_at": study.get("ingested_at") or _now_iso(),
                    "analysis_status": "PENDING",
                    "analysis_error": None,
                    "analyzed_at": None,
                }
            _states[study_id] = state
        elif not state.get("ingested_at") and study.get("ingested_at"):
            state["ingested_at"] = study["ingested_at"]
        return dict(state)


def get_status(study_id: str) -> dict:
    with _lock:
        state = _states.get(study_id)
        if state is None:
            from radiology_ai.services.study_store import get_study
            existing = get_study(study_id)
            if existing:
                state = {
                    "study_id": study_id,
                    "ingested_at": existing.get("ingested_at") or _now_iso(),
                    "analysis_status": "ANALYZED",
                    "analysis_error": None,
                    "analyzed_at": existing.get("analyzed_at") or _now_iso(),
                }
                _states[study_id] = state
                return dict(state)
            return {
                "study_id": study_id,
                "ingested_at": None,
                "analysis_status": "PENDING",
                "analysis_error": None,
                "analyzed_at": None,
            }
        return dict(state)


def list_statuses() -> dict[str, dict]:
    with _lock:
        return {sid: dict(state) for sid, state in _states.items()}


def _set_status(study_id: str, **updates) -> None:
    with _lock:
        state = _states.setdefault(
            study_id,
            {
                "study_id": study_id,
                "ingested_at": _now_iso(),
                "analysis_status": "PENDING",
                "analysis_error": None,
                "analyzed_at": None,
            },
        )
        state.update(updates)


def scan_once(analyze_study: Callable[[str, str], None]) -> None:
    """Check Orthanc once and analyze every study not already completed.

    ``analyze_study`` receives ``(orthanc_study_id, ingested_at)`` and is
    responsible for fetching the DICOM, running the existing inference
    pipeline, and saving the successful result to the existing worklist store.
    """
    studies = get_studies()

    for study in studies:
        state = _ensure_state(study)
        study_id = study["study_id"]

        # Once completed, the same Orthanc study must never be re-analyzed by
        # this watcher during the lifetime of the backend process.
        if state["analysis_status"] in {"ANALYZED", "ANALYZING"}:
            continue

        ingested_at = state["ingested_at"]
        _set_status(study_id, analysis_status="ANALYZING", analysis_error=None)
        logger.info("Auto-analyzing new Demo PACS study %s", study_id)

        try:
            analyze_study(study_id, ingested_at)
        except Exception as exc:  # keep watcher alive after an individual failure
            logger.exception("Automatic Demo PACS analysis failed for study %s", study_id)
            _set_status(
                study_id,
                analysis_status="FAILED",
                analysis_error=str(exc) or "Automatic analysis failed.",
            )
        else:
            _set_status(
                study_id,
                analysis_status="ANALYZED",
                analysis_error=None,
                analyzed_at=_now_iso(),
            )
            logger.info("Demo PACS study %s analyzed and added to worklist", study_id)


def start_watcher(analyze_study: Callable[[str, str], None], interval_seconds: int = 2) -> None:
    global _thread, _stop_event

    if _thread is not None and _thread.is_alive():
        return

    _stop_event = threading.Event()

    def _run() -> None:
        logger.info("Demo PACS auto-analysis watcher started (poll every %ss)", interval_seconds)
        while _stop_event is not None and not _stop_event.is_set():
            try:
                scan_once(analyze_study)
            except OrthancError as exc:
                # Orthanc may be started after the API.  This is not fatal;
                # retry on the next poll rather than killing the backend.
                logger.warning("Demo PACS watcher could not reach Orthanc: %s", exc)
            except Exception:
                logger.exception("Unexpected Demo PACS watcher error")

            if _stop_event is not None:
                _stop_event.wait(max(1, interval_seconds))

        logger.info("Demo PACS auto-analysis watcher stopped")

    _thread = threading.Thread(target=_run, name="meridian-pacs-watcher", daemon=True)
    _thread.start()


def stop_watcher() -> None:
    global _thread, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    if _thread is not None and _thread.is_alive():
        _thread.join(timeout=3)
    _thread = None
    _stop_event = None
