"""
Combines DICOM preprocessing, DenseNet triage classification, and YOLO
localization into a single radiology AI result. Both models run on
every uploaded study (not conditional on each other) per the PoC spec.
"""
import logging
import uuid

from .dicom_service import read_dicom_bytes, DicomProcessingError
from .densenet_service import predict_triage, DenseNetInferenceError
from .yolo_service import predict_localization, YoloInferenceError
from .decision_service import build_combined_assessment, build_interpretation
from ..utils.image_utils import draw_boxes, image_to_base64_png
from ..config import DISCLAIMER, DENSENET_PREPROCESSING_CONFIRMED

logger = logging.getLogger("meridian.inference_service")


class InferenceError(Exception):
    """Wraps any stage failure with a user-safe message."""


def run_full_analysis(file_bytes: bytes, densenet_model, yolo_model, device: str = "cpu") -> dict:
    study_id = str(uuid.uuid4())

    try:
        dicom_result = read_dicom_bytes(file_bytes)
    except DicomProcessingError as e:
        logger.warning("DICOM processing failed for study %s: %s", study_id, e)
        raise InferenceError(str(e))

    try:
        triage = predict_triage(densenet_model, dicom_result.rescaled_array, device=device)
    except DenseNetInferenceError as e:
        logger.error("DenseNet inference failed for study %s: %s", study_id, e)
        raise InferenceError("AI triage classification failed. Please try again or contact support.")

    try:
        localization = predict_localization(yolo_model, dicom_result.display_image, device=device)
    except YoloInferenceError as e:
        logger.error("YOLO inference failed for study %s: %s", study_id, e)
        raise InferenceError("AI localization failed. Please try again or contact support.")

    annotated_image = draw_boxes(dicom_result.display_image, localization.regions)

    original_b64 = image_to_base64_png(dicom_result.display_image)
    annotated_b64 = image_to_base64_png(annotated_image)

    # ONE authoritative combined-status calculation. interpretation reuses
    # this same result rather than recalculating densenet_positive /
    # yolo_positive / status independently.
    region_confidences = [r.confidence for r in localization.regions]
    combined = build_combined_assessment(triage.probability, region_confidences)
    interpretation = build_interpretation(triage.probability, region_confidences, combined)

    logger.info(
        "Study %s analyzed: triage=%s (%.3f) regions=%d combined=%s agreement=%s",
        study_id, triage.priority, triage.probability, localization.number_of_regions,
        combined.status, combined.agreement,
    )

    return {
        "study_id": study_id,
        "metadata": dicom_result.metadata,
        "triage": {
            "probability": triage.probability,
            "threshold": triage.threshold,
            "priority": triage.priority,
        },
        "localization": {
            "opacity_detected": localization.opacity_detected,
            "threshold": localization.threshold,
            "number_of_regions": localization.number_of_regions,
            "regions": [
                {
                    "confidence": r.confidence,
                    "x1": r.x1,
                    "y1": r.y1,
                    "x2": r.x2,
                    "y2": r.y2,
                }
                for r in localization.regions
            ],
        },
        "combined_assessment": {
            "status": combined.status,
            "densenet_positive": combined.densenet_positive,
            "yolo_positive": combined.yolo_positive,
            "agreement": combined.agreement,
            "reason": combined.reason,
        },
        "interpretation": {
            "finding": interpretation.finding,
            "summary": interpretation.summary,
            "assessment": interpretation.assessment,
            "priority": interpretation.priority,
            "recommended_action": interpretation.recommended_action,
            "disclaimer": interpretation.disclaimer,
        },
        "images": {
            "original": original_b64,
            "annotated": annotated_b64,
        },
        "disclaimer": DISCLAIMER,
        "preprocessing_confirmed": DENSENET_PREPROCESSING_CONFIRMED,
    }
