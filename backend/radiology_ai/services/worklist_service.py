"""
Radiology Worklist helpers: turns saved analysis records into the compact
list-view shape and computes the default prioritization order and summary
counts.

No inference happens here. Every value used already exists on the stored
record produced by services/inference_service.py - this module only
selects, reshapes, sorts, and counts.
"""
from typing import Any, Dict, List, Optional

try:
    from db import get_patient_mapping_by_original_id, get_patient_mapping_by_original_ids
except ImportError:
    try:
        from radiology_ai.db import get_patient_mapping_by_original_id, get_patient_mapping_by_original_ids
    except ImportError:
        get_patient_mapping_by_original_id = lambda x: None
        get_patient_mapping_by_original_ids = lambda x: {}

# Default triage priority ranking (lower = shown first)
_STATUS_RANK = {
    "HIGH PRIORITY": 0,
    "REVIEW FLAG": 1,
    "ROUTINE": 2,
}


def to_worklist_item(record: dict, mapping: Optional[dict] = None) -> dict:
    """Reshape a full stored analysis record into the compact worklist item."""
    regions = record["localization"]["regions"]
    highest_confidence = max((r["confidence"] for r in regions), default=None)

    # Determine original patient UUID
    orig_uuid = (
        record.get("original_patient_id")
        or record.get("metadata", {}).get("patient_id")
        or record.get("study_id")
    )
    patient_info = None
    if orig_uuid:
        orig_uuid_str = str(orig_uuid).strip()
        if mapping and orig_uuid_str in mapping:
            patient_info = mapping[orig_uuid_str]
        elif not mapping:
            try:
                patient_info = get_patient_mapping_by_original_id(orig_uuid_str)
            except Exception:
                patient_info = None

    patient_id = record.get("patient_id") or (patient_info.get("patient_id") if patient_info else None)
    patient_code = record.get("patient_code") or (patient_info.get("patient_code") if patient_info else None)
    patient_name = record.get("patient_name") or (patient_info.get("patient_name") if patient_info else None)

    metadata = dict(record.get("metadata", {}))
    if patient_id is not None:
        metadata["patient_id_mapped"] = patient_id
    if patient_code:
        metadata["patient_code"] = patient_code
    if patient_name:
        # If original metadata patient_name was just the raw UUID or missing, replace with friendly name
        raw_pname = str(metadata.get("patient_name", "")).strip()
        if not raw_pname or raw_pname == str(orig_uuid).strip():
            metadata["patient_name"] = patient_name

    return {
        "study_id": record["study_id"],
        "display_study_id": record.get("display_study_id"),
        "patient_id": patient_id,
        "patient_code": patient_code,
        "original_patient_id": str(orig_uuid) if orig_uuid else None,
        "patient_name": patient_name or metadata.get("patient_name"),
        "source": record.get("source"),
        "analyzed_at": record["analyzed_at"],
        "viewed": record.get("viewed", False),
        "viewed_at": record.get("viewed_at"),
        "review_status": record.get("review_status", "Unread"),
        "reviewed_at": record.get("reviewed_at"),
        "source_filename": record.get("source_filename"),
        "metadata": metadata,
        "triage": record["triage"],
        "localization_summary": {
            "opacity_detected": record["localization"]["opacity_detected"],
            "threshold": record["localization"]["threshold"],
            "number_of_regions": record["localization"]["number_of_regions"],
            "highest_confidence": highest_confidence,
        },
        "combined_assessment": record["combined_assessment"],
        "thumbnail": record["images"]["original"],
    }


def enrich_study_detail(record: dict, mapping: Optional[dict] = None) -> dict:
    """Ensure record has patient_id, patient_code, original_patient_id, patient_name populated."""
    orig_uuid = (
        record.get("original_patient_id")
        or record.get("metadata", {}).get("patient_id")
        or record.get("study_id")
    )
    patient_info = None
    if orig_uuid:
        orig_uuid_str = str(orig_uuid).strip()
        if mapping and orig_uuid_str in mapping:
            patient_info = mapping[orig_uuid_str]
        else:
            try:
                patient_info = get_patient_mapping_by_original_id(orig_uuid_str)
            except Exception:
                patient_info = None

    if patient_info:
        if not record.get("patient_id"):
            record["patient_id"] = patient_info.get("patient_id")
        if not record.get("patient_code"):
            record["patient_code"] = patient_info.get("patient_code")
        if not record.get("patient_name"):
            record["patient_name"] = patient_info.get("patient_name")
        if not record.get("original_patient_id"):
            record["original_patient_id"] = orig_uuid

        if "metadata" in record and isinstance(record["metadata"], dict):
            record["metadata"]["patient_id_mapped"] = patient_info.get("patient_id")
            record["metadata"]["patient_code"] = patient_info.get("patient_code")
            raw_pname = str(record["metadata"].get("patient_name", "")).strip()
            if patient_info.get("patient_name") and (not raw_pname or raw_pname == str(orig_uuid).strip()):
                record["metadata"]["patient_name"] = patient_info.get("patient_name")

    return record


def default_sort_key(item: dict):
    """
    Default worklist ordering (Section 6/14 of the brief):
      1. Unviewed studies first; viewed studies move to the bottom
      2. Inside each group, triage priority: HIGH PRIORITY -> REVIEW FLAG -> ROUTINE
      3. Within each category, DenseNet probability descending
    Uses only the existing triage probability and combined status - no new
    "combined probability" is invented.
    """
    # Unviewed studies always stay above viewed studies. Triage priority itself
    # is never changed: a viewed HIGH PRIORITY study is still HIGH PRIORITY.
    viewed_rank = 1 if item.get("viewed", False) else 0
    status_rank = _STATUS_RANK.get(item["combined_assessment"]["status"], 3)
    return (viewed_rank, status_rank, -item["triage"]["probability"])


def sort_worklist(items: List[dict]) -> List[dict]:
    return sorted(items, key=default_sort_key)


def compute_counts(items: List[dict]) -> dict:
    counts = {"total": len(items), "high_priority": 0, "review_flag": 0, "routine": 0}
    for item in items:
        status = item["combined_assessment"]["status"]
        if status == "HIGH PRIORITY":
            counts["high_priority"] += 1
        elif status == "REVIEW FLAG":
            counts["review_flag"] += 1
        elif status == "ROUTINE":
            counts["routine"] += 1
    return counts
