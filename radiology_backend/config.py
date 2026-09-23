"""
Meridian Radiology AI - Configuration

Contains locked model decisions. Do NOT change these values without
explicit sign-off; they were set intentionally (see project brief).
"""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

DENSENET_CHECKPOINT_PATH = os.path.join(MODELS_DIR, "densenet121_full_stage2_best.pth")
YOLO_CHECKPOINT_PATH = os.path.join(MODELS_DIR, "lung_opacity_yolo11n_best.pt")

# ---------------------------------------------------------------------------
# LOCKED THRESHOLDS - do not auto-tune / do not change without explicit ask
# ---------------------------------------------------------------------------
CLASSIFICATION_THRESHOLD = 0.20   # DenseNet: probability >= this => HIGH PRIORITY
LOCALIZATION_THRESHOLD = 0.10     # YOLO: confidence >= this => region reported
IOU_MATCH_THRESHOLD = 0.50        # Evaluation-only metric, not applied at inference time

YOLO_IMG_SIZE = 640

# ---------------------------------------------------------------------------
# DENSENET PREPROCESSING - CONFIRMED against the original training notebook.
#
# Architecture (confirmed by direct checkpoint inspection - zero missing/
# unexpected keys): torchvision.models.densenet121(weights=None) with
# classifier = nn.Linear(1024, 2). Positive "opacity" class is index 1.
#
# Exact inference-time preprocessing pipeline (confirmed):
#   1. pydicom.dcmread()
#   2. pixel_array.astype(np.float32)
#   3. Apply RescaleSlope / RescaleIntercept (defaults 1.0 / 0.0)
#   4. If PhotometricInterpretation == "MONOCHROME1": invert via
#      np.max(image) - image
#   5. Compute 1st and 99th percentiles of the resulting array
#   6. Clip image to [low, high]
#   7. Normalize: (image - low) / (high - low)
#   8. Convert to uint8 via image * 255
#   9. Convert to a PIL image, convert to RGB
#  10. Resize to (224, 224)
#  11. ToTensor()
#  12. Normalize with ImageNet mean/std
#
# Probability: torch.softmax(output, dim=1)[0, 1]
# Implemented in services/densenet_service.py::preprocess_for_densenet and
# services/dicom_service.py (steps 1-4, shared with the display pipeline).
# ---------------------------------------------------------------------------
DENSENET_INPUT_SIZE = 224
DENSENET_PERCENTILE_LOW = 1
DENSENET_PERCENTILE_HIGH = 99
DENSENET_NORM_MEAN = [0.485, 0.456, 0.406]
DENSENET_NORM_STD = [0.229, 0.224, 0.225]
DENSENET_POSITIVE_CLASS_INDEX = 1
DENSENET_PREPROCESSING_CONFIRMED = True  # confirmed against training notebook

# ---------------------------------------------------------------------------
# Reported model performance (evaluation metrics only - NOT clinical
# sensitivity/specificity, NOT FDA/CE validated)
# ---------------------------------------------------------------------------
DENSENET_ROC_AUC = 0.85

YOLO_TEST_SET_SIZE = 400
YOLO_TEST_POSITIVE = 200
YOLO_TEST_NEGATIVE = 200
YOLO_POSITIVE_LOCALIZED_AT_IOU50 = 143   # 143/200 = 71.5%
YOLO_NEGATIVE_FALSE_ALERT = 54           # 54/200 = 27.0%
YOLO_PRECISION = 0.483
YOLO_RECALL = 0.431
YOLO_MAP50 = 0.444
YOLO_MAP50_95 = 0.179

POC_VERSION = "0.1.0"

DISCLAIMER = (
    "AI-assisted triage only. This system is not a diagnostic "
    "system. Final clinical interpretation must be performed by a "
    "qualified radiologist."
)

# Interpretation-specific disclaimer (Section 16 of the combined-assessment
# brief). Shown inside the AI Interpretation card rather than duplicated as
# a second global banner - the existing DISCLAIMER above remains the single
# page-level disclaimer.
SCREENING_DISCLAIMER = (
    "AI-assisted screening result only. Highlighted regions represent "
    "model-predicted lung-opacity locations and do not constitute a "
    "clinical diagnosis. Final interpretation must be performed by a "
    "qualified radiologist."
)

# ---------------------------------------------------------------------------
# ORTHANC DEMO PACS - simulated DICOM source for showcase integration.
# Environment variables allow easy override without touching application code.
# ---------------------------------------------------------------------------
ORTHANC_URL = os.getenv("ORTHANC_URL", "http://localhost:8042")
ORTHANC_USERNAME = os.getenv("ORTHANC_USERNAME", "orthanc")
ORTHANC_PASSWORD = os.getenv("ORTHANC_PASSWORD", "orthanc")
PACS_POLL_INTERVAL_SECONDS = int(os.getenv("PACS_POLL_INTERVAL_SECONDS", "5"))

# CORS
ALLOWED_ORIGINS = ["http://localhost:5173"]

# ---------------------------------------------------------------------------
# PostgreSQL Lakehouse Connection Configuration
# ---------------------------------------------------------------------------
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "rivesca.eu.db.rivestack.io")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "rv_pbpkghvg")
POSTGRES_USER = os.getenv("POSTGRES_USER", "rv_pbpkghvg")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "d_3zzwU0qzrtkujXG6YVBGlXGx9-kxp05cfBMiHqQ48=")
