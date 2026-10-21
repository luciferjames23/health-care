import asyncio
import os
import subprocess
import edge_tts

VOICE = 'en-US-AndrewMultilingualNeural'

SEGMENTS = [
    {
        "id": "desk_seg1",
        "start": 0.5,
        "text": "Welcome to the Hospital Discharge Command Centre, orchestrating live patient readiness across hospital queues.",
    },
    {
        "id": "desk_seg2",
        "start": 6.8,
        "text": "Selecting an inpatient case opens the live dependency graph and AI discharge draft. With ninety-seven percent clinical groundedness, the agent compiles vitals, labs, and medications for physician review.",
    },
    {
        "id": "desk_seg3",
        "start": 21.0,
        "text": "The attending doctor validates the clinical notes, confirms clearances, and clicks Sign and Release. All human approvals are recorded, and the bed is immediately released.",
    },
    {
        "id": "desk_seg4",
        "start": 35.0,
        "text": "The verified discharge summary and bilingual patient instructions are instantly generated for print and EHR sync—reducing discharge delays from hours to minutes.",
    }
]

async def generate_segments():
    os.makedirs("scratch/desk_audio", exist_ok=True)
    for seg in SEGMENTS:
        out_f = f"scratch/desk_audio/{seg['id']}.mp3"
        comm = edge_tts.Communicate(seg['text'], VOICE, rate="+4%")
        await comm.save(out_f)
        res = subprocess.run(
            ["ffprobe", "-i", out_f, "-show_entries", "format=duration", "-v", "quiet", "-of", "csv=p=0"],
            capture_output=True, text=True
        )
        dur = float(res.stdout.strip() or 0)
        seg['file'] = out_f
        seg['duration'] = dur
        end_time = seg['start'] + dur
        print(f"{seg['id']}: {dur:.2f}s (starts {seg['start']}s -> ends {end_time:.2f}s)")

def mix_to_duration(target_duration=47.93):
    inputs = []
    filter_delays = []
    amix_inputs = []
    for idx, s in enumerate(SEGMENTS):
        inputs.extend(["-i", s['file']])
        delay_ms = int(s['start'] * 1000)
        filter_delays.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms}[a{idx}]")
        amix_inputs.append(f"[a{idx}]")
        
    filter_complex = ";".join(filter_delays) + ";" + "".join(amix_inputs) + f"amix=inputs={len(SEGMENTS)}:duration=longest:dropout_transition=2,apad=whole_dur={target_duration}[outa]"
    
    out_master = "scratch/desk_voiceover_48s.mp3"
    cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_complex, "-map", "[outa]", "-t", str(target_duration), out_master]
    print("Mixing desk-only voiceover track...")
    subprocess.run(cmd, check=True)
    print("Master audio ready at:", out_master)

if __name__ == "__main__":
    asyncio.run(generate_segments())
    mix_to_duration(47.93)
