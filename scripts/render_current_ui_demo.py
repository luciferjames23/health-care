"""Current UI showcase, with speech-boundary synchronized editorial cursor."""
import asyncio
import json
import math
import subprocess
import sys
import wave
import socket
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/".video-tools"))
import edge_tts
import aiohttp
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw
from render_ai_radiology_triage_showcase import get_font

CAP = ROOT/"scratch/current_ui_demo"
BUILD = CAP/"render"
OUT = ROOT/"docs/AI_Radiology_Current_UI_OHIF_Showcase.mp4"
FF = imageio_ffmpeg.get_ffmpeg_exe()
W,H,FPS = 1920,1080,30

# Each sentence has its own audio clip and correct UI capture.
# Cues use actual word offsets returned by the speech service, not estimates.
# Coordinates are in the unaltered captured image.
SCENES = [
 dict(file="03_worklist",title="AI RADIOLOGY TRIAGE",sub="Current product walkthrough",
      text="An integrated radiology workflow, connecting imaging orders, AI prioritization, and human review.",crop=None,cues=[]),
 dict(file="01_orders",title="01 / IMAGING ORDER",sub="Clinical context stays with the order",
      text="Start with the imaging order and its clinical indication.",crop=(215,325,1246,715),
      cues=[("order",310,530),("indication",520,557)]),
 dict(file="01_orders",title="01 / IMAGING ORDER",sub="Urgency and workflow status",
      text="The queue also shows urgency and upload status.",crop=(215,325,1246,715),
      cues=[("urgency",965,549),("status",1021,548)]),
 dict(file="02_upload",title="02 / DICOM INGESTION",sub="Patient identity and accession checks",
      text="Before upload, the system checks DICOM patient identity and accession.",crop=(220,420,1245,630),
      cues=[("DICOM",295,492),("identity",715,492),("accession",1180,492)]),
 dict(file="02_pacs",title="03 / PACS",sub="Stored studies and processing state",
      text="PACS tracks the stored study and its AI processing state.",crop=(215,355,1246,715),
      cues=[("study",420,449),("processing",1085,449)]),
 dict(file="03_worklist",title="04 / AI PRIORITIZATION",sub="High · Medium · Low",
      text="The worklist separates high, medium, and low priority studies.",crop=(215,365,1274,715),
      cues=[("high",555,401),("medium",816,401),("low",1080,401)]),
 dict(file="03_worklist",title="04 / AI PRIORITIZATION",sub="Model signals beside review status",
      text="Screening scores and localization counts remain visible beside review status.",crop=(215,365,1274,715),
      cues=[("Screening",770,553),("localization",880,553),("review",1178,553)]),
 dict(file="04_analysis",title="05 / STUDY ANALYSIS",sub="Original radiograph + localization overlay",
      text="Opening a study shows the original radiograph beside the AI localization overlay.",crop=(220,185,1245,715),
      cues=[("original",385,522),("overlay",686,522)]),
 dict(file="04_analysis",title="05 / STUDY ANALYSIS",sub="Visible evidence for human review",
      text="The screening score and suspected regions support radiologist review.",crop=(220,330,1245,715),
      cues=[("score",1171,359),("regions",638,525)]),
 dict(file="05_ohif",title="06 / OHIF DICOM VIEWER",sub="The same source study, opened in OHIF",
      text="The original DICOM opens in OHIF for image review.",crop=None,
      cues=[("DICOM",749,382),("OHIF",115,23)]),
 dict(file="05_ohif_zoomtool",title="06 / OHIF DICOM VIEWER",sub="Native image review tools",
      text="Zoom brings the image into focus, alongside pan and window level controls.",crop=None,
      cues=[("Zoom",508,24),("image",780,420),("focus",780,470),("pan",552,24),("window",640,24)],zoom=True),
 dict(file="06_review",title="07 / RADIOLOGIST REVIEW",sub="The radiologist owns the final interpretation",
      text="The radiologist can confirm the finding or edit the report.",crop=(866,333,1246,710),
      cues=[("confirm",935,642),("edit",928,676)]),
 dict(file="06_review",title="07 / RADIOLOGIST REVIEW",sub="Reviewer and timestamp recorded",
      text="The confirmed report records the reviewer and timestamp.",crop=(866,333,1246,710),
      cues=[("report",1042,536),("reviewer",1040,392),("timestamp",1050,413)]),
 dict(file="07_discussion",title="08 / CONNECTED FOLLOW-UP",sub="Discussion linked to the original study",
      text="Report discussions keep follow-up linked to the same study.",crop=(0,0,1035,675),
      cues=[("discussions",194,39),("study",277,114)]),
 dict(file="04_analysis",title="ENGINEERED END TO END",sub="Clinical workflow · Imaging · AI · Human oversight",
      text="A connected prototype demonstrating clinical workflow, imaging integration, applied AI, and accountable human oversight.",crop=(220,185,1245,715),cues=[]),
]

async def make_audio():
    for i,s in enumerate(SCENES):
        mp3=BUILD/f"{i:02}.mp3"; meta=BUILD/f"{i:02}.json"
        if not mp3.exists() or not meta.exists() or mp3.stat().st_size<1000:
            for attempt in range(4):
                try:
                    words=[]
                    connector=aiohttp.TCPConnector(family=socket.AF_INET)
                    voice=edge_tts.Communicate(s["text"],"en-US-AndrewNeural",rate="+5%",boundary="WordBoundary",connector=connector)
                    with mp3.open("wb") as out:
                        async for item in voice.stream():
                            if item["type"]=="audio": out.write(item["data"])
                            elif item["type"]=="WordBoundary":
                                words.append(dict(text=item["text"],start=item["offset"]/1e7,end=(item["offset"]+item["duration"])/1e7))
                    meta.write_text(json.dumps(words,indent=2))
                    break
                except Exception:
                    if attempt==3: raise
        print(f"Voice {i+1}/{len(SCENES)}",flush=True)

def run(args):
    subprocess.run([FF,"-hide_banner","-loglevel","error","-y"]+args,check=True)

def word_time(words,text):
    return next(w["start"] for w in words if w["text"].strip(".,;:!?").lower()==text.lower())

def cursor(frame,points,t,box,crop,scale):
    if not points: return
    # Arrive just before the spoken target word, then hold until the next cue.
    px,py=points[0][1:]
    for i,(arrival,tx,ty) in enumerate(points[1:],1):
        depart=max(points[i-1][0],arrival-.45)
        if t<depart: break
        if t<arrival:
            u=(t-depart)/max(.001,arrival-depart); u=u*u*(3-2*u)
            px=points[i-1][1]+(tx-points[i-1][1])*u
            py=points[i-1][2]+(ty-points[i-1][2])*u
            break
        px,py=tx,ty
    px=box[0]+(px-crop[0])*scale; py=box[1]+(py-crop[1])*scale
    overlay=Image.new("RGBA",frame.size)
    d=ImageDraw.Draw(overlay)
    d.ellipse((px-23,py-23,px+23,py+23),fill=(52,218,191,35),outline=(52,218,191,140),width=2)
    pts=[(px+a,py+b) for a,b in [(0,0),(0,30),(8,23),(15,38),(21,35),(14,21),(24,21)]]
    d.polygon(pts,fill="white");d.line(pts+[pts[0]],fill="#132b3b",width=2)
    frame.paste(overlay,(0,0),overlay)

def timecode(t):
    ms=round(t*1000)
    return f"{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}"

def main():
    BUILD.mkdir(parents=True,exist_ok=True)
    asyncio.run(make_audio())
    segments=[]; durations=[]; boundaries=[]
    for i,s in enumerate(SCENES):
        run(["-i",str(BUILD/f"{i:02}.mp3"),"-ar","48000","-ac","1",str(BUILD/f"{i:02}.wav")])
        with wave.open(str(BUILD/f"{i:02}.wav")) as f:
            a=np.frombuffer(f.readframes(f.getnframes()),dtype=np.int16)
        a=np.concatenate([np.zeros(9600,dtype=np.int16),a,np.zeros(9600,dtype=np.int16)])
        duration=math.ceil(len(a)/48000*FPS)/FPS
        segments.append(np.pad(a,(0,round(duration*48000)-len(a))))
        durations.append(duration)
        boundaries.append(json.loads((BUILD/f"{i:02}.json").read_text()))
    with wave.open(str(BUILD/"voice.wav"),"wb") as f:
        f.setparams((1,2,48000,0,"NONE","not compressed"));f.writeframes(np.concatenate(segments).tobytes())
    p=subprocess.Popen([FF,"-hide_banner","-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24",
         "-s",f"{W}x{H}","-r",str(FPS),"-i","-","-i",str(BUILD/"voice.wav"),
         "-c:v","libx264","-preset","fast","-crf","17","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k",
         "-movflags","+faststart",str(OUT)],stdin=subprocess.PIPE)
    elapsed=0; total=sum(durations); subtitles=[]; timing=[]
    for i,s in enumerate(SCENES):
        shot=Image.open(CAP/(s["file"]+".png")).convert("RGB")
        crop=s["crop"] or (0,0,shot.width,shot.height)
        cut=shot.crop(crop)
        scale=min(1800/cut.width,780/cut.height)
        size=(round(cut.width*scale),round(cut.height*scale))
        view=cut.resize(size,Image.Resampling.LANCZOS)
        x=(W-size[0])//2;y=150+(780-size[1])//2
        if s.get("rules"): y=162
        points=[(.2+max(0,word_time(boundaries[i],word)-.08),xx,yy) for word,xx,yy in s["cues"]]
        # Word-timed subtitle groups preserve the spoken sequence.
        groups=[boundaries[i][j:j+9] for j in range(0,len(boundaries[i]),9)]
        for group in groups:
            subtitles.append((elapsed+.2+group[0]["start"],elapsed+.2+group[-1]["end"]," ".join(w["text"] for w in group)))
        base=Image.new("RGB",(W,H),"#091522");d=ImageDraw.Draw(base)
        d.text((60,24),"MERIDIAN  /  AI RADIOLOGY",font=get_font(20,True),fill="#66dcc6")
        d.text((60,61),s["title"],font=get_font(36,True),fill="white")
        d.text((60,108),s["sub"],font=get_font(23),fill="#b8c9d7")
        base.paste(view,(x,y))
        zoomview=None
        if s.get("zoom"):
            zoomview=Image.open(CAP/"05_ohif_zoomed.png").convert("RGB").resize(size,Image.Resampling.LANCZOS)
        frames=round(durations[i]*FPS)
        for n in range(frames):
            local=n/FPS;t=elapsed+local;frame=base.copy()
            if zoomview is not None and local>=.2+word_time(boundaries[i],"focus"):
                frame.paste(zoomview,(x,y))
            cursor(frame,points,local,(x,y),crop,scale)
            d=ImageDraw.Draw(frame)
            if s.get("rules"):
                # Editorial explanation of the verified configuration; the
                # product summary above remains the actual captured UI.
                cards=[
                    (60,"DenseNet121 · screening","Positive: probability ≥ 20%"),
                    (980,"YOLO11n · localization","Positive: ≥ 1 opacity region at confidence ≥ 10%"),
                ]
                for cx,heading,detail in cards:
                    d.rounded_rectangle((cx,340,cx+880,460),radius=16,fill="#142c3e",outline="#36536a",width=2)
                    d.text((cx+24,358),heading,font=get_font(29,True),fill="#70e0cd")
                    d.text((cx+24,406),detail,font=get_font(25),fill="white")
                rows=[
                    ("Both models positive","Opacity flagged by both","HIGH PRIORITY","#fa8d91","high"),
                    ("Exactly one model positive","Either model flags opacity","MEDIUM PRIORITY","#f0c56a","medium"),
                    ("Neither model positive","No opacity flagged by either","LOW PRIORITY","#69d2b6","low"),
                ]
                active=-1
                for ri,row in enumerate(rows):
                    if local>=.2+word_time(boundaries[i],row[4])-.1:active=ri
                for ri,(rule,detail,label,color,_) in enumerate(rows):
                    yy=490+ri*124; selected=ri==active
                    d.rounded_rectangle((60,yy,1860,yy+108),radius=14,fill="#17394a" if selected else "#102334",outline=color if selected else "#294457",width=3 if selected else 1)
                    d.text((85,yy+16),rule,font=get_font(29,True),fill="white")
                    d.text((85,yy+61),detail,font=get_font(23),fill="#b5c8d6")
                    d.text((1400,yy+33),label,font=get_font(28,True),fill=color)
                d.text((65,890),"Low priority means neither model flagged opacity at these thresholds; radiologist review still applies.",font=get_font(22),fill="#b5c8d6")
            caption=next((c for a,b,c in subtitles if a<=t<=b),"")
            bounds=d.textbbox((0,0),caption,font=get_font(29))
            d.text(((W-bounds[2])/2,962),caption,font=get_font(29),fill="white")
            d.text((60,1032),"CURRENT UI CAPTURES  •  GUIDED WALKTHROUGH",font=get_font(16),fill="#8ba3b7")
            d.text((1550,1032),"PROTOTYPE DEMONSTRATION",font=get_font(16),fill="#8ba3b7")
            d.rectangle((0,1075,W*t/total,1080),fill="#5dd8bf")
            if n==frames//2:frame.save(BUILD/f"frame_{i:02}.jpg")
            p.stdin.write(frame.tobytes())
        timing.append(dict(scene=i,title=s["title"],start=elapsed,duration=durations[i],cues=points,source=s["file"]))
        elapsed+=durations[i]
        print(f"Scene {i+1}/{len(SCENES)}",flush=True)
    p.stdin.close()
    if p.wait():raise RuntimeError("Video encoding failed")
    OUT.with_suffix(".srt").write_text("\n\n".join(f"{i+1}\n{timecode(a)} --> {timecode(b)}\n{c}" for i,(a,b,c) in enumerate(subtitles)),encoding="utf-8")
    OUT.with_suffix(".txt").write_text("\n\n".join(s["title"]+"\n"+s["text"] for s in SCENES),encoding="utf-8")
    (BUILD/"timeline.json").write_text(json.dumps(timing,indent=2))
    print(f"Complete: {total:.2f}s; {OUT}",flush=True)

if __name__=="__main__":main()
