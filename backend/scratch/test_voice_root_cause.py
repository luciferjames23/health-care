import os
import sys
import requests
import json

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

import db_config
db_config.load_dotenv(override=True)

api_key = os.getenv("LLM_API_KEY", "")
print("LLM_API_KEY:", api_key[:10] + "..." if api_key else "MISSING")

groq_key = os.getenv("GROQ_API_KEY", "")
print("GROQ_API_KEY:", groq_key[:10] + "..." if groq_key else "MISSING")

# Test Gemini API with gemini-1.5-flash and gemini-2.0-flash
models_to_test = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-3.5-flash-lite"]

for m in models_to_test:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={api_key}"
    try:
        res = requests.post(url, json={"contents": [{"parts": [{"text": "Hello"}]}]}, timeout=5)
        print(f"Model {m}: HTTP {res.status_code} - {res.text[:100]}")
    except Exception as e:
        print(f"Model {m}: EXCEPTION {e}")

# Test Groq Whisper STT if available
if groq_key:
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {groq_key}"}
    print("Testing Groq Whisper STT...")
    import wave
    import math
    import struct

    test_wav = os.path.join(backend_dir, "scratch", "test_whisper_1s.wav")
    sample_rate = 16000
    duration = 1.0
    num_samples = int(sample_rate * duration)

    with wave.open(test_wav, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        for i in range(num_samples):
            val = int(32767.0 * 0.5 * math.sin(2.0 * math.pi * 440.0 * i / sample_rate))
            wav_file.writeframes(struct.pack('<h', val))

    print(f"Generated 1s WAV file: size={os.path.getsize(test_wav)} bytes")

    for whisper_model in ["whisper-large-v3-turbo", "whisper-large-v3"]:
        try:
            with open(test_wav, "rb") as audio_f:
                files = {"file": ("test.wav", audio_f, "audio/wav")}
                data = {"model": whisper_model, "response_format": "json"}
                res = requests.post(url, headers=headers, files=files, data=data, timeout=10)
                print(f"Groq Whisper ({whisper_model}): HTTP {res.status_code} - {res.text}")
        except Exception as e:
            print(f"Groq Whisper ({whisper_model}) EXCEPTION: {e}")

