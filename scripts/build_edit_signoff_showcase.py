import asyncio
import os
import subprocess
from PIL import Image, ImageDraw, ImageFont
import edge_tts

VOICE = 'en-US-AndrewMultilingualNeural'
TOTAL_DURATION = 50.0 # seconds
FPS = 25
TOTAL_FRAMES = int(TOTAL_DURATION * FPS) # 1250 frames
WIDTH = 1920
HEIGHT = 1080

FONT_PATH_REGULAR = "C:/Windows/Fonts/segoeui.ttf"
FONT_PATH_BOLD = "C:/Windows/Fonts/segoeuib.ttf"

font_header = ImageFont.truetype(FONT_PATH_BOLD, 26)
font_badge = ImageFont.truetype(FONT_PATH_BOLD, 18)
font_title = ImageFont.truetype(FONT_PATH_BOLD, 30)
font_desc = ImageFont.truetype(FONT_PATH_REGULAR, 22)
font_timer = ImageFont.truetype(FONT_PATH_REGULAR, 20)

AUDIO_SEGMENTS = [
    {
        "id": "scene1_ready_view",
        "start": 0.5,
        "text": "On the Discharge Desk, patient Joseph is cleared with Ready status. We click 'View Full Discharge Summary Document' to open the complete AI-synthesized clinical record.",
    },
    {
        "id": "scene2_pending_edit",
        "start": 11.5,
        "text": "The discharge modal presents the structured summary under Pending Approval. To make clinical adjustments or fine-tune medication advice, the doctor clicks Edit Summary.",
    },
    {
        "id": "scene3_editable_signoff",
        "start": 24.0,
        "text": "All clinical sections immediately switch into editable fields for complete physician control. Once verified, the attending doctor clicks Approve and Sign-off.",
    },
    {
        "id": "scene4_completed_sync",
        "start": 37.5,
        "text": "The status is immediately updated to Completed. The signed discharge summary syncs directly with the hospital EHR and releases the bed—cutting discharge delays from hours to minutes.",
    }
]

RAW_SCREENSHOTS = {
    "view_summary": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.system_generated/click_feedback/click_feedback_1792485711954.png",
    "edit_summary": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.system_generated/click_feedback/click_feedback_1792485724679.png",
    "approve_signoff": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.system_generated/click_feedback/click_feedback_1792485731656.png",
    "completed_status": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.tempmediaStorage/media_1792485179788.png"
}

SCENE_SCHEDULE = [
    {
        "start_frame": 0, "end_frame": 275, # 0.0s - 11.0s
        "shot": "view_summary",
        "badge": "STATUS: READY • AWAITING SIGN-OFF",
        "badge_color": (16, 185, 129), # Green
        "title": "View Full Discharge Summary Document",
        "desc": "Patient Joseph verified across all 8 dependencies; opening complete clinical record."
    },
    {
        "start_frame": 275, "end_frame": 575, # 11.0s - 23.0s
        "shot": "edit_summary",
        "badge": "STATUS: PENDING APPROVAL • CLINICAL REVIEW",
        "badge_color": (245, 158, 11), # Amber / Gold
        "title": "8-Section Clinical Summary & 'Edit Summary' Action",
        "desc": "Reviews course, vitals, labs, and medications; doctor clicks 'Edit Summary'."
    },
    {
        "start_frame": 575, "end_frame": 925, # 23.0s - 37.0s
        "shot": "approve_signoff",
        "badge": "DOCTOR OVERSIGHT • APPROVE & SIGN-OFF",
        "badge_color": (59, 130, 246), # Medical Blue
        "title": "Editable Fields & One-Click Doctor Sign-Off",
        "desc": "Clinician modifies fields as needed and executes '✓ Approve & Sign-off'."
    },
    {
        "start_frame": 925, "end_frame": 1250, # 37.0s - 50.0s
        "shot": "completed_status",
        "badge": "STATUS: COMPLETED • BED RELEASED",
        "badge_color": (14, 165, 233), # Cyan / Sky Blue
        "title": "Discharge Finalized — EHR Sync & Ward Notification",
        "desc": "Status updated to Completed, legal audit log secured, and bed turnover accelerated."
    }
]

async def build_audio():
    os.makedirs("scratch/edit_signoff_audio", exist_ok=True)
    inputs = []
    filter_delays = []
    amix_inputs = []
    
    for idx, seg in enumerate(AUDIO_SEGMENTS):
        out_f = f"scratch/edit_signoff_audio/{seg['id']}.mp3"
        comm = edge_tts.Communicate(seg['text'], VOICE, rate="+3%")
        await comm.save(out_f)
        seg['file'] = out_f
        inputs.extend(["-i", out_f])
        delay_ms = int(seg['start'] * 1000)
        filter_delays.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms}[a{idx}]")
        amix_inputs.append(f"[a{idx}]")
        
    filter_complex = ";".join(filter_delays) + ";" + "".join(amix_inputs) + f"amix=inputs={len(AUDIO_SEGMENTS)}:duration=longest:dropout_transition=2,apad=whole_dur={TOTAL_DURATION}[outa]"
    out_master = "scratch/edit_signoff_voiceover_50s.mp3"
    cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_complex, "-map", "[outa]", "-t", str(TOTAL_DURATION), out_master]
    print("Mixing 50s voiceover track...")
    subprocess.run(cmd, check=True)
    print("Audio ready at:", out_master)
    return out_master

def preprocess_images():
    print("Cropping and scaling screenshot images (removing browser chrome and top header)...")
    processed = {}
    for key, path in RAW_SCREENSHOTS.items():
        im = Image.open(path).convert("RGBA")
        # Crop out top header (y=78 to end)
        crop_y = 78
        cropped = im.crop((0, crop_y, im.width, im.height))
        
        # Target area in 1920x1080 canvas:
        # Max width 1800, max height 830
        target_w = 1800
        aspect = cropped.height / cropped.width
        target_h = int(target_w * aspect)
        if target_h > 830:
            target_h = 830
            target_w = int(target_h / aspect)
            
        scaled = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
        processed[key] = scaled
    return processed

def render_frame(frame_idx, images):
    # Find current scene
    cur = SCENE_SCHEDULE[-1]
    for s in SCENE_SCHEDULE:
        if s["start_frame"] <= frame_idx < s["end_frame"]:
            cur = s
            break
            
    # Deep slate canvas
    im = Image.new("RGBA", (WIDTH, HEIGHT), (10, 15, 26, 255))
    draw = ImageDraw.Draw(im)

    # Clean Top Header (Branded, minimal)
    draw.rectangle([0, 0, WIDTH, 72], fill=(15, 23, 42, 255))
    draw.line([0, 72, WIDTH, 72], fill=(30, 41, 59, 255), width=2)

    # Brand icon + Title
    draw.rounded_rectangle([32, 16, 76, 56], radius=8, fill=(14, 165, 233, 255))
    draw.text((43, 18), "+", font=font_header, fill=(255, 255, 255, 255))
    draw.text((90, 20), "MERIDIAN HEALTHCARE AI", font=font_header, fill=(255, 255, 255, 255))
    draw.text((450, 24), "•   DISCHARGE SUMMARY & DOCTOR SIGN-OFF", font=font_badge, fill=(148, 163, 184, 255))

    # Elapsed Timer Pill
    secs = frame_idx / FPS
    timer_str = f"00:{int(secs):02d} / 00:{int(TOTAL_DURATION):02d}"
    draw.rounded_rectangle([WIDTH - 190, 16, WIDTH - 32, 54], radius=8, fill=(30, 41, 59, 255), outline=(51, 65, 85, 255), width=1)
    draw.ellipse([WIDTH - 175, 30, WIDTH - 165, 40], fill=(34, 197, 94, 255))
    draw.text((WIDTH - 152, 22), timer_str, font=font_timer, fill=(241, 245, 249, 255))

    # Center UI Image (Framed with subtle shadow & border)
    ui_img = images[cur["shot"]]
    ui_x = (WIDTH - ui_img.width) // 2
    ui_y = 90
    draw.rounded_rectangle([ui_x - 2, ui_y - 2, ui_x + ui_img.width + 2, ui_y + ui_img.height + 2], radius=10, fill=(30, 41, 59, 255), outline=(51, 65, 85, 255), width=2)
    im.paste(ui_img, (ui_x, ui_y), ui_img)

    # Lower Third Presentation Banner
    banner_y = HEIGHT - 144
    draw.rectangle([0, banner_y, WIDTH, HEIGHT - 8], fill=(15, 23, 42, 245))
    draw.line([0, banner_y, WIDTH, banner_y], fill=(30, 41, 59, 255), width=2)

    # Dynamic Scene Badge
    badge_bg = cur["badge_color"]
    draw.rounded_rectangle([32, banner_y + 14, 460, banner_y + 46], radius=6, fill=badge_bg)
    draw.text((46, banner_y + 18), cur["badge"], font=font_badge, fill=(255, 255, 255, 255))

    # Scene Title & Description
    draw.text((480, banner_y + 12), cur["title"], font=font_title, fill=(255, 255, 255, 255))
    draw.text((46, banner_y + 58), cur["desc"], font=font_desc, fill=(148, 163, 184, 255))

    # Progress bar at very bottom
    draw.rectangle([0, HEIGHT - 6, WIDTH, HEIGHT], fill=(30, 41, 59, 255))
    pw = int((frame_idx + 1) / TOTAL_FRAMES * WIDTH)
    draw.rectangle([0, HEIGHT - 6, pw, HEIGHT], fill=(14, 165, 233, 255))

    return im.convert("RGB")

def build_full_video(audio_file, images):
    out_video = "scratch/discharge_edit_signoff_50s.mp4"
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-i", audio_file,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        out_video
    ]

    print(f"Rendering 50s presentation video to {out_video}...")
    proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE)
    for i in range(TOTAL_FRAMES):
        if i % 100 == 0:
            print(f"Rendering frame {i}/{TOTAL_FRAMES} ({(i/TOTAL_FRAMES)*100:.1f}%)...")
        frame = render_frame(i, images)
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()
    print("Video rendered successfully!")
    
    target_docs = "docs/Automated_Discharge_Summary_Generator_Clear_Voiceover.mp4"
    target_artifact = "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/Automated_Discharge_Summary_Generator_Clear_Voiceover.mp4"
    
    import shutil
    shutil.copyfile(out_video, target_docs)
    shutil.copyfile(out_video, target_artifact)
    print(f"Copied final video to:\n  - {target_docs}\n  - {target_artifact}")

if __name__ == "__main__":
    audio = asyncio.run(build_audio())
    images = preprocess_images()
    build_full_video(audio, images)
