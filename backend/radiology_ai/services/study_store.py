"""
In-memory storage for completed analysis results, powering the Radiology
Worklist.

Scope note (PoC-appropriate, documented deliberately): this is a
module-level, in-process store. It persists results for the lifetime of the
running backend process (so "analyze A, B, C, then open the worklist" and
"analyze another study and see the worklist update" both work correctly),
but it does NOT survive a server restart. Reaching for a database was
explicitly out of scope for the earlier phases of this PoC; if durable
persistence across restarts is needed later, swap the dict below for a
lightweight file-backed JSON store or SQLite table behind this exact same
three-function interface (save_study / get_study / list_studies) - nothing
else in the app would need to change.

Only SUCCESSFUL analyses are ever stored (main.py calls save_study() after
run_full_analysis() succeeds), so every study here genuinely completed.
"""
import threading
from typing import Dict, List, Optional

_lock = threading.Lock()
_studies: Dict[str, dict] = {}
_order: List[str] = []  # insertion order, oldest first
_next_display_number = 1


def save_study(record: dict) -> None:
    """Store (or overwrite) a completed analysis result, keyed by study_id.

    A short human-readable display ID is assigned only for presentation in
    the worklist. The original UUID remains the authoritative identifier used
    by APIs and navigation. Because this PoC intentionally uses in-memory
    storage, the display sequence also resets when the backend restarts.
    """
    global _next_display_number
    study_id = record["study_id"]
    with _lock:
        existing = _studies.get(study_id)
        if existing and existing.get("display_study_id"):
            record["display_study_id"] = existing["display_study_id"]
        else:
            record["display_study_id"] = f"XR-{_next_display_number:04d}"
            _next_display_number += 1

        if existing:
            if existing.get("review_status") and not record.get("review_status"):
                record["review_status"] = existing["review_status"]
            if existing.get("reviewed_by") and not record.get("reviewed_by"):
                record["reviewed_by"] = existing["reviewed_by"]
            if existing.get("reviewed_at") and not record.get("reviewed_at"):
                record["reviewed_at"] = existing["reviewed_at"]
            if existing.get("radiologist_finding") and not record.get("radiologist_finding"):
                record["radiologist_finding"] = existing["radiologist_finding"]
            if existing.get("radiologist_report") and not record.get("radiologist_report"):
                record["radiologist_report"] = existing["radiologist_report"]
            if existing.get("scan_report") and not record.get("scan_report"):
                record["scan_report"] = existing["scan_report"]

        if study_id not in _studies:
            _order.append(study_id)
        _studies[study_id] = record


def get_study(study_id: str) -> Optional[dict]:
    """Retrieve a single previously saved analysis result, or None."""
    with _lock:
        return _studies.get(study_id)


def list_studies() -> List[dict]:
    """Return all saved analysis results, oldest-analyzed first."""
    with _lock:
        return [_studies[sid] for sid in _order]


def mark_study_viewed(study_id: str, viewed_at: str) -> Optional[dict]:
    """Mark a study as viewed without changing any AI/triage fields."""
    with _lock:
        record = _studies.get(study_id)
        if record is not None and not record.get("viewed"):
            record["viewed"] = True
            record["viewed_at"] = viewed_at
        return record


def update_review_status(
    study_id: str,
    review_status: str,
    reviewed_at: str,
    reviewed_by: Optional[str] = None,
    report: Optional[str] = None,
    finding: Optional[str] = None,
) -> Optional[dict]:
    """Record radiologist workflow state and optional custom finding/report."""
    with _lock:
        record = _studies.get(study_id)
        if record is None:
            return None
        record["review_status"] = review_status
        record["reviewed_at"] = reviewed_at
        if reviewed_by:
            record["reviewed_by"] = reviewed_by
        if report:
            record["scan_report"] = report
            record["radiologist_report"] = report
            if "interpretation" in record and isinstance(record["interpretation"], dict):
                record["interpretation"]["summary"] = report
                record["interpretation"]["assessment"] = report
        if finding:
            record["radiologist_finding"] = finding
            if "interpretation" in record and isinstance(record["interpretation"], dict):
                record["interpretation"]["finding"] = finding
        return record
