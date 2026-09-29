"""
DenseNet121 triage classification service.

Architecture confirmed by direct inspection of the checkpoint:
    torchvision.models.densenet121() with classifier replaced by
    nn.Linear(1024, 2). The checkpoint is a raw state_dict (no
    "model_state_dict"/"state_dict" wrapper, no "module." prefix) and
    loads with ZERO missing / unexpected keys.

Preprocessing is CONFIRMED against the original training notebook (see the
exact pipeline documented in config.py). This service consumes the
`rescaled_array` produced by dicom_service.read_dicom_bytes (float32, after
RescaleSlope/Intercept + MONOCHROME1 handling, BEFORE the display's own
min-max 0-255 scaling) and applies DenseNet's own percentile-based
normalization independently of the display/YOLO image pipeline.
"""
import logging
from dataclasses import dataclass

import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as T
from PIL import Image

from radiology_ai.config import (
    DENSENET_CHECKPOINT_PATH,
    DENSENET_INPUT_SIZE,
    DENSENET_PERCENTILE_LOW,
    DENSENET_PERCENTILE_HIGH,
    DENSENET_NORM_MEAN,
    DENSENET_NORM_STD,
    DENSENET_POSITIVE_CLASS_INDEX,
    DENSENET_PREPROCESSING_CONFIRMED,
    CLASSIFICATION_THRESHOLD,
)

logger = logging.getLogger("meridian.densenet_service")


class DenseNetInferenceError(Exception):
    """Raised when DenseNet loading or inference fails."""


@dataclass
class TriageResult:
    probability: float
    threshold: float
    priority: str  # "HIGH PRIORITY" | "ROUTINE"


def _strip_state_dict_wrappers(raw) -> dict:
    """
    Handle common checkpoint formats:
      - raw state_dict (this checkpoint's actual format)
      - {"model_state_dict": ...}
      - {"state_dict": ...}
    Strip "module." prefixes if a DataParallel-trained checkpoint is ever
    swapped in later.
    """
    state_dict = raw
    if isinstance(raw, dict):
        if "model_state_dict" in raw:
            state_dict = raw["model_state_dict"]
        elif "state_dict" in raw:
            state_dict = raw["state_dict"]

    cleaned = {}
    for k, v in state_dict.items():
        new_key = k[len("module."):] if k.startswith("module.") else k
        cleaned[new_key] = v
    return cleaned


def load_densenet_model(checkpoint_path: str = DENSENET_CHECKPOINT_PATH, device: str = "cpu") -> nn.Module:
    """Load the DenseNet121 triage model once. Does not modify weights."""
    logger.info("Loading DenseNet121 checkpoint from %s", checkpoint_path)

    model = models.densenet121(weights=None)
    model.classifier = nn.Linear(1024, 2)

    raw_checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    state_dict = _strip_state_dict_wrappers(raw_checkpoint)

    model.load_state_dict(state_dict, strict=True)
    # strict=True raises on any mismatch; reaching this line means an exact match.

    model.to(device)
    model.eval()

    if DENSENET_PREPROCESSING_CONFIRMED:
        logger.info("DenseNet preprocessing is confirmed against the training notebook.")
    else:
        logger.warning(
            "DenseNet preprocessing is UNCONFIRMED against the original training "
            "notebook. Probabilities from this model should be treated as "
            "unvalidated for clinical use. See config.py for details."
        )

    return model


def preprocess_for_densenet(rescaled_array: np.ndarray, device: str = "cpu") -> torch.Tensor:
    """
    Convert the rescaled float32 pixel array (post RescaleSlope/Intercept +
    MONOCHROME1 handling, from dicom_service) into a DenseNet-ready tensor.

    Confirmed pipeline (matches the original training notebook exactly):
      5. Compute 1st / 99th percentiles
      6. Clip to [low, high]
      7. Normalize: (image - low) / (high - low)
      8. Convert to uint8 via image * 255
      9. Convert to PIL image, convert to RGB
     10. Resize to (224, 224)
     11. ToTensor()
     12. Normalize with ImageNet mean/std
    """
    image = rescaled_array.astype(np.float32)

    low = np.percentile(image, DENSENET_PERCENTILE_LOW)
    high = np.percentile(image, DENSENET_PERCENTILE_HIGH)

    image = np.clip(image, low, high)

    denom = high - low
    if denom < 1e-6:
        # Degenerate flat region - avoid divide by zero
        normalized = np.zeros_like(image, dtype=np.float32)
    else:
        normalized = (image - low) / denom

    uint8_image = (normalized * 255.0).astype(np.uint8)

    pil_image = Image.fromarray(uint8_image).convert("RGB")

    transform = T.Compose([
        T.Resize((DENSENET_INPUT_SIZE, DENSENET_INPUT_SIZE)),
        T.ToTensor(),
        T.Normalize(mean=DENSENET_NORM_MEAN, std=DENSENET_NORM_STD),
    ])
    tensor = transform(pil_image).unsqueeze(0)
    return tensor.to(device)


def predict_triage(model: nn.Module, rescaled_array: np.ndarray, device: str = "cpu") -> TriageResult:
    """Run DenseNet inference and apply the locked classification threshold."""
    try:
        input_tensor = preprocess_for_densenet(rescaled_array, device=device)
        with torch.no_grad():
            logits = model(input_tensor)
            probs = torch.softmax(logits, dim=1)
        probability = float(probs[0, DENSENET_POSITIVE_CLASS_INDEX].item())
    except Exception as e:
        raise DenseNetInferenceError(f"DenseNet inference failed: {e}")

    priority = "HIGH PRIORITY" if probability >= CLASSIFICATION_THRESHOLD else "ROUTINE"

    return TriageResult(
        probability=probability,
        threshold=CLASSIFICATION_THRESHOLD,
        priority=priority,
    )
