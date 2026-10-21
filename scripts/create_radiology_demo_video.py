"""Render a short, synthetic UI walkthrough of the AI radiology workflow."""
from __future__ import annotations

import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "AI_Radiology_Triage_Product_Demo.mp4"
WIDTH, HEIGHT, FPS = 1280, 720, 20
SCENE_SECONDS = 4.25
SCENES = 7
TOTAL_FRAMES = int(FPS * SCENE_SECONDS * SCENES)

BG0 = (9, 17, 31)
BG1 = (15, 31, 48)
PANEL = (19, 34, 51)
PANEL2 = (24, 43, 61)
TEXT = (235, 244, 249)
MUTED = (151, 174, 191)
TEAL = (53, 213, 191)
BLUE = (86, 160, 255)
AMBER = (255, 191, 82)
GREEN = (112, 224, 158)
RED = (255, 117, 127)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


FONT_SIZES = (10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 30, 34, 38, 42, 44, 46)
FONTS = {s: font(s) for s in FONT_SIZES}
FONTS.update({f"b{s}": font(s, True) for s in FONT_SIZES})


def rr(draw, box, radius=14, fill=PANEL, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def label(draw, xy, text, size=18, color=TEXT, bold=False, anchor=None):
    draw.text(xy, text, font=FONTS[f"b{size}" if bold else size], fill=color, anchor=anchor)


def gradient() -> Image.Image:
    arr = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    for y in range(HEIGHT):
        t = y / HEIGHT
        arr[y, :, :] = [int(BG0[i] * (1 - t) + BG1[i] * t) for i in range(3)]
    image = Image.fromarray(arr)
    d = ImageDraw.Draw(image, "RGBA")
    d.ellipse((820, -260, 1520, 460), fill=(18, 135, 145, 24))
    d.ellipse((-370, 460, 430, 1260), fill=(42, 95, 180, 20))
    return image


def base(scene: int, progress: float, alpha: float) -> Image.Image:
    im = gradient()
    d = ImageDraw.Draw(im)
    # Brand/header
    rr(d, (64, 36, 101, 73), 11, fill=(19, 72, 82))
    label(d, (82, 54), "M", 20, TEAL, True, anchor="mm")
    label(d, (114, 43), "HOSPITAL", 16, TEXT, True)
    label(d, (114, 63), "RADIOLOGY AI", 12, MUTED, True)
    rr(d, (1005, 42, 1216, 72), 15, fill=(32, 52, 67), outline=(50, 76, 93))
    label(d, (1110, 57), "ILLUSTRATIVE DEMO", 12, (192, 220, 226), True, anchor="mm")
    d.line((64, 94, 1216, 94), fill=(49, 72, 89), width=1)

    # Workflow stepper
    steps = ["ORDER", "PACS", "AI SCREEN", "REVIEW", "RESULT"]
    x0, y = 66, 675
    d.line((x0, y, 1210, y), fill=(53, 74, 89), width=2)
    for i, step in enumerate(steps):
        x = x0 + i * 285
        active = min(scene, 4) == i or (scene == 0 and i == 0)
        d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=TEAL if active else (69, 91, 107))
        label(d, (x, y - 25), step, 12, TEAL if active else MUTED, active)

    # Fine progress segment across the header line.
    barw = int(1152 * ((scene + progress) / SCENES))
    d.rounded_rectangle((64, 92, 64 + barw, 96), 2, fill=TEAL)
    return im


def draw_xray(draw, x, y, w, h, overlay=False, pulse=0.0):
    rr(draw, (x, y, x + w, y + h), 14, fill=(4, 10, 18), outline=(41, 71, 89), width=1)
    cx = x + w / 2
    # Subtle chest field and spine, all schematic and synthetic.
    draw.ellipse((x + 33, y + 20, x + w - 33, y + h - 18), fill=(15, 24, 33))
    draw.rounded_rectangle((cx - 7, y + 40, cx + 7, y + h - 42), 6, fill=(128, 151, 160))
    for i in range(7):
        ry = y + 55 + i * (h - 110) / 7
        draw.arc((x + 45, ry - 12, cx + 4, ry + 44), 192, 350, fill=(138, 165, 173), width=2)
        draw.arc((cx - 4, ry - 12, x + w - 45, ry + 44), 190, 348, fill=(138, 165, 173), width=2)
    draw.ellipse((x + w * .22, y + h * .20, x + w * .43, y + h * .78), fill=(58, 77, 86), outline=(153, 171, 178), width=2)
    draw.ellipse((x + w * .57, y + h * .20, x + w * .78, y + h * .78), fill=(58, 77, 86), outline=(153, 171, 178), width=2)
    # Mask the spine gently to make the lung shapes distinct.
    draw.rounded_rectangle((cx - 5, y + 65, cx + 5, y + h - 55), 5, fill=(116, 138, 147))
    if overlay:
        wobble = int(2 * math.sin(pulse * math.tau))
        for bx, by, bw, bh in ((x + int(w * .28), y + int(h * .36), 54, 43),
                               (x + int(w * .60), y + int(h * .55), 48, 38)):
            draw.rounded_rectangle((bx, by + wobble, bx + bw, by + bh + wobble), 6, outline=TEAL, width=3)
            draw.ellipse((bx + bw - 9, by - 7 + wobble, bx + bw + 4, by + 6 + wobble), fill=TEAL)
        label(draw, (x + 16, y + h - 24), "LOCALIZATION PREVIEW · SYNTHETIC", 10, TEAL, True)


def draw_order(draw, pulse):
    rr(draw, (88, 164, 610, 582), 20, fill=(14, 27, 42), outline=(48, 75, 94), width=1)
    label(draw, (116, 188), "PATIENT 360", 13, TEAL, True)
    label(draw, (116, 224), "Imaging request", 26, TEXT, True)
    rr(draw, (116, 269, 582, 332), 12, fill=(24, 43, 61))
    label(draw, (136, 281), "PATIENT", 11, MUTED, True)
    label(draw, (136, 301), "Demo Patient  ·  DEMO-042", 17, TEXT, True)
    label(draw, (116, 358), "EXAMINATION", 11, MUTED, True)
    label(draw, (116, 380), "Chest X-ray  ·  PA + AP", 20, TEXT, True)
    label(draw, (116, 424), "CLINICAL INDICATION", 11, MUTED, True)
    label(draw, (116, 447), "New respiratory symptoms", 17, TEXT)
    rr(draw, (116, 493, 257, 536), 10, fill=(20, 73, 75), outline=(34, 129, 128))
    label(draw, (186, 515), "ORDER CREATED", 12, TEAL, True, anchor="mm")
    label(draw, (283, 515), "Accession  XR-20481", 14, MUTED, True, anchor="lm")
    rr(draw, (469, 188, 582, 220), 16, fill=(57, 64, 44))
    label(draw, (525, 204), "URGENT", 11, AMBER, True, anchor="mm")


def draw_pacs(draw, pulse):
    rr(draw, (88, 164, 610, 582), 20, fill=(14, 27, 42), outline=(48, 75, 94))
    label(draw, (116, 189), "DICOM INGESTION", 13, TEAL, True)
    label(draw, (116, 226), "Verified before analysis", 24, TEXT, True)
    cards = [("Patient ID", "Matches order", GREEN), ("Accession", "XR-20481", GREEN), ("View", "PA + AP", GREEN), ("PACS", "Orthanc stored", GREEN)]
    for i, (name, value, c) in enumerate(cards):
        yy = 278 + i * 62
        rr(draw, (116, yy, 582, yy + 49), 10, fill=(22, 40, 57))
        draw.ellipse((133, yy + 17, 147, yy + 31), fill=c)
        label(draw, (162, yy + 9), name, 13, MUTED, True)
        label(draw, (354, yy + 10), value, 16, TEXT, True)
    label(draw, (116, 546), "Order-linked upload · traceable study", 13, MUTED)


def draw_models(draw, pulse):
    draw_xray(draw, 88, 164, 250, 368, overlay=True, pulse=pulse)
    # Parallel model cards
    for yy, title, name, detail, accent in [
        (164, "SCREENING", "DenseNet121", "Opacity signal", BLUE),
        (354, "LOCALIZATION", "YOLO11n", "Candidate regions", TEAL),
    ]:
        rr(draw, (365, yy, 610, yy + 159), 16, fill=(14, 27, 42), outline=(48, 75, 94))
        label(draw, (389, yy + 20), title, 11, accent, True)
        label(draw, (389, yy + 52), name, 22, TEXT, True)
        label(draw, (389, yy + 87), detail, 15, MUTED)
        # Animated inference meter
        draw.rounded_rectangle((389, yy + 123, 586, yy + 131), 4, fill=(44, 64, 79))
        draw.rounded_rectangle((389, yy + 123, 389 + int(197 * (.57 + .07 * math.sin(pulse * math.tau))), yy + 131), 4, fill=accent)
    label(draw, (371, 536), "ONE COMBINED REVIEW PRIORITY", 12, AMBER, True)


def draw_worklist(draw, pulse):
    rr(draw, (88, 164, 610, 582), 20, fill=(14, 27, 42), outline=(48, 75, 94))
    label(draw, (116, 188), "RADIOLOGY · AI WORKLIST", 13, TEAL, True)
    label(draw, (116, 222), "Review in priority order", 23, TEXT, True)
    rows = [
        ("HIGH PRIORITY", "Demo Patient · DEMO-042", AMBER, "Needs review"),
        ("REVIEW FLAG", "Demo Patient · DEMO-118", BLUE, "Needs review"),
        ("ROUTINE", "Demo Patient · DEMO-207", GREEN, "Routine queue"),
    ]
    for i, (status, who, color, note) in enumerate(rows):
        yy = 278 + i * 82
        active = i == 0
        rr(draw, (112, yy, 586, yy + 67), 12, fill=(25, 45, 62) if active else (18, 34, 50), outline=color if active else (39, 60, 77), width=2 if active else 1)
        rr(draw, (127, yy + 13, 269, yy + 39), 13, fill=tuple(int(v * .25) for v in color))
        label(draw, (198, yy + 26), status, 10, color, True, anchor="mm")
        label(draw, (286, yy + 14), who, 14, TEXT, True)
        label(draw, (286, yy + 39), note, 12, MUTED)


def draw_review(draw, pulse):
    rr(draw, (88, 164, 610, 582), 20, fill=(14, 27, 42), outline=(48, 75, 94))
    label(draw, (116, 188), "RADIOLOGIST REVIEW", 13, TEAL, True)
    draw_xray(draw, 116, 222, 230, 292, overlay=True, pulse=pulse)
    rr(draw, (365, 222, 582, 514), 14, fill=(23, 41, 58), outline=(49, 73, 90))
    label(draw, (385, 245), "AI SCREENING", 11, MUTED, True)
    label(draw, (385, 270), "Review flag", 19, AMBER, True)
    label(draw, (385, 310), "Original + localized", 13, TEXT)
    label(draw, (385, 331), "views available", 13, TEXT)
    dline = 367
    draw.line((385, dline, 558, dline), fill=(51, 71, 86), width=1)
    label(draw, (385, 383), "FINAL REPORT", 11, MUTED, True)
    label(draw, (385, 410), "Radiologist", 16, TEXT, True)
    label(draw, (385, 434), "reviews and signs off", 12, MUTED)
    rr(draw, (385, 464, 558, 496), 9, fill=(19, 81, 69))
    label(draw, (471, 480), "CONFIRM REPORT", 11, GREEN, True, anchor="mm")
    label(draw, (116, 536), "OHIF viewer · audit trail · reviewer identity", 12, MUTED)


def draw_result(draw, pulse):
    rr(draw, (88, 164, 610, 582), 20, fill=(14, 27, 42), outline=(48, 75, 94))
    label(draw, (116, 188), "PATIENT RECORD", 13, TEAL, True)
    label(draw, (116, 222), "Reviewed result", 25, TEXT, True)
    rr(draw, (116, 271, 582, 342), 13, fill=(20, 66, 59), outline=(40, 120, 95))
    draw.ellipse((137, 293, 158, 314), fill=GREEN)
    label(draw, (148, 304), "✓", 13, (7, 32, 29), True, anchor="mm")
    label(draw, (175, 283), "Radiologist confirmed", 16, GREEN, True)
    label(draw, (175, 310), "Final report · reviewer · timestamp", 13, TEXT)
    label(draw, (116, 370), "One linked imaging journey", 15, TEXT, True)
    for i, (txt, c) in enumerate([("Order + accession", TEAL), ("Study + images", BLUE), ("Final report", GREEN)]):
        xx = 116 + i * 154
        rr(draw, (xx, 408, xx + 141, 461), 11, fill=(22, 40, 57), outline=(42, 65, 82))
        label(draw, (xx + 70, 435), txt, 11, c, True, anchor="mm")
        if i < 2:
            label(draw, (xx + 147, 435), "→", 19, MUTED, True, anchor="mm")
    rr(draw, (116, 490, 582, 540), 11, fill=(21, 39, 55))
    label(draw, (137, 506), "Report clarification", 13, TEXT, True)
    label(draw, (137, 526), "Ask the reporting radiologist · retained with the study", 11, MUTED)


COPY = [
    ("A clearer path from image to action", "A connected chest X-ray workflow, built around the clinical team.", ["Patient-linked from the first request", "AI helps organize attention", "Radiologist owns the final report"]),
    ("Start with a doctor’s order", "The examination, indication, and priority travel together.", ["PA, AP, or PA + AP", "Unique accession follows the study", "Request begins in Patient 360"]),
    ("Verify. Store. Keep it linked.", "DICOM identity and requested views are checked before the study enters the workflow.", ["Patient ID + accession validation", "Orthanc PACS confirms storage", "Unlinked archive images stay outside results"]),
    ("Two models. One review signal.", "DenseNet screens the study; YOLO highlights candidate regions.", ["DICOM-aware image preprocessing", "Combined rule sets review priority", "AI output guides attention, not diagnosis"]),
    ("Put the right study in view", "The worklist surfaces unconfirmed high-priority cases first.", ["HIGH PRIORITY · both signals", "REVIEW FLAG · either signal", "ROUTINE · interpretation still required"]),
    ("A radiologist makes the call", "Review source images, localization, and context before confirming or editing the report.", ["OHIF viewer for PACS studies", "Human-reviewed final interpretation", "Reviewer identity and time retained"]),
    ("Close the loop with care teams", "The reviewed result returns to the patient workflow with its history intact.", ["One accession-linked result", "Follow-up comparison available", "Clarification stays with the report"]),
]


def draw_scene(scene: int, p: float) -> Image.Image:
    im = base(scene, p, 1)
    d = ImageDraw.Draw(im)
    # Soft entrance motion for the split layout.
    eased = 1 - (1 - min(1.0, p * 1.9)) ** 3
    shift = int(24 * (1 - eased))
    opacity = int(255 * min(1.0, p * 4 + .2))
    fg = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fg)

    left_drawers = [None, draw_order, draw_pacs, draw_models, draw_worklist, draw_review, draw_result]
    if scene == 0:
        # Hero composition: workflow pulse and image preview.
        rr(fd, (90, 170, 1190, 590), 24, fill=(14, 27, 42), outline=(48, 75, 94), width=1)
        label(fd, (132, 220), "AI-ASSISTED CHEST X-RAY TRIAGE", 13, TEAL, True)
        label(fd, (132, 270), "From request", 46, TEXT, True)
        label(fd, (132, 325), "to radiologist review.", 42, TEXT, True)
        label(fd, (132, 395), "A traceable workflow. Human-led decisions.", 19, MUTED)
        rr(fd, (132, 455, 360, 501), 12, fill=(21, 72, 73), outline=(35, 137, 128))
        label(fd, (246, 478), "ORDER  →  SCREEN  →  REVIEW", 13, TEAL, True, anchor="mm")
        draw_xray(fd, 800, 207, 300, 335, overlay=True, pulse=p)
        # Tiny linked nodes convey a connected hospital workflow.
        for i, (txt, x) in enumerate([("ORDER", 796), ("AI", 920), ("REVIEW", 1039)]):
            rr(fd, (x, 553, x + 92, 580), 12, fill=(24, 47, 61))
            label(fd, (x + 46, 566), txt, 10, TEAL if i < 2 else GREEN, True, anchor="mm")
    else:
        # Left product panel
        panel_x = 88 - shift
        left_drawers[scene](fd, p)
        # Move panel content from source x to entrance x via crop and paste.
        # (Draw directly to target coordinates after offset translation.)
        # Right text column
        eyebrow = f"0{scene}  /  {['', 'ORDER', 'PACS', 'AI SCREEN', 'WORKLIST', 'REVIEW', 'RESULT'][scene]}"
        label(fd, (668 + shift, 187), eyebrow, 13, TEAL, True)
        title, subtitle, bullets = COPY[scene]
        words = title.split()
        # Two-line title at a controlled width.
        if scene in (0, 1, 2, 3, 4, 5, 6):
            if len(title) > 26:
                split_at = len(words) // 2
                # Keep the first line compact for the product-demo layout.
                line1, line2 = " ".join(words[:split_at]), " ".join(words[split_at:])
                label(fd, (668 + shift, 230), line1, 34, TEXT, True)
                label(fd, (668 + shift, 274), line2, 34, TEXT, True)
                sub_y = 338
            else:
                label(fd, (668 + shift, 230), title, 34, TEXT, True)
                sub_y = 293
        label(fd, (668 + shift, sub_y), subtitle, 17, MUTED)
        yy = sub_y + 74
        for i, item in enumerate(bullets):
            dot_y = yy + i * 54
            fd.ellipse((670 + shift, dot_y + 6, 681 + shift, dot_y + 17), fill=[TEAL, BLUE, GREEN][i])
            label(fd, (697 + shift, dot_y), item, 15, TEXT)
        if scene in (3, 4):
            rr(fd, (668 + shift, 526, 1159 + shift, 565), 10, fill=(41, 51, 47), outline=(103, 95, 61))
            label(fd, (686 + shift, 546), "SCREENING SUPPORT ONLY  ·  NOT A DIAGNOSIS", 11, AMBER, True, anchor="lm")

    # Overlay subtle glowing accent and disclaimer at close.
    if scene == 6:
        label(fd, (668 + shift, 526), "AI screens. Radiologists decide. Care teams follow through.", 15, TEAL, True)
        label(fd, (668 + shift, 557), "Illustrative workflow · Synthetic demo visuals · Not for clinical use", 12, MUTED)

    # Apply a small entrance translation to the whole panel by compositing.
    alpha = fg.getchannel("A")
    rgba = fg.copy()
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    canvas.alpha_composite(rgba, (shift, 0))
    im = Image.alpha_composite(im.convert("RGBA"), canvas).convert("RGB")
    return im


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # MP4V is supplied by the OpenCV build in the demo environment.
    writer = cv2.VideoWriter(str(OUTPUT), cv2.VideoWriter_fourcc(*"mp4v"), FPS, (WIDTH, HEIGHT))
    if not writer.isOpened():
        raise RuntimeError("OpenCV could not initialize an MP4 video encoder.")
    try:
        for frame_no in range(TOTAL_FRAMES):
            scene = min(SCENES - 1, int(frame_no / (FPS * SCENE_SECONDS)))
            local = (frame_no / FPS - scene * SCENE_SECONDS) / SCENE_SECONDS
            # Small breathing pulse in the image overlay, then a gentle hold at each beat.
            p = max(0.0, min(1.0, local))
            image = draw_scene(scene, p)
            writer.write(cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR))
    finally:
        writer.release()
    print(f"Rendered {SCENES} scenes / {TOTAL_FRAMES / FPS:.1f}s to {OUTPUT}")


if __name__ == "__main__":
    main()
