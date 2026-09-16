"""
Radiology Worklist helpers: turns saved analysis records into the compact
list-view shape and computes the default prioritization order and summary
counts.

No inference happens here. Every value used already exists on the stored
record produced by services/inference_service.py - this module only
selects, reshapes, sorts, and counts.
"""
from typing import List

# Default triage priority ranking (lower = shown first)
_STATUS_RANK = {
    "HIGH PRIORITY": 0,
    "REVIEW FLAG": 1,
    "ROUTINE": 2,
}


def to_worklist_item(record: dict) -> dict:
    """Reshape a full stored analysis record into the compact worklist item."""
    regions = record["localization"]["regions"]
    highest_confidence = max((r["confidence"] for r in regions), default=None)

    return {
        "study_id": record["study_id"],
        "display_study_id": record.get("display_study_id"),
        "source": record.get("source"),
        "analyzed_at": record["analyzed_at"],
        "viewed": record.get("viewed", False),
        "viewed_at": record.get("viewed_at"),
        "review_status": record.get("review_status", "Unread"),
        "reviewed_at": record.get("reviewed_at"),
        "source_filename": record.get("source_filename"),
        "metadata": record["metadata"],
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
