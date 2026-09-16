"""
YOLO11n lung opacity localization service.
"""
import logging
from dataclasses import dataclass, field
from typing import List

from PIL import Image
from ultralytics import YOLO

from config import YOLO_CHECKPOINT_PATH, LOCALIZATION_THRESHOLD, YOLO_IMG_SIZE

logger = logging.getLogger("meridian.yolo_service")


class YoloInferenceError(Exception):
    """Raised when YOLO loading or inference fails."""


@dataclass
class BoundingBox:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float


@dataclass
class LocalizationResult:
    opacity_detected: bool
    threshold: float
    number_of_regions: int
    regions: List[BoundingBox] = field(default_factory=list)


def load_yolo_model(checkpoint_path: str = YOLO_CHECKPOINT_PATH, device: str = "cpu") -> YOLO:
    """Load the YOLO11n localization model once."""
    logger.info("Loading YOLO checkpoint from %s", checkpoint_path)
    model = YOLO(checkpoint_path)
    model.to(device)
    return model


def predict_localization(model: YOLO, display_image: Image.Image, device: str = "cpu") -> LocalizationResult:
    """
    Run YOLO inference on the DISPLAY image (the same image the user sees
    and that will be annotated), so returned box coordinates line up
    directly with the displayed image's pixel space with no rescale bugs.
    """
    try:
        results = model.predict(
            source=display_image,
            imgsz=YOLO_IMG_SIZE,
            conf=LOCALIZATION_THRESHOLD,
            device=device,
            verbose=False,
        )
    except Exception as e:
        raise YoloInferenceError(f"YOLO inference failed: {e}")

    regions: List[BoundingBox] = []
    if results:
        r = results[0]
        # Ultralytics automatically rescales box coordinates back to the
        # original input image's pixel space (display_image size here),
        # regardless of the internal imgsz used for inference. r.orig_shape
        # matches display_image's (H, W).
        for box in r.boxes:
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
            conf = float(box.conf[0].item())
            regions.append(BoundingBox(x1=x1, y1=y1, x2=x2, y2=y2, confidence=conf))

    # Sort by confidence, most confident first
    regions.sort(key=lambda b: b.confidence, reverse=True)

    return LocalizationResult(
        opacity_detected=len(regions) > 0,
        threshold=LOCALIZATION_THRESHOLD,
        number_of_regions=len(regions),
        regions=regions,
    )
