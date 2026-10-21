import os
import sys
import subprocess
from PIL import Image, ImageDraw, ImageFont

TOTAL_FRAMES = 1500 # 60 seconds @ 25 fps
FPS = 25
WIDTH = 1920
HEIGHT = 1080

FONT_PATH_REGULAR = "C:/Windows/Fonts/segoeui.ttf"
FONT_PATH_BOLD = "C:/Windows/Fonts/segoeuib.ttf"

font_title = ImageFont.truetype(FONT_PATH_BOLD, 28)
font_scene_tag = ImageFont.truetype(FONT_PATH_BOLD, 20)
font_scene_title = ImageFont.truetype(FONT_PATH_BOLD, 32)
font_scene_sub = ImageFont.truetype(FONT_PATH_REGULAR, 24)
font_timer = ImageFont.truetype(FONT_PATH_REGULAR, 20)

TEMP_DIR = "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.tempmediaStorage"
CLICK_DIR = "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.system_generated/click_feedback"

SCENE_DEFS = [
    {
        "start": 0, "end": 140,
        "image": f"{TEMP_DIR}/media_1792481245232.png",
        "tag": "SCENE 1: SYSTEM OVERVIEW",
        "tag_color": (34, 197, 94),
        "title": "Discharge Command Centre — Real-Time Ward Visibility",
        "desc": "Real-time tracking of pending, blocked, and clearance-ready patient discharges."
    },
    {
        "start": 140, "end": 300,
        "image": f"{TEMP_DIR}/media_1792481256970.png",
        "tag": "SCENE 1: QUEUE MANAGEMENT",
        "tag_color": (34, 197, 94),
        "title": "Prioritised Dependency Queue & Readiness Indicators",
        "desc": "Automated status indicators highlight clinical clearance and pending investigations."
    },
    {
        "start": 300, "end": 450,
        "image": f"{CLICK_DIR}/click_feedback_1792481267538.png",
        "tag": "SCENE 2: PATIENT SELECTION",
        "tag_color": (59, 130, 246),
        "title": "One-Click Ingestion for Attending Clinicians",
        "desc": "Clinician selects active inpatient case to initiate AI-assisted discharge workflow."
    },
    {
        "start": 450, "end": 650,
        "image": f"{TEMP_DIR}/media_1792481275625.png",
        "tag": "SCENE 2: PATIENT 360 INGESTION",
        "tag_color": (59, 130, 246),
        "title": "Automated Synthesis of Vitals, Labs & Doctor Notes",
        "desc": "Multi-model clinical engine aggregates multi-source EHR records into structured context."
    },
    {
        "start": 650, "end": 850,
        "image": f"{TEMP_DIR}/media_1792481284756.png",
        "tag": "SCENE 3: 8-SECTION CLINICAL SUMMARY",
        "tag_color": (168, 85, 247),
        "title": "Instant 8-Section Structured Discharge Summary",
        "desc": "Auto-generates clinical course, diagnoses, and reconciled active medications."
    },
    {
        "start": 850, "end": 1037,
        "image": f"{TEMP_DIR}/media_1792481294128.png",
        "tag": "SCENE 3: SAFETY & CLEARANCE",
        "tag_color": (168, 85, 247),
        "title": "Medication Reconciliation & Care Plan Recommendations",
        "desc": "Flags clinical contraindications and generates clear patient recovery instructions."
    },
    {
        "start": 1037, "end": 1175,
        "image": f"{CLICK_DIR}/click_feedback_1792481296862.png",
        "tag": "SCENE 4: CLINICAL GOVERNANCE",
        "tag_color": (245, 158, 11),
        "title": "Clinician Review & Digital Sign-Off",
        "desc": "Doctors retain full editing control with instant one-click approval and audit trail."
    },
    {
        "start": 1175, "end": 1325,
        "image": f"{TEMP_DIR}/media_1792481304340.png",
        "tag": "SCENE 4: INSTANT EHR SYNC",
        "tag_color": (245, 158, 11),
        "title": "Automated Verification & Signed PDF Generation",
        "desc": "Instantly generates hospital-branded, sign-off discharge documentation."
    },
    {
        "start": 1325, "end": 1500,
        "image": f"{TEMP_DIR}/media_1792481324640.png",
        "tag": "SCENE 5: OPERATIONAL IMPACT",
        "tag_color": (16, 185, 129),
        "title": "Discharge Turnaround Time Reduced by 70%",
        "desc": "Bed turnover expedited, administrative burden eliminated, and patient safety enhanced."
    }
]

# Preload & scale images
print("Preloading scene images...")
loaded_images = {}
for s in SCENE_DEFS:
    p = s["image"]
    if p not in loaded_images:
        orig = Image.open(p).convert("RGBA")
        # Scale to fit nicely inside 1920x1080 canvas
        # Target UI box: width 1760, height 815
        target_w = 1760
        aspect = orig.height / orig.width
        target_h = int(target_w * aspect)
        if target_h > 815:
            target_h = 815
            target_w = int(target_h / aspect)
        scaled = orig.resize((target_w, target_h), Image.Resampling.LANCZOS)
        loaded_images[p] = scaled

def create_frame(frame_idx):
    # Find active scene
    cur_scene = SCENE_DEFS[-1]
    for s in SCENE_DEFS:
        if s["start"] <= frame_idx < s["end"]:
            cur_scene = s
            break
            
    # Base background (sleek modern medical slate)
    im = Image.new("RGBA", (WIDTH, HEIGHT), (11, 15, 25, 255))
    draw = ImageDraw.Draw(im)

    # Top Navigation / Branding Header
    draw.rectangle([0, 0, WIDTH, 76], fill=(17, 24, 39, 255))
    draw.line([0, 76, WIDTH, 76], fill=(30, 41, 59, 255), width=2)
    
    # Logo Pill
    draw.rounded_rectangle([32, 16, 80, 60], radius=8, fill=(14, 165, 233, 255))
    draw.text((45, 20), "+", font=font_title, fill=(255, 255, 255, 255))
    
    draw.text((95, 22), "HOSPITAL HEALTHCARE AI", font=font_title, fill=(255, 255, 255, 255))
    draw.text((440, 26), "|   AG-08 DISCHARGE SUMMARY AGENT", font=font_scene_tag, fill=(148, 163, 184, 255))
    
    # Timer & Status badge top right
    secs = frame_idx / FPS
    timer_text = f"00:{int(secs):02d} / 01:00"
    draw.rounded_rectangle([WIDTH - 210, 18, WIDTH - 32, 58], radius=8, fill=(30, 41, 59, 255), outline=(51, 65, 85, 255), width=1)
    draw.ellipse([WIDTH - 195, 34, WIDTH - 185, 44], fill=(34, 197, 94, 255))
    draw.text((WIDTH - 175, 24), timer_text, font=font_timer, fill=(241, 245, 249, 255))

    # Center UI Container Box
    ui_img = loaded_images[cur_scene["image"]]
    ui_x = (WIDTH - ui_img.width) // 2
    ui_y = 96
    
    # Subtle drop shadow & border
    draw.rounded_rectangle([ui_x - 3, ui_y - 3, ui_x + ui_img.width + 3, ui_y + ui_img.height + 3], radius=12, fill=(30, 41, 59, 255), outline=(71, 85, 105, 255), width=2)
    im.paste(ui_img, (ui_x, ui_y), ui_img)

    # Bottom Lower Third Overlay Banner
    banner_y = HEIGHT - 146
    draw.rectangle([0, banner_y, WIDTH, HEIGHT - 10], fill=(15, 23, 42, 240))
    draw.line([0, banner_y, WIDTH, banner_y], fill=(30, 41, 59, 255), width=2)

    # Scene Tag badge
    tag_bg = cur_scene["tag_color"]
    draw.rounded_rectangle([32, banner_y + 16, 320, banner_y + 48], radius=6, fill=tag_bg)
    draw.text((44, banner_y + 20), cur_scene["tag"], font=font_scene_tag, fill=(255, 255, 255, 255))

    # Title & Subtitle
    draw.text((340, banner_y + 14), cur_scene["title"], font=font_scene_title, fill=(255, 255, 255, 255))
    draw.text((44, banner_y + 60), cur_scene["desc"], font=font_scene_sub, fill=(148, 163, 184, 255))

    # Timeline Progress Bar at very bottom
    draw.rectangle([0, HEIGHT - 8, WIDTH, HEIGHT], fill=(30, 41, 59, 255))
    progress_w = int((frame_idx + 1) / TOTAL_FRAMES * WIDTH)
    draw.rectangle([0, HEIGHT - 8, progress_w, HEIGHT], fill=(14, 165, 233, 255))

    return im.convert("RGB")

def render_video():
    os.makedirs("scratch/video_out", exist_ok=True)
    out_video = "scratch/discharge_summary_agent_presentation.mp4"
    audio_path = "scratch/discharge_voiceover_60s.mp3"

    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",  # stdin
        "-i", audio_path,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        out_video
    ]

    print(f"Starting ffmpeg pipeline to generate {out_video}...")
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)

    for i in range(TOTAL_FRAMES):
        if i % 100 == 0:
            print(f"Rendering frame {i}/{TOTAL_FRAMES} ({(i/TOTAL_FRAMES)*100:.1f}%)...")
        frame = create_frame(i)
        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    proc.wait()
    print("Video rendering complete! File saved at:", out_video)

if __name__ == "__main__":
    render_video()
