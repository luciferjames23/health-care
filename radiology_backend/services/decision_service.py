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
            "Elevated radiographic screening index with localized pulmonary opacity identified. "
            "Urgent radiologist review recommended."
        )
    elif densenet_positive and not yolo_positive:
        status = REVIEW_FLAG
        reason = (
            "Elevated radiographic screening index without discrete focal opacity localization. "
            "Radiologist review recommended."
        )
    elif not densenet_positive and yolo_positive:
        status = REVIEW_FLAG
        reason = (
            "Localized radiographic opacity identified warranting clinical correlation. "
            "Radiologist review recommended."
        )
    else:
        status = ROUTINE
        reason = (
            "Radiographic screening index within normal limits; no acute focal lung opacity detected."
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
    Deterministic, rule-based clinical interpretation text. NOT another model and
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
            f"Radiographic assessment demonstrates suspected focal lung opacity "
            f"({region_count} region(s) identified, peak confidence: {highest_confidence_pct}%). "
            f"Features are suspicious for focal consolidation or infiltrative process with an "
            f"elevated screening index of {probability_pct}%."
        )
        assessment = "Radiographic findings indicate suspected pulmonary opacity requiring clinical correlation."
        recommended_action = "Urgent radiologist review and clinical correlation recommended."

    elif combined.densenet_positive and not combined.yolo_positive:
        finding = "Elevated screening index without focal opacity localization"
        summary = (
            f"Radiographic screening demonstrates an elevated risk index of {probability_pct}%. "
            f"No discrete focal opacity region is localized; diffuse parenchymal change or technical factor suspected."
        )
        assessment = "Elevated screening index with indeterminate localization — secondary radiologist review recommended."
        recommended_action = "Radiologist review recommended to evaluate subtle or diffuse changes."

    elif not combined.densenet_positive and combined.yolo_positive:
        finding = "Focal radiographic density identified with baseline risk index"
        summary = (
            f"Focal radiographic opacity localized ({region_count} region(s), "
            f"peak confidence: {highest_confidence_pct}%) with baseline radiographic "
            f"screening index of {probability_pct}%."
        )
        assessment = "Focal radiographic density identified warranting clinical correlation despite baseline score."
        recommended_action = "Radiologist review recommended to assess the localized finding."

    else:
        finding = "No acute cardiopulmonary abnormality detected"
        summary = (
            f"Clear lung fields without evidence of focal consolidation, pneumothorax, or "
            f"large pleural effusion. Radiographic screening index is within normal limits ({probability_pct}%)."
        )
        assessment = (
            "No acute pulmonary consolidation, active infiltrate, or focal lung opacity detected."
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
