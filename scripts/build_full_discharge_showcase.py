import asyncio
import os
import subprocess
from PIL import Image, ImageDraw, ImageFont
import edge_tts

VOICE = 'en-US-AndrewMultilingualNeural'
TOTAL_DURATION = 58.0 # seconds (under 1 minute)
FPS = 25
TOTAL_FRAMES = int(TOTAL_DURATION * FPS) # 1450 frames
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
        "id": "scene1_desk_overview",
        "start": 0.5,
        "text": "Welcome to the Discharge Management Desk. The platform automatically tracks every inpatient across real-time operational queues—categorizing cases into Blocked, Approval Required, Ready, and Completed.",
    },
    {
        "id": "scene2_view_summary",
        "start": 11.5,
        "text": "Selecting a patient displays the live dependency graph and clearance status. We click View Full Discharge Summary Document to open the complete eight-section clinical summary.",
    },
    {
        "id": "scene3_edit_summary",
        "start": 23.0,
        "text": "The discharge modal displays the AI-synthesized record under Pending Approval. To modify diagnoses or adjust patient instructions, the attending doctor clicks Edit Summary.",
    },
    {
        "id": "scene4_approve_signoff",
        "start": 34.5,
        "text": "All clinical sections switch into editable text fields for full physician oversight. Once verified, the doctor clicks Approve and Sign-off to authenticate the legal medical record.",
    },
    {
        "id": "scene5_completed_release",
        "start": 47.0,
        "text": "The case status updates immediately to Completed, automatically releasing the hospital bed and syncing signed instructions with the EHR—reducing turnaround from hours to minutes.",
    }
]

RAW_SCREENSHOTS = {
    "desk": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.tempmediaStorage/media_1792481245232.png",
    "view_summary": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.system_generated/click_feedback/click_feedback_1792485711954.png",
    "edit_summary": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.system_generated/click_feedback/click_feedback_1792485724679.png",
    "approve_signoff": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.system_generated/click_feedback/click_feedback_1792485731656.png",
    "completed": "C:/Users/Bsoft/.gemini/antigravity-ide/brain/a13698b2-78d4-4ab4-a6fd-8af7551b8d93/.tempmediaStorage/media_1792485179788.png"
}

SCENE_SCHEDULE = [
    {
        "start_frame": 0, "end_frame": 275, # 0.0s - 11.0s
        "shot": "desk",
        "badge": "DISCHARGE DESK • QUEUES & METRICS",
        "badge_color": (34, 197, 94), # Emerald Green
        "title": "Discharge Management Desk — Real-Time Ward Queues",
        "desc": "Real-time visibility into Ready (47), Blocked (103), Approval Required (24), and Completed cases."
    },
    {
        "start_frame": 275, "end_frame": 560, # 11.0s - 22.4s
        "shot": "view_summary",
        "badge": "PATIENT CASE: READY • VIEW SUMMARY",
        "badge_color": (16, 185, 129), # Green
        "title": "View Full Discharge Summary Document",
        "desc": "Patient Joseph verified across all 8 clearances; opening comprehensive clinical document."
    },
    {
        "start_frame": 560, "end_frame": 850, # 22.4s - 34.0s
        "shot": "edit_summary",
        "badge": "STATUS: PENDING APPROVAL • EDIT SUMMARY",
        "badge_color": (245, 158, 11), # Amber / Gold
        "title": "8-Section AI Clinical Draft & Edit Mode",
        "desc": "Reviews hospital course, vitals, labs, and medications; doctor clicks '✏️ Edit Summary'."
    },
    {
        "start_frame": 850, "end_frame": 1160, # 34.0s - 46.4s
        "shot": "approve_signoff",
        "badge": "DOCTOR OVERSIGHT • APPROVE & SIGN-OFF",
        "badge_color": (59, 130, 246), # Medical Blue
        "title": "Interactive Editing & Final Digital Sign-Off",
        "desc": "Editable text fields enable physician adjustments; click '✓ Approve & Sign-off' to authenticate."
    },
    {
        "start_frame": 1160, "end_frame": 1450, # 46.4s - 58.0s
        "shot": "completed",
        "badge": "STATUS: COMPLETED • BED RELEASED",
        "badge_color": (14, 165, 233), # Cyan / Sky Blue
        "title": "Discharge Finalized — EHR Sync & Bed Turnover",
        "desc": "Status updated to Completed, ward nursing notified, and hospital bed released immediately."
    }
]

async def build_audio():
    os.makedirs("scratch/full_showcase_audio", exist_ok=True)
    inputs = []
    filter_delays = []
    amix_inputs = []
    
    for idx, seg in enumerate(AUDIO_SEGMENTS):
        out_f = f"scratch/full_showcase_audio/{seg['id']}.mp3"
        comm = edge_tts.Communicate(seg['text'], VOICE, rate="+3%")
        await comm.save(out_f)
        seg['file'] = out_f
        inputs.extend(["-i", out_f])
        delay_ms = int(seg['start'] * 1000)
        filter_delays.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms}[a{idx}]")
        amix_inputs.append(f"[a{idx}]")
        
    filter_complex = ";".join(filter_delays) + ";" + "".join(amix_inputs) + f"amix=inputs={len(AUDIO_SEGMENTS)}:duration=longest:dropout_transition=2,apad=whole_dur={TOTAL_DURATION}[outa]"
    out_master = "scratch/full_showcase_voiceover_58s.mp3"
    cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_complex, "-map", "[outa]", "-t", str(TOTAL_DURATION), out_master]
    print("Mixing 58s voiceover track...")
    subprocess.run(cmd, check=True)
    print("Audio ready at:", out_master)
    return out_master

def preprocess_images():
    print("Cropping and scaling screenshot images (removing browser chrome and top header)...")
    processed = {}
    for key, path in RAW_SCREENSHOTS.items():
        im = Image.open(path).convert("RGBA")
        crop_y = 78
        cropped = im.crop((0, crop_y, im.width, im.height))
        
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
    cur = SCENE_SCHEDULE[-1]
    for s in SCENE_SCHEDULE:
        if s["start_frame"] <= frame_idx < s["end_frame"]:
            cur = s
            break
            
    im = Image.new("RGBA", (WIDTH, HEIGHT), (10, 15, 26, 255))
    draw = ImageDraw.Draw(im)

    # Branded Top Bar
    draw.rectangle([0, 0, WIDTH, 72], fill=(15, 23, 42, 255))
    draw.line([0, 72, WIDTH, 72], fill=(30, 41, 59, 255), width=2)

    # Brand icon + Title
    draw.rounded_rectangle([32, 16, 76, 56], radius=8, fill=(14, 165, 233, 255))
    draw.text((43, 18), "+", font=font_header, fill=(255, 255, 255, 255))
    draw.text((90, 20), "MERIDIAN HEALTHCARE AI", font=font_header, fill=(255, 255, 255, 255))
    draw.text((450, 24), "•   DISCHARGE MANAGEMENT DESK & SUMMARY AGENT", font=font_badge, fill=(148, 163, 184, 255))

    # Elapsed Timer Pill
    secs = frame_idx / FPS
    timer_str = f"00:{int(secs):02d} / 00:{int(TOTAL_DURATION):02d}"
    draw.rounded_rectangle([WIDTH - 190, 16, WIDTH - 32, 54], radius=8, fill=(30, 41, 59, 255), outline=(51, 65, 85, 255), width=1)
    draw.ellipse([WIDTH - 175, 30, WIDTH - 165, 40], fill=(34, 197, 94, 255))
    draw.text((WIDTH - 152, 22), timer_str, font=font_timer, fill=(241, 245, 249, 255))

    # Center UI Image
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
    out_video = "scratch/discharge_full_showcase_58s.mp4"
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

    print(f"Rendering 58s presentation video to {out_video}...")
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
