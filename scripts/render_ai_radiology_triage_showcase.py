"""Render a short showcase from authentic Hospital radiology app screenshots.

Screens are extracted from the local radiology case-study document at render
time. Patient and staff identifiers are obscured before they appear in video.
"""
from __future__ import annotations

import io
import math
import zipfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DOC = ROOT / "docs" / "AI_Diagnostic_Radiology_Screening_Triage_Assistant_Case_Study.docx"
OUTPUT = ROOT / "docs" / "AI_Radiology_Triage_Flow_Showcase.mp4"
WIDTH, HEIGHT, FPS = 1280, 720, 20
SCENE_SECONDS = 4.0
SCENE_COUNT = 6

NAVY = (9, 24, 41)
TEAL = (0, 129, 136)
MINT = (63, 220, 187)
WHITE = (250, 252, 253)
PALE = (215, 228, 235)
MUTED = (154, 178, 194)


def get_font(size: int, bold: bool = False):
    path = Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf")
    if not path.exists():
        path = Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


F16 = get_font(16)
F18 = get_font(18)
F20B = get_font(20, True)
F22B = get_font(22, True)
F30B = get_font(30, True)
F42B = get_font(42, True)


def load_screens() -> dict[str, Image.Image]:
    if not SOURCE_DOC.exists():
        raise FileNotFoundError(f"App screenshot source document not found: {SOURCE_DOC}")
    with zipfile.ZipFile(SOURCE_DOC) as archive:
        def load(index: int) -> Image.Image:
            raw = archive.read(f"word/media/image{index}.png")
            return Image.open(io.BytesIO(raw)).convert("RGB")

        screens = {
            "worklist": load(3),
            "orders": load(4),
            "pacs": load(5),
            "clarifications": load(8),
        }
    return screens


def redact(image: Image.Image, boxes: list[tuple[int, int, int, int]]) -> Image.Image:
    """Strongly blur supplied screen rectangles, retaining the real UI layout."""
    result = image.copy()
    for x1, y1, x2, y2 in boxes:
        crop = result.crop((x1, y1, x2, y2))
        # Pixelation plus blur makes names, IDs, and clinical text unreadable.
        small = crop.resize((max(2, crop.width // 18), max(2, crop.height // 18)), Image.Resampling.BILINEAR)
        masked = small.resize(crop.size, Image.Resampling.NEAREST).filter(ImageFilter.GaussianBlur(7))
        result.paste(masked, (x1, y1))
    return result


def make_safe_screens(screens: dict[str, Image.Image]) -> dict[str, Image.Image]:
    # Header names are obscured on each page. In tables, redact patient,
    # accession, free-text indication, clinician, and direct DICOM identifiers.
    screens["worklist"] = redact(screens["worklist"], [
        (0, 0, 505, 42),
        (143, 390, 486, 594),  # study, patient codes, names, and DICOM IDs
        (835, 390, 949, 594),  # reviewer column prefix
        (930, 430, 1018, 458),  # reviewer name shown beneath Confirmed
    ])
    screens["orders"] = redact(screens["orders"], [
        (0, 0, 505, 42),
        (38, 364, 638, 595),  # accession, patient, indication, and requester
    ])
    screens["pacs"] = redact(screens["pacs"], [
        (0, 0, 505, 42),
        (20, 445, 422, 598),  # DICOM study and patient identifiers
    ])
    screens["clarifications"] = redact(screens["clarifications"], [
        (0, 0, 505, 42),
        (18, 218, 444, 594),  # patient-linked discussion titles and contents
    ])
    return screens


def round_rect(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def cover_frame(screenshot: Image.Image, progress: float) -> Image.Image:
    # Use the genuine worklist as the cover background; the foreground is a
    # title treatment, not a recreated product screen.
    canvas = Image.new("RGB", (WIDTH, HEIGHT), NAVY)
    bg = screenshot.resize((WIDTH, int(screenshot.height * WIDTH / screenshot.width)))
    bg = bg.filter(ImageFilter.GaussianBlur(10)).point(lambda p: int(p * .58))
    canvas.paste(bg.crop((0, 0, WIDTH, min(HEIGHT, bg.height))), (0, 0))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rectangle((0, 0, WIDTH, HEIGHT), fill=(5, 17, 31, 145))
    round_rect(draw, (104, 140, 1176, 580), 26, (11, 31, 49, 244), (52, 91, 111, 255), 2)
    draw.text((158, 194), "HOSPITAL  /  RADIOLOGY", font=F18, fill=MINT)
    draw.text((158, 247), "AI Radiology Triage", font=F42B, fill=WHITE)
    draw.text((158, 312), "Real system UI walkthrough", font=F30B, fill=PALE)
    draw.text((158, 388), "X-ray orders  →  PACS  →  AI worklist  →  radiologist review", font=F18, fill=PALE)
    round_rect(draw, (158, 455, 636, 501), 12, (37, 63, 78, 255), (77, 119, 134, 255), 1)
    draw.text((180, 468), "Captured from app screens  ·  patient data blurred", font=F16, fill=WHITE)
    draw.rectangle((0, 0, int(WIDTH * progress), 5), fill=MINT)
    return canvas


SCENES = [
    ("orders", "01  ·  DOCTOR REQUESTS", "Orders carry the requested exam, priority, and workflow status."),
    ("pacs", "02  ·  DICOM + PACS", "PACS studies appear with modality and processing state."),
    ("worklist", "03  ·  AI WORKLIST", "The real worklist groups HIGH PRIORITY, REVIEW FLAG, and ROUTINE."),
    ("worklist", "04  ·  RADIOLOGIST REVIEW", "Review status is visible beside screening and localization results."),
    ("clarifications", "05  ·  REPORT FOLLOW-UP", "Clarification threads stay linked to the radiology workflow."),
]


def draw_scene(screenshot: Image.Image, scene_index: int, local_progress: float, global_progress: float) -> Image.Image:
    if scene_index == 0:
        return cover_frame(screenshot, global_progress)

    # Keep the authentic page screenshot as the main visual. Slight zoom gives
    # the still capture motion while preserving its real app styling.
    page = screenshot.convert("RGB")
    zoom = 1.0 + .018 * (0.5 - 0.5 * math.cos(math.pi * local_progress))
    w = int(1220 * zoom)
    h = int(page.height * w / page.width)
    page = page.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (WIDTH, HEIGHT), (244, 247, 249))
    x = (WIDTH - w) // 2
    y = 49 + (627 - h) // 2
    canvas.paste(page, (x, y))

    draw = ImageDraw.Draw(canvas, "RGBA")
    # Compact top label and footer explain the capture without covering the
    # principal app controls.
    draw.rectangle((0, 0, WIDTH, 43), fill=(8, 27, 43, 250))
    _, title, caption = SCENES[scene_index - 1]
    draw.text((31, 10), title, font=F18, fill=(93, 225, 201, 255))
    draw.text((WIDTH - 346, 12), "ORIGINAL APP UI  ·  IDENTIFIERS BLURRED", font=get_font(13, True), fill=(220, 232, 239, 255))
    draw.rectangle((0, 674, WIDTH, HEIGHT), fill=(8, 27, 43, 248))
    draw.text((32, 686), caption, font=F16, fill=WHITE)
    draw.rectangle((0, 0, int(WIDTH * global_progress), 5), fill=MINT)
    return canvas


def main():
    screens = make_safe_screens(load_screens())
    sequence: list[tuple[str | None, str]] = [(None, "cover")] + [(key, title) for key, title, _ in SCENES]
    frame_count = int(FPS * SCENE_SECONDS * len(sequence))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError("OpenCV could not initialize the MP4 encoder.")

    try:
        for frame_no in range(frame_count):
            scene_index = min(len(sequence) - 1, frame_no // int(FPS * SCENE_SECONDS))
            frame_in_scene = frame_no % int(FPS * SCENE_SECONDS)
            local = frame_in_scene / int(FPS * SCENE_SECONDS - 1)
            key, _ = sequence[scene_index]
            shot = screens["worklist"] if key is None else screens[key]
            image = draw_scene(shot, scene_index, local, frame_no / max(1, frame_count - 1))
            writer.write(cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR))
    finally:
        writer.release()
    print(f"Rendered {frame_count / FPS:.1f}s real-app UI walkthrough to {OUTPUT}")


if __name__ == "__main__":
    main()
