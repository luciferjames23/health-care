"""Produce a narrated, captioned showcase using authentic application captures."""
import asyncio
import json
import subprocess
import sys
import wave
import io
import zipfile
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".video-tools"))
import edge_tts
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw
from render_ai_radiology_triage_showcase import make_safe_screens, load_screens, get_font, redact, SOURCE_DOC

BUILD = ROOT / "scratch" / "narrated_showcase"
OUT = ROOT / "docs" / "AI_Radiology_Triage_US_Showcase_Cursor.mp4"
FF = imageio_ffmpeg.get_ffmpeg_exe()
W, H, FPS = 1920, 1080, 24
SCENES = [
    ("worklist", "AI RADIOLOGY TRIAGE", "From imaging request to clinical review",
     "This is Meridian AI Radiology Triage: an integrated workflow connecting imaging requests, DICOM storage, AI prioritization, and radiologist review."),
    ("orders", "01 / ORDER", "Clinical context enters the workflow",
     "The workflow starts with a chest X-ray order. The requesting clinician records the examination, clinical indication, and urgency, creating a traceable accession."),
    ("pacs", "02 / INGEST", "Order-linked DICOM · PACS storage",
     "Uploaded DICOM studies are checked against the order and stored in PACS. Order-linked studies then move into the analysis pipeline."),
    ("worklist", "03 / ANALYZE", "DenseNet121 screening + YOLO localization",
     "Two models contribute complementary signals: DenseNet screening and YOLO localization. Their combined results assign high priority, review flag, or routine status."),
    ("worklist", "04 / PRIORITIZE", "AI signals alongside review status",
     "The worklist brings priorities, screening scores, localization results, and review status together, helping radiologists identify which studies need attention."),
    ("result", "05 / REVIEW", "Human review remains the decision point",
     "The radiologist reviews the images and AI findings, then confirms or edits the report. Final clinical interpretation remains with the radiologist."),
    ("clarifications", "06 / FOLLOW THROUGH", "Patient-linked report clarification",
     "Results return to the patient workflow, while linked clarification threads support follow-up between clinicians and radiologists."),
    ("worklist", "ENGINEERED END TO END", "Clinical workflow · Imaging integration · Applied AI",
     "This prototype demonstrates end-to-end engineering across clinical workflow, imaging integration, applied AI, and accountable human review."),
]

async def narration():
    for i, (_, _, _, text) in enumerate(SCENES):
        path = BUILD / f"voice_{i}.mp3"
        if not path.exists() or path.stat().st_size < 1000:
            await edge_tts.Communicate(text, "en-US-AndrewNeural", rate="+8%").save(str(path))
        print(f"Narration {i+1}/{len(SCENES)}", flush=True)

def run(args):
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y"] + args, check=True)

def stamp(seconds):
    ms = round(seconds*1000)
    return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"

# Narration cue times in seconds; coordinates refer to the original captures.
# These are editorial pointer movements, not simulated application clicks.
CUES = [
    [(0,157,159),(3.6,53,159),(5.1,370,159),(6.8,390,260),(8.4,980,415)],
    [(0,55,165),(1.5,331,380),(4.1,420,348),(6.2,657,389),(8.0,96,347)],
    [(0,370,289),(2.1,180,427),(4.2,322,382),(6.0,890,468)],
    [(0,570,375),(2.5,570,419),(4.5,690,419),(6.1,413,266),(7.6,700,266),(9.0,970,266)],
    [(0,75,418),(2.0,570,418),(3.5,690,418),(5.0,980,418),(7.5,1095,418)],
    [(0,85,65),(2.1,310,42),(4.0,390,83),(6.4,389,113),(8.1,789,139)],
    [(0,480,152),(2.5,165,194),(4.2,237,280),(6.1,555,245)],
    [(0,55,159),(2.5,370,159),(4.1,570,418),(5.6,690,418),(7.0,980,418)],
]

def draw_cursor(frame, scene, seconds, x, y, factor, original_height):
    cues = CUES[scene]
    target = cues[0]
    px, py = target[1:]
    for j in range(1, len(cues)):
        arrival, tx, ty = cues[j]
        previous = cues[j-1]
        depart = max(previous[0], arrival-.85)
        if seconds < depart:
            break
        if seconds < arrival:
            u = (seconds-depart)/(arrival-depart)
            ease = u*u*(3-2*u)
            px = previous[1]+(tx-previous[1])*ease
            py = previous[2]+(ty-previous[2])*ease-12*math.sin(math.pi*u)
            break
        px,py = tx,ty
        target = cues[j]
    sy = 0 if scene == 5 else 65
    px, py = x+px*factor, y+(py-sy)*factor
    overlay = Image.new("RGBA",frame.size,(0,0,0,0))
    d=ImageDraw.Draw(overlay)
    # Soft constant halo communicates focus without implying a click.
    r=26
    d.ellipse((px-r,py-r,px+r,py+r),fill=(55,214,190,35),outline=(65,220,195,125),width=2)
    polygon=[(0,0),(0,31),(8,24),(15,40),(21,37),(14,22),(25,22)]
    d.polygon([(px+dx+2,py+dy+3) for dx,dy in polygon],fill=(0,0,0,90))
    points=[(px+dx,py+dy) for dx,dy in polygon]
    d.polygon(points,fill="white")
    d.line(points+[points[0]],fill=(12,28,43,255),width=2)
    frame.paste(overlay,(0,0),overlay)

def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    asyncio.run(narration())
    durations, samples = [], []
    captions, entries = [], []
    offset = 0.0
    for i, scene in enumerate(SCENES):
        wav = BUILD / f"voice_{i}.wav"
        run(["-i", str(BUILD/f"voice_{i}.mp3"), "-ar", "48000", "-ac", "1", str(wav)])
        with wave.open(str(wav)) as f:
            audio = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16)
        pad = np.zeros(24000, dtype=np.int16)
        segment = np.concatenate([np.zeros(9600, dtype=np.int16), audio, pad])
        duration = len(segment)/48000
        duration = np.ceil(duration*FPS)/FPS
        segment = np.pad(segment, (0, round(duration*48000)-len(segment)))
        samples.append(segment)
        durations.append(duration)
        words = scene[3].split()
        chunks = [" ".join(words[j:j+10]) for j in range(0,len(words),10)]
        for j, chunk in enumerate(chunks):
            start = offset + .2 + len(audio)/48000*j/len(chunks)
            end = offset + .2 + len(audio)/48000*(j+1)/len(chunks)
            captions.append((start,end,chunk))
            entries.append(f"{len(entries)+1}\n{stamp(start)} --> {stamp(end)}\n{chunk}\n")
        offset += duration
    with wave.open(str(BUILD/"narration.wav"), "wb") as f:
        f.setparams((1,2,48000,0,"NONE","not compressed"))
        f.writeframes(np.concatenate(samples).tobytes())
    OUT.with_suffix(".srt").write_text("\n".join(entries), encoding="utf-8")
    OUT.with_suffix(".txt").write_text("\n\n".join(s[1]+"\n"+s[3] for s in SCENES), encoding="utf-8")
    screens = make_safe_screens(load_screens())
    with zipfile.ZipFile(SOURCE_DOC) as archive:
        result = Image.open(io.BytesIO(archive.read("word/media/image7.png"))).convert("RGB")
    result = redact(result, [(338,1127,635,1163)])
    screens["result"] = result.crop((164,1005,1007,1164))
    cmd = [FF, "-hide_banner", "-loglevel", "error", "-y",
           "-f","rawvideo","-vcodec","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}",
           "-r",str(FPS),"-i","-","-i",str(BUILD/"narration.wav"),
           "-c:v","libx264","-preset","fast","-crf","18","-pix_fmt","yuv420p",
           "-c:a","aac","-b:a","192k","-movflags","+faststart",str(OUT)]
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = sum(durations)
    elapsed = 0
    for i,(key,title,subtitle,_) in enumerate(SCENES):
        shot = screens[key]
        # Remove the captured staff header from the presentation frame.
        if key != "result":
            shot = shot.crop((0,65,shot.width,shot.height))
        factor=min(1796/shot.width,714/shot.height)
        size=(round(shot.width*factor),round(shot.height*factor))
        view=shot.resize(size,Image.Resampling.LANCZOS)
        x=(W-size[0])//2
        y=204+(714-size[1])//2
        for n in range(round(durations[i]*FPS)):
            t = elapsed+n/FPS
            frame = Image.new("RGB",(W,H),(9,19,34))
            d = ImageDraw.Draw(frame)
            d.text((64,32),"MERIDIAN / PRODUCT SHOWCASE",font=get_font(21,True),fill="#62dcc5")
            d.text((1480,34),"ORIGINAL SYSTEM CAPTURES",font=get_font(18),fill="#a7b8ca")
            d.text((64,82),title,font=get_font(38,True),fill="white")
            d.text((64,140),subtitle,font=get_font(25),fill="#b9cadb")
            frame.paste(view,(x,y))
            d=ImageDraw.Draw(frame)
            d.rounded_rectangle((x-2,y-2,x+size[0]+2,y+size[1]+2),radius=6,outline="#35536a",width=2)
            draw_cursor(frame,i,n/FPS,x,y,factor,shot.height)
            d=ImageDraw.Draw(frame)
            caption=next((c for a,b,c in captions if a<=t<b),"")
            box=d.textbbox((0,0),caption,font=get_font(30))
            d.text(((W-(box[2]-box[0]))//2,946),caption,font=get_font(30),fill="white")
            d.text((64,1024),"ORIGINAL UI  •  GUIDED CURSOR OVERLAY  •  IDENTIFIERS OBSCURED",font=get_font(17),fill="#8da2b8")
            d.text((1550,1024),f"{i+1:02} / 08   •   HUMAN REVIEW",font=get_font(17),fill="#8da2b8")
            d.rectangle((0,1074,round(W*t/total),1079),fill="#62dcc5")
            fade = min(1.0, n/(FPS*.22), (round(durations[i]*FPS)-1-n)/(FPS*.22))
            if fade < 1:
                frame = Image.blend(Image.new("RGB",(W,H),(9,19,34)), frame, max(0,fade))
            if n==round(durations[i]*FPS)//2:
                frame.save(BUILD/f"review_{i}.jpg")
            process.stdin.write(frame.tobytes())
        elapsed+=durations[i]
        print(f"Rendered scene {i+1}/8",flush=True)
    process.stdin.close()
    if process.wait(): raise RuntimeError("Encoding failed")
    (BUILD/"metadata.json").write_text(json.dumps({"duration_seconds":total,"scene_durations":durations,"output":str(OUT)},indent=2))
    print(f"Completed {total:.2f}s: {OUT}")

if __name__ == "__main__":
    main()
