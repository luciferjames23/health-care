"""
DICOM processing service.

Responsible for:
- reading a DICOM file safely
- extracting non-identifying study metadata
- converting pixel data into a displayable 8-bit image (for viewing / YOLO /
  annotation - uses full min-max normalization for visual contrast)
- exposing the rescaled float32 array (post RescaleSlope/Intercept and
  MONOCHROME1 handling) that DenseNet's own percentile-based preprocessing
  pipeline consumes - see services/densenet_service.py
"""
import io
import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pydicom
from pydicom.errors import InvalidDicomError
from PIL import Image

logger = logging.getLogger("meridian.dicom_service")


class DicomProcessingError(Exception):
    """Raised when a DICOM file cannot be safely processed."""


@dataclass
class DicomResult:
    display_image: Image.Image      # 8-bit grayscale->RGB PIL image, ready to show/annotate/YOLO
    pixel_array_uint8: np.ndarray    # underlying 8-bit numpy array (H, W), same normalization as display_image
    rescaled_array: np.ndarray       # float32 array after RescaleSlope/Intercept + MONOCHROME1 inversion,
                                      # BEFORE any 0-255 scaling. This is the exact input DenseNet's own
                                      # preprocessing pipeline (percentile normalization) starts from -
                                      # confirmed against the original training notebook.
    metadata: dict                  # non-identifying study metadata


def _safe_get(ds, tag, default=None):
    try:
        val = getattr(ds, tag, default)
        if val is None:
            return default
        return str(val)
    except Exception:
        return default


def extract_metadata(ds: pydicom.dataset.FileDataset) -> dict:
    """Extract the DICOM fields needed by the supplied Meridian Radiology POC.

    This mirrors the working POC integration: identifiers are retained only in
    the local demo result so the same study can be linked across Radiology,
    Diagnostics and Results & Critical Values.
    """
    return {
        "patient_id": _safe_get(ds, "PatientID"),
        "patient_name": _safe_get(ds, "PatientName"),
        "patient_sex": _safe_get(ds, "PatientSex"),
        "study_id_dicom": _safe_get(ds, "StudyID"),
        "accession_number": _safe_get(ds, "AccessionNumber"),
        "study_instance_uid": _safe_get(ds, "StudyInstanceUID"),
        "series_instance_uid": _safe_get(ds, "SeriesInstanceUID"),
        "series_description": _safe_get(ds, "SeriesDescription"),
        "modality": _safe_get(ds, "Modality"),
        "study_date": _safe_get(ds, "StudyDate"),
        "view_position": _safe_get(ds, "ViewPosition"),
        "body_part_examined": _safe_get(ds, "BodyPartExamined"),
        "rows": _safe_get(ds, "Rows"),
        "columns": _safe_get(ds, "Columns"),
        "photometric_interpretation": _safe_get(ds, "PhotometricInterpretation"),
    }


def read_dicom_bytes(file_bytes: bytes) -> DicomResult:
    """
    Read DICOM bytes and produce a display-ready image plus metadata.
    Never overwrites the original uploaded bytes (caller owns those).
    """
    if not file_bytes:
        raise DicomProcessingError("Uploaded file is empty.")

    try:
        ds = pydicom.dcmread(io.BytesIO(file_bytes), force=False)
    except InvalidDicomError as e:
        raise DicomProcessingError(f"File is not a valid DICOM: {e}")
    except Exception as e:
        raise DicomProcessingError(f"Failed to parse DICOM file: {e}")

    try:
        pixel_array = ds.pixel_array
    except Exception as e:
        raise DicomProcessingError(f"DICOM file has no readable pixel data: {e}")

    if pixel_array is None or pixel_array.size == 0:
        raise DicomProcessingError("DICOM pixel data is missing or empty.")

    # If multi-frame, just take the first frame for this PoC
    if pixel_array.ndim == 3 and pixel_array.shape[0] > 1 and pixel_array.shape[-1] not in (3, 4):
        pixel_array = pixel_array[0]

    pixel_array = pixel_array.astype(np.float32)

    # Apply RescaleSlope / RescaleIntercept if present (confirmed against
    # training notebook: defaults 1.0 / 0.0)
    slope = float(getattr(ds, "RescaleSlope", 1.0) or 1.0)
    intercept = float(getattr(ds, "RescaleIntercept", 0.0) or 0.0)
    pixel_array = pixel_array * slope + intercept

    # Handle MONOCHROME1 (inverted grayscale) correctly - confirmed:
    # np.max(image) - image
    photometric = str(getattr(ds, "PhotometricInterpretation", "MONOCHROME2"))
    if photometric == "MONOCHROME1":
        pixel_array = np.max(pixel_array) - pixel_array

    # This is the exact array DenseNet's own preprocessing pipeline consumes
    # (see services/densenet_service.py::preprocess_for_densenet).
    rescaled_array = pixel_array.copy()

    # Safe normalize to 0-255 for DISPLAY / YOLO / annotation. This uses
    # full min-max range (distinct from DenseNet's percentile-based
    # normalization) because it is optimized for on-screen visual contrast
    # across the whole image, not classifier input statistics.
    p_min = float(np.min(pixel_array))
    p_max = float(np.max(pixel_array))
    if p_max - p_min < 1e-6:
        # Degenerate flat image - avoid divide by zero
        normalized = np.zeros_like(pixel_array, dtype=np.uint8)
    else:
        normalized = ((pixel_array - p_min) / (p_max - p_min) * 255.0)
        normalized = np.clip(normalized, 0, 255).astype(np.uint8)

    display_image = Image.fromarray(normalized).convert("RGB")

    metadata = extract_metadata(ds)

    logger.info(
        "DICOM processed: modality=%s rows=%s cols=%s photometric=%s",
        metadata.get("modality"), metadata.get("rows"), metadata.get("columns"), photometric,
    )

    return DicomResult(
        display_image=display_image,
        pixel_array_uint8=normalized,
        rescaled_array=rescaled_array,
        metadata=metadata,
    )
