"""
Unit tests for services.worklist_service - sorting, counting, and reshaping
saved analysis records into worklist items. Uses synthetic records (same
shape run_full_analysis() produces) since forcing the real trained models
to specific probabilities on demand isn't practical - end-to-end wiring
through the real models and real store is covered in test_worklist_api.py.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.worklist_service import to_worklist_item, sort_worklist, compute_counts


def _record(study_id, status, probability, region_confidences, densenet_positive, yolo_positive):
    return {
        "study_id": study_id,
        "display_study_id": f"XR-{study_id[-1:].upper()}" if study_id else None,
        "analyzed_at": "2026-09-09T00:00:00+00:00",
        "source_filename": f"{study_id}.dcm",
        "metadata": {"modality": "CR"},
        "triage": {"probability": probability, "threshold": 0.20,
                   "priority": "HIGH PRIORITY" if probability >= 0.20 else "ROUTINE"},
        "localization": {
            "opacity_detected": len(region_confidences) > 0,
            "threshold": 0.10,
            "number_of_regions": len(region_confidences),
            "regions": [{"confidence": c, "x1": 0, "y1": 0, "x2": 10, "y2": 10} for c in region_confidences],
        },
        "combined_assessment": {
            "status": status,
            "densenet_positive": densenet_positive,
            "yolo_positive": yolo_positive,
            "agreement": densenet_positive == yolo_positive,
            "reason": "synthetic",
        },
        "images": {"original": "BASE64ORIGINAL", "annotated": "BASE64ANNOTATED"},
    }


def test_default_sort_orders_by_status_then_probability_desc():
    """Mirrors the brief's example: HIGH PRIORITY (desc) -> REVIEW FLAG (desc) -> ROUTINE (desc)."""
    records = [
        _record("routine-low", "ROUTINE", 0.07, [], False, False),
        _record("high-2", "HIGH PRIORITY", 0.76, [0.5], True, True),
        _record("review-1", "REVIEW FLAG", 0.68, [], True, False),
        _record("high-1", "HIGH PRIORITY", 0.92, [0.6], True, True),
        _record("routine-high", "ROUTINE", 0.18, [], False, False),
        _record("high-3", "HIGH PRIORITY", 0.87, [0.4], True, True),
        _record("review-2", "REVIEW FLAG", 0.31, [0.5], False, True),
    ]
    items = [to_worklist_item(r) for r in records]
    sorted_items = sort_worklist(items)
    ordered_ids = [item["study_id"] for item in sorted_items]

    assert ordered_ids == [
        "high-1", "high-3", "high-2",   # 92% > 87% > 76%
        "review-1", "review-2",         # 68% > 31%
        "routine-high", "routine-low",  # 18% > 7%
    ]


def test_worklist_update_inserts_new_high_priority_case_at_top():
    """Section 16 example: a new higher-probability HIGH PRIORITY case moves to rank 1."""
    existing = [
        _record("a", "HIGH PRIORITY", 0.82, [0.5], True, True),
        _record("b", "HIGH PRIORITY", 0.74, [0.5], True, True),
        _record("c", "REVIEW FLAG", 0.58, [], True, False),
        _record("d", "ROUTINE", 0.12, [], False, False),
    ]
    new_case = _record("e", "HIGH PRIORITY", 0.91, [0.6], True, True)

    items = sort_worklist([to_worklist_item(r) for r in existing + [new_case]])
    ordered_ids = [item["study_id"] for item in items]

    assert ordered_ids == ["e", "a", "b", "c", "d"]


def test_to_worklist_item_reports_highest_qualifying_confidence():
    record = _record("study-x", "HIGH PRIORITY", 0.5, [0.61, 0.30, 0.15], True, True)
    item = to_worklist_item(record)
    assert item["localization_summary"]["highest_confidence"] == 0.61
    assert item["localization_summary"]["number_of_regions"] == 3


def test_to_worklist_item_highest_confidence_none_when_no_regions():
    record = _record("study-y", "ROUTINE", 0.05, [], False, False)
    item = to_worklist_item(record)
    assert item["localization_summary"]["highest_confidence"] is None


def test_to_worklist_item_uses_thumbnail_from_original_image_only():
    """The worklist item must not include the (larger) annotated image."""
    record = _record("study-z", "HIGH PRIORITY", 0.9, [0.5], True, True)
    item = to_worklist_item(record)
    assert item["thumbnail"] == "BASE64ORIGINAL"
    assert "annotated" not in item


def test_compute_counts_matches_status_breakdown():
    records = [
        _record("a", "HIGH PRIORITY", 0.9, [0.5], True, True),
        _record("b", "HIGH PRIORITY", 0.8, [0.5], True, True),
        _record("c", "REVIEW FLAG", 0.5, [], True, False),
        _record("d", "ROUTINE", 0.1, [], False, False),
        _record("e", "ROUTINE", 0.05, [], False, False),
    ]
    items = [to_worklist_item(r) for r in records]
    counts = compute_counts(items)
    assert counts == {"total": 5, "high_priority": 2, "review_flag": 1, "routine": 2}


def test_model_disagreement_is_directly_readable_from_combined_assessment():
    """
    The 'Model Disagreement' filter (Section 13) should rely on the already
    -computed agreement flag rather than recomputing densenet/yolo logic.
    """
    densenet_pos_yolo_neg = _record("a", "REVIEW FLAG", 0.68, [], True, False)
    densenet_neg_yolo_pos = _record("b", "REVIEW FLAG", 0.15, [0.5], False, True)
    agree = _record("c", "HIGH PRIORITY", 0.9, [0.5], True, True)

    item_a = to_worklist_item(densenet_pos_yolo_neg)
    item_b = to_worklist_item(densenet_neg_yolo_pos)
    item_c = to_worklist_item(agree)

    assert item_a["combined_assessment"]["agreement"] is False
    assert item_b["combined_assessment"]["agreement"] is False
    assert item_c["combined_assessment"]["agreement"] is True


def test_all_four_model_signal_combinations_are_preserved_for_worklist():
    """Worklist must expose both model signals without hiding disagreement."""
    cases = [
        _record("pp", "HIGH PRIORITY", 0.90, [0.55], True, True),
        _record("pn", "REVIEW FLAG", 0.60, [], True, False),
        _record("np", "REVIEW FLAG", 0.10, [0.45], False, True),
        _record("nn", "ROUTINE", 0.05, [], False, False),
    ]
    items = [to_worklist_item(r) for r in cases]

    assert [(i["combined_assessment"]["densenet_positive"],
             i["combined_assessment"]["yolo_positive"],
             i["combined_assessment"]["agreement"],
             i["combined_assessment"]["status"]) for i in items] == [
        (True, True, True, "HIGH PRIORITY"),
        (True, False, False, "REVIEW FLAG"),
        (False, True, False, "REVIEW FLAG"),
        (False, False, True, "ROUTINE"),
    ]


def test_viewed_studies_move_to_bottom_without_changing_priority():
    high_viewed = {
        "combined_assessment": {"status": "HIGH PRIORITY"},
        "triage": {"probability": 0.95},
        "viewed": True,
    }
    routine_unviewed = {
        "combined_assessment": {"status": "ROUTINE"},
        "triage": {"probability": 0.04},
        "viewed": False,
    }

    result = sort_worklist([high_viewed, routine_unviewed])

    assert result[0] is routine_unviewed
    assert result[1] is high_viewed
    # The viewed case keeps its original clinical/AI priority.
    assert high_viewed["combined_assessment"]["status"] == "HIGH PRIORITY"
