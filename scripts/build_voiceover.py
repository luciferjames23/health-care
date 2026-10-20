import asyncio
import os
import subprocess
import edge_tts

# High quality warm, professional clinical narrator
VOICE = 'en-US-AndrewMultilingualNeural' 

SCENES = [
    {
        "id": "scene1",
        "text": "Hospital discharges often face hours of administrative delay due to fragmented notes and delayed sign-offs. Meet the Meridian AI Discharge Summary Agent.",
        "target_start": 0.5,
    },
    {
        "id": "scene2",
        "text": "With a single click, the agent ingests the complete Patient 360 record—combining real-time vitals, diagnostic lab results, clinical notes, and active medication history using clinical-grade LLMs.",
        "target_start": 12.0,
    },
    {
        "id": "scene3",
        "text": "In seconds, it synthesizes an 8-section structured discharge summary, automatically reconciling medications, flagging pending clearances, and drafting personalized recovery instructions.",
        "target_start": 26.0,
    },
    {
        "id": "scene4",
        "text": "Clinicians retain complete control to review, edit, and digitally sign off. The verified summary immediately syncs back into the hospital EHR and generates a signed discharge document.",
        "target_start": 41.5,
    },
    {
        "id": "scene5",
        "text": "Reducing discharge turnaround from hours to minutes, while safeguarding patient outcomes. Meridian Discharge Summary Agent.",
        "target_start": 53.0,
    }
]

async def generate_scene_audio():
    os.makedirs("scratch/audio", exist_ok=True)
    for s in SCENES:
        out_file = f"scratch/audio/{s['id']}.mp3"
        print(f"Generating audio for {s['id']}...")
        comm = edge_tts.Communicate(s['text'], VOICE, rate="+3%")
        await comm.save(out_file)
        # Probe duration
        res = subprocess.run(
            ["ffprobe", "-i", out_file, "-show_entries", "format=duration", "-v", "quiet", "-of", "csv=p=0"],
            capture_output=True, text=True
        )
        duration = float(res.stdout.strip() or 0)
        s['file'] = out_file
        s['duration'] = duration
        print(f"  {s['id']}: {duration:.2f}s")

def assemble_master_audio():
    # Build ffmpeg filter_complex to place each audio segment at its target timestamp
    inputs = []
    filter_delays = []
    amix_inputs = []
    for idx, s in enumerate(SCENES):
        inputs.extend(["-i", s['file']])
        delay_ms = int(s['target_start'] * 1000)
        filter_delays.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms}[a{idx}]")
        amix_inputs.append(f"[a{idx}]")
    
    filter_complex = ";".join(filter_delays) + ";" + "".join(amix_inputs) + f"amix=inputs={len(SCENES)}:duration=longest:dropout_transition=2,apad=whole_dur=60[outa]"
    
    cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_complex, "-map", "[outa]", "-t", "60", "scratch/discharge_voiceover_60s.mp3"]
    print("Running ffmpeg to mix master voiceover...")
    subprocess.run(cmd, check=True)
    print("Master 60s voiceover created at scratch/discharge_voiceover_60s.mp3")

if __name__ == "__main__":
    asyncio.run(generate_scene_audio())
    assemble_master_audio()
