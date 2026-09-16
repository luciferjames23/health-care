"""
Unit tests for services.decision_service — the single authoritative
combined AI review-priority decision and its deterministic interpretation.

These test the decision function directly with synthetic DenseNet
probabilities / YOLO region confidences (Section 19-21 of the
combined-assessment brief), since forcing the real trained models to
produce an exact probability like 0.33 is not practical/deterministic.
End-to-end wiring through the real models is covered separately in
test_analyze.py.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.decision_service import (
    build_combined_assessment,
    build_interpretation,
    HIGH_PRIORITY,
    REVIEW_FLAG,
    ROUTINE,
)
from config import CLASSIFICATION_THRESHOLD, LOCALIZATION_THRESHOLD


# ---------------------------------------------------------------------------
# Section 19: all four decision combinations
# ---------------------------------------------------------------------------

def test_case_1_densenet_positive_yolo_positive_is_high_priority():
    """TEST 1: DenseNet = 0.33, YOLO = 1+ valid region -> HIGH PRIORITY."""
    combined = build_combined_assessment(0.33, [0.55])
    assert combined.status == HIGH_PRIORITY
    assert combined.densenet_positive is True
    assert combined.yolo_positive is True
    assert combined.agreement is True


def test_case_2_densenet_positive_yolo_negative_is_review_flag():
    """TEST 2: DenseNet = 0.33, YOLO = 0 regions -> REVIEW FLAG."""
    combined = build_combined_assessment(0.33, [])
    assert combined.status == REVIEW_FLAG
    assert combined.densenet_positive is True
    assert combined.yolo_positive is False
    assert combined.agreement is False


def test_case_3_densenet_negative_yolo_positive_is_review_flag():
    """TEST 3: DenseNet = 0.16, YOLO = 1+ valid region -> REVIEW FLAG."""
    combined = build_combined_assessment(0.16, [0.42])
    assert combined.status == REVIEW_FLAG
    assert combined.densenet_positive is False
    assert combined.yolo_positive is True
    assert combined.agreement is False


def test_case_4_densenet_negative_yolo_negative_is_routine():
    """TEST 4: DenseNet = 0.16, YOLO = 0 regions -> ROUTINE."""
    combined = build_combined_assessment(0.16, [])
    assert combined.status == ROUTINE
    assert combined.densenet_positive is False
    assert combined.yolo_positive is False
    assert combined.agreement is True


# ---------------------------------------------------------------------------
# Section 20: boundary tests (>=, not >)
# ---------------------------------------------------------------------------

def test_densenet_probability_exactly_at_threshold_is_positive():
    combined = build_combined_assessment(CLASSIFICATION_THRESHOLD, [])
    assert combined.densenet_positive is True


def test_densenet_probability_just_below_threshold_is_negative():
    combined = build_combined_assessment(CLASSIFICATION_THRESHOLD - 0.0001, [])
    assert combined.densenet_positive is False


def test_yolo_confidence_exactly_at_threshold_is_qualifying():
    combined = build_combined_assessment(0.0, [LOCALIZATION_THRESHOLD])
    assert combined.yolo_positive is True


def test_yolo_confidence_just_below_threshold_is_not_qualifying():
    combined = build_combined_assessment(0.0, [LOCALIZATION_THRESHOLD - 0.0001])
    assert combined.yolo_positive is False


# ---------------------------------------------------------------------------
# Section 21: consistency checks
# ---------------------------------------------------------------------------

def test_interpretation_priority_always_equals_combined_status():
    scenarios = [
        (0.33, [0.55]),
        (0.33, []),
        (0.16, [0.42]),
        (0.16, []),
    ]
    for probability, confidences in scenarios:
        combined = build_combined_assessment(probability, confidences)
        interpretation = build_interpretation(probability, confidences, combined)
        assert interpretation.priority == combined.status


def test_interpretation_reflects_reported_probability_and_region_count():
    combined = build_combined_assessment(0.72, [0.61, 0.30])
    interpretation = build_interpretation(0.72, [0.61, 0.30], combined)
    assert "72%" in interpretation.summary
    assert "2 suspected opacity region(s)" in interpretation.summary
    assert "61%" in interpretation.summary  # highest qualifying confidence


def test_highest_confidence_uses_only_qualifying_regions():
    # One qualifying region (0.61) and one below LOCALIZATION_THRESHOLD (0.02)
    # which should never have reached this function in practice (the
    # existing YOLO call already filters at 0.10), but the helper defends
    # against it anyway rather than reporting a misleading "highest".
    combined = build_combined_assessment(0.72, [0.61, 0.02])
    interpretation = build_interpretation(0.72, [0.61, 0.02], combined)
    assert combined.yolo_positive is True
    assert "1 suspected opacity region(s)" in interpretation.summary
    assert "61%" in interpretation.summary


def test_disagreement_always_results_in_review_flag():
    disagreement_scenarios = [
        (0.90, []),        # densenet positive, yolo negative
        (0.01, [0.99]),    # densenet negative, yolo positive
    ]
    for probability, confidences in disagreement_scenarios:
        combined = build_combined_assessment(probability, confidences)
        assert combined.agreement is False
        assert combined.status == REVIEW_FLAG


def test_no_unsupported_disease_terms_in_generated_text():
    banned_terms = [
        "pneumonia", "cancer", "tuberculosis", "pneumothorax",
        "pleural effusion", "cardiomegaly", "pulmonary edema",
        "consolidation", "covid", "pulmonary embolism", "diagnosis",
        "normal patient", "normal x-ray",
    ]
    scenarios = [(0.33, [0.55]), (0.33, []), (0.16, [0.42]), (0.16, [])]
    for probability, confidences in scenarios:
        combined = build_combined_assessment(probability, confidences)
        interpretation = build_interpretation(probability, confidences, combined)
        full_text = " ".join([
            interpretation.finding,
            interpretation.summary,
            interpretation.assessment,
            interpretation.recommended_action,
            combined.reason,
        ]).lower()
        for term in banned_terms:
            assert term not in full_text, f"Unsupported term '{term}' found in generated text"
