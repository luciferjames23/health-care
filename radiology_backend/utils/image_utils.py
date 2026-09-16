"""
Image annotation utilities.

Draws YOLO bounding boxes directly onto the exact display image whose
pixel dimensions were used for YOLO inference, so there is no
resize/coordinate mismatch between what the model measured and what is
drawn.
"""
import base64
import io
from typing import List

from PIL import Image, ImageDraw, ImageFont

from services.yolo_service import BoundingBox

BOX_COLOR = (255, 64, 64)
BOX_WIDTH = 3
LABEL_COLOR = (255, 255, 255)
LABEL_BG = (255, 64, 64)


def draw_boxes(display_image: Image.Image, regions: List[BoundingBox]) -> Image.Image:
    """Return a NEW image (does not mutate the original) with boxes drawn."""
    annotated = display_image.copy()
    draw = ImageDraw.Draw(annotated)

    for i, region in enumerate(regions, start=1):
        draw.rectangle(
            [region.x1, region.y1, region.x2, region.y2],
            outline=BOX_COLOR,
            width=BOX_WIDTH,
        )
        label = f"Region {i}: {region.confidence * 100:.0f}%"
        text_pos = (region.x1 + 2, max(region.y1 - 16, 0))
        try:
            text_bbox = draw.textbbox(text_pos, label)
            draw.rectangle(text_bbox, fill=LABEL_BG)
        except Exception:
            pass
        draw.text(text_pos, label, fill=LABEL_COLOR)

    return annotated


def image_to_base64_png(image: Image.Image) -> str:
    """Encode a PIL image as a base64 PNG data string (no data: prefix)."""
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")
