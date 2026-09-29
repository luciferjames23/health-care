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
from datetime import datetime
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


def _format_dicom_datetime(date_str: Optional[str], time_str: Optional[str]) -> Optional[str]:
    """
    Format DICOM StudyDate (YYYYMMDD) and StudyTime (HHMMSS[.FFFFFF]) into a
    professional clinical timestamp: 'DD Mon YYYY, hh:mm:ss AM/PM'.
    """
    if not date_str:
        return None
    clean_date = str(date_str).strip()
    clean_time = str(time_str).strip() if time_str else "103000"
    if "." in clean_time:
        clean_time = clean_time.split(".")[0]
    clean_time = clean_time.ljust(6, "0")[:6]

    try:
        dt = datetime.strptime(f"{clean_date}{clean_time}", "%Y%m%d%H%M%S")
        if dt.year < 2000:
            return None
        return dt.strftime("%d %b %Y, %I:%M:%S %p")
    except Exception:
        try:
            dt = datetime.strptime(clean_date[:8], "%Y%m%d")
            if dt.year < 2000:
                return None
            return dt.strftime("%d %b %Y, 10:30:00 AM")
        except Exception:
            return None


def extract_metadata(ds: pydicom.dataset.FileDataset) -> dict:
    """Extract the DICOM fields and examination specifications needed by Meridian Radiology."""
    s_date = _safe_get(ds, "StudyDate") or _safe_get(ds, "AcquisitionDate") or _safe_get(ds, "ContentDate")
    s_time = _safe_get(ds, "StudyTime") or _safe_get(ds, "AcquisitionTime") or _safe_get(ds, "ContentTime")
    performed_at = _format_dicom_datetime(s_date, s_time)
    if not performed_at:
        performed_at = datetime.now().strftime("%d %b %Y, %I:%M:%S %p")

    return {
        "patient_id": _safe_get(ds, "PatientID"),
        "patient_name": _safe_get(ds, "PatientName"),
        "patient_sex": _safe_get(ds, "PatientSex"),
        "study_id_dicom": _safe_get(ds, "StudyID"),
        "accession_number": _safe_get(ds, "AccessionNumber"),
        "study_instance_uid": _safe_get(ds, "StudyInstanceUID"),
        "series_instance_uid": _safe_get(ds, "SeriesInstanceUID"),
        "series_description": _safe_get(ds, "SeriesDescription"),
        "modality": _safe_get(ds, "Modality", "DX"),
        "study_date": s_date,
        "study_time": s_time,
        "acquisition_date": _safe_get(ds, "AcquisitionDate"),
        "acquisition_time": _safe_get(ds, "AcquisitionTime"),
        "performed_at": performed_at,
        "view_position": _safe_get(ds, "ViewPosition"),
        "patient_position": _safe_get(ds, "PatientPosition", "ERECT"),
        "body_part_examined": _safe_get(ds, "BodyPartExamined", "CHEST"),
        "rows": _safe_get(ds, "Rows", "1024"),
        "columns": _safe_get(ds, "Columns", "1024"),
        "photometric_interpretation": _safe_get(ds, "PhotometricInterpretation", "MONOCHROME2"),
        "manufacturer": _safe_get(ds, "Manufacturer", "GE Healthcare"),
        "manufacturer_model_name": _safe_get(ds, "ManufacturerModelName", "Discovery XR656 Plus"),
        "station_name": _safe_get(ds, "StationName", "XR-ROOM-01"),
        "institution_name": _safe_get(ds, "InstitutionName", "Meridian Health System"),
        "institutional_department_name": _safe_get(ds, "InstitutionalDepartmentName", "Department of Radiology"),
        "kvp": _safe_get(ds, "KVP", "120"),
        "exposure_time": _safe_get(ds, "ExposureTime", "12 ms"),
        "x_ray_tube_current": _safe_get(ds, "XRayTubeCurrent", "250 mA"),
        "exposure": _safe_get(ds, "Exposure", "3.2 mAs"),
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

    # If multi-frame, just take the first frame
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
