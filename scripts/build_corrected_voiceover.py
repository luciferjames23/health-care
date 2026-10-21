import asyncio
import os
import subprocess
import edge_tts

VOICE = 'en-US-AndrewMultilingualNeural' # warm, authoritative, clear clinical narrator

SEGMENTS = [
    {
        "id": "seg1",
        "start": 0.8,
        "text": "Welcome to the Hospital Smart Discharge Summary Assistant—an intelligent clinical co-pilot designed to eliminate administrative discharge bottlenecks.",
    },
    {
        "id": "seg2",
        "start": 12.5,
        "text": "With role-based access control, the system ensures enterprise security and full audit compliance across hospital clinical workflows.",
    },
    {
        "id": "seg3",
        "start": 26.5,
        "text": "Upon sign-in, we open the Discharge Command Centre. Inpatients are prioritized by real-time readiness—tracking clinical clearances, pending labs, and pharmacy checks.",
    },
    {
        "id": "seg4",
        "start": 43.0,
        "text": "Opening the patient case, the agent has automatically compiled an eight-section discharge draft with ninety-seven percent groundedness, ready for clinician review.",
    },
    {
        "id": "seg5",
        "start": 57.0,
        "text": "The attending physician validates the clinical notes, reconciles medications, and signs off. The status updates immediately to Completed, clearing the bed for incoming patients.",
    },
    {
        "id": "seg6",
        "start": 71.0,
        "text": "The finalized discharge document and multilingual patient care instructions are instantly generated for print and EHR export—ensuring a safe, seamless transition home.",
    }
]

async def generate_segments():
    os.makedirs("scratch/corrected_audio", exist_ok=True)
    for seg in SEGMENTS:
        out_f = f"scratch/corrected_audio/{seg['id']}.mp3"
        comm = edge_tts.Communicate(seg['text'], VOICE, rate="+2%")
        await comm.save(out_f)
        res = subprocess.run(
            ["ffprobe", "-i", out_f, "-show_entries", "format=duration", "-v", "quiet", "-of", "csv=p=0"],
            capture_output=True, text=True
        )
        dur = float(res.stdout.strip() or 0)
        seg['file'] = out_f
        seg['duration'] = dur
        print(f"{seg['id']} ({dur:.2f}s) starts at {seg['start']}s -> ends at {seg['start'] + dur:.2f}s: {seg['text'][:40]}...")

def mix_to_target_duration(target_duration=83.54):
    inputs = []
    filter_delays = []
    amix_inputs = []
    for idx, s in enumerate(SEGMENTS):
        inputs.extend(["-i", s['file']])
        delay_ms = int(s['start'] * 1000)
        filter_delays.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms}[a{idx}]")
        amix_inputs.append(f"[a{idx}]")
        
    filter_complex = ";".join(filter_delays) + ";" + "".join(amix_inputs) + f"amix=inputs={len(SEGMENTS)}:duration=longest:dropout_transition=2,apad=whole_dur={target_duration}[outa]"
    
    out_master = "scratch/corrected_voiceover_83s.mp3"
    cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_complex, "-map", "[outa]", "-t", str(target_duration), out_master]
    print("Mixing corrected master voiceover track...")
    subprocess.run(cmd, check=True)
    print("Master audio ready at:", out_master)

if __name__ == "__main__":
    asyncio.run(generate_segments())
    mix_to_target_duration(83.54)
