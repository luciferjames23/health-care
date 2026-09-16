"""
Deterministic combined AI review-priority decision and human-readable
interpretation, derived from the SAME DenseNet triage probability and YOLO
localization regions produced by a single /api/radiology/analyze request.

This module:
  - introduces NO new model and makes NO additional inference call
  - introduces NO new threshold - it reuses the existing locked
    CLASSIFICATION_THRESHOLD and LOCALIZATION_THRESHOLD from config.py
  - is the ONE authoritative place the combined status is calculated.
    build_interpretation() consumes the CombinedAssessment produced by
    build_combined_assessment() rather than recalculating densenet_positive
    / yolo_positive / status independently, so combined_assessment.status
    and interpretation.priority can never disagree.
"""
from dataclasses import dataclass
from typing import List

from config import CLASSIFICATION_THRESHOLD, LOCALIZATION_THRESHOLD, SCREENING_DISCLAIMER

HIGH_PRIORITY = "HIGH PRIORITY"
REVIEW_FLAG = "REVIEW FLAG"
ROUTINE = "ROUTINE"


@dataclass
class CombinedAssessment:
    status: str
    densenet_positive: bool
    yolo_positive: bool
    agreement: bool
    reason: str


@dataclass
class Interpretation:
    finding: str
    summary: str
    assessment: str
    priority: str
    recommended_action: str
    disclaimer: str


def _qualifying_confidences(region_confidences: List[float]) -> List[float]:
    """
    YOLO regions returned by yolo_service.predict_localization are already
    filtered at LOCALIZATION_THRESHOLD (the existing, unchanged detector
    call uses conf=LOCALIZATION_THRESHOLD). This re-affirms that same
    existing threshold defensively rather than introducing a second,
    independent one.
    """
    return [c for c in region_confidences if c >= LOCALIZATION_THRESHOLD]


def build_combined_assessment(
    densenet_probability: float,
    region_confidences: List[float],
) -> CombinedAssessment:
    """
    THE single authoritative combined-status calculation.

    densenet_positive = densenet_probability >= CLASSIFICATION_THRESHOLD
    yolo_positive = count(qualifying regions) >= 1
    agreement = densenet_positive == yolo_positive
    """
    densenet_positive = densenet_probability >= CLASSIFICATION_THRESHOLD
    yolo_positive = len(_qualifying_confidences(region_confidences)) >= 1
    agreement = densenet_positive == yolo_positive

    if densenet_positive and yolo_positive:
        status = HIGH_PRIORITY
        reason = (
            "AI triage probability exceeds the locked threshold and one or "
            "more suspected opacity regions were localized."
        )
    elif densenet_positive and not yolo_positive:
        status = REVIEW_FLAG
        reason = (
            "AI triage probability exceeds the locked threshold, but no "
            "opacity region was localized. Radiologist review recommended."
        )
    elif not densenet_positive and yolo_positive:
        status = REVIEW_FLAG
        reason = (
            "AI triage probability is below the locked threshold, but one "
            "or more suspected opacity regions were localized. Radiologist "
            "review recommended."
        )
    else:
        status = ROUTINE
        reason = (
            "AI triage probability is below the locked threshold and no "
            "opacity region was localized."
        )

    return CombinedAssessment(
        status=status,
        densenet_positive=densenet_positive,
        yolo_positive=yolo_positive,
        agreement=agreement,
        reason=reason,
    )


def build_interpretation(
    densenet_probability: float,
    region_confidences: List[float],
    combined: CombinedAssessment,
) -> Interpretation:
    """
    Deterministic, rule-based interpretation text. NOT another model and
    NOT an LLM call - purely string formatting from values already computed
    by this same inference request. Always consumes `combined` rather than
    recomputing densenet_positive / yolo_positive / status, so
    interpretation.priority is guaranteed to equal combined.status.
    """
    probability_pct = round(densenet_probability * 100)
    qualifying = _qualifying_confidences(region_confidences)
    region_count = len(qualifying)
    highest_confidence_pct = round(max(qualifying) * 100) if qualifying else 0

    if combined.densenet_positive and combined.yolo_positive:
        finding = "Suspected lung opacity identified"
        summary = (
            f"The triage model generated a probability of {probability_pct}%, "
            f"which is above the configured 20% triage threshold. The "
            f"localization model identified {region_count} suspected opacity "
            f"region(s), with the highest detection confidence of "
            f"{highest_confidence_pct}%."
        )
        assessment = "Both AI triage and localization signals indicate a suspected abnormality."
        recommended_action = "Radiologist review recommended."

    elif combined.densenet_positive and not combined.yolo_positive:
        finding = "Elevated triage signal without localized opacity"
        summary = (
            f"The triage model generated a probability of {probability_pct}%, "
            f"above the configured 20% threshold. However, the localization "
            f"model did not identify a suspected opacity region above the "
            f"configured 10% detection threshold."
        )
        assessment = "Models disagree — radiologist review recommended."
        recommended_action = "Radiologist review recommended to assess the study."

    elif not combined.densenet_positive and combined.yolo_positive:
        finding = "Localized opacity signal with low overall triage probability"
        summary = (
            f"The overall triage probability was {probability_pct}%, below "
            f"the configured 20% threshold. However, the localization model "
            f"identified {region_count} suspected opacity region(s), with "
            f"the highest detection confidence of {highest_confidence_pct}%."
        )
        assessment = "Models disagree — radiologist review recommended."
        recommended_action = "Radiologist review recommended to assess the localized finding."

    else:
        finding = "No qualifying lung-opacity signal identified"
        summary = (
            f"The triage probability was {probability_pct}%, below the "
            f"configured 20% threshold, and the localization model did not "
            f"identify an opacity region above the configured 10% threshold."
        )
        assessment = (
            "No qualifying lung-opacity signal was identified by either AI "
            "model at the configured thresholds."
        )
        recommended_action = "Routine radiologist interpretation is still required."

    return Interpretation(
        finding=finding,
        summary=summary,
        assessment=assessment,
        priority=combined.status,  # MUST always equal combined_assessment.status
        recommended_action=recommended_action,
        disclaimer=SCREENING_DISCLAIMER,
    )
