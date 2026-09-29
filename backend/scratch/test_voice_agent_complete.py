import os
import sys
import json
import time

# Set up backend path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

import db_config
db_config.load_dotenv(override=True)

from api.whatsapp_routes import process_voice_reply, get_or_create_whatsapp_session
from voice.speech_to_text import get_stt_provider, MOCK_TRANSCRIPTION_MAP

print("============================================================")
print("STARTING COMPREHENSIVE VOICE AGENT END-TO-END QA SUITE")
print("============================================================")

test_scenarios = [
    {
        "id": "TC-VOICE-ENG-001",
        "name": "English Voice: Fever & Appointment Request",
        "media_id": "english_fever",
        "phone": "+919876543210",
        "expected_intent": "BOOK_APPOINTMENT",
        "expected_dept": "General Medicine"
    },
    {
        "id": "TC-VOICE-ENG-002",
        "name": "English Voice: Doctor Query",
        "media_id": "english_doctor",
        "phone": "+919876543211",
        "expected_intent": ["BOOK_APPOINTMENT", "DOCTOR_AVAILABILITY"],
        "expected_dept": None
    },
    {
        "id": "TC-VOICE-ENG-003",
        "name": "English Voice: Hospital Timings Query",
        "media_id": "english_timing",
        "phone": "+919876543212",
        "expected_intent": "HOSPITAL_INFORMATION",
        "expected_dept": None
    },
    {
        "id": "TC-VOICE-ENG-004",
        "name": "English Voice: Cancellation Request",
        "media_id": "english_cancel",
        "phone": "+919876543213",
        "expected_intent": ["CANCEL_APPOINTMENT", "APPOINTMENT_STATUS", "MY_APPOINTMENTS"],
        "expected_dept": None
    },
    {
        "id": "TC-VOICE-TAM-001",
        "name": "Tamil Voice: Hospital Location Query",
        "media_id": "tamil_hospital",
        "phone": "+919876543214",
        "expected_intent": "HOSPITAL_INFORMATION",
        "expected_lang": "TAMIL"
    },
    {
        "id": "TC-VOICE-HIN-001",
        "name": "Hindi Voice: Fever Query",
        "media_id": "hindi_fever",
        "phone": "+919876543215",
        "expected_intent": "BOOK_APPOINTMENT",
        "expected_lang": "HINDI"
    },
    {
        "id": "TC-VOICE-TEL-001",
        "name": "Telugu Voice: Greeting & Location",
        "media_id": "telugu_where",
        "phone": "+919876543216",
        "expected_intent": "HOSPITAL_INFORMATION",
        "expected_lang": "TELUGU"
    },
    {
        "id": "TC-VOICE-MAL-001",
        "name": "Malayalam Voice: Location Query",
        "media_id": "malayalam_where",
        "phone": "+919876543217",
        "expected_intent": "HOSPITAL_INFORMATION",
        "expected_lang": "MALAYALAM"
    },
    {
        "id": "TC-VOICE-KAN-001",
        "name": "Kannada Voice: Location Query",
        "media_id": "kannada_where",
        "phone": "+919876543218",
        "expected_intent": "HOSPITAL_INFORMATION",
        "expected_lang": "KANNADA"
    },
    {
        "id": "TC-VOICE-URD-001",
        "name": "Urdu Voice: Location Query",
        "media_id": "urdu_where",
        "phone": "+919876543219",
        "expected_intent": "HOSPITAL_INFORMATION",
        "expected_lang": "URDU"
    }
]

passed = 0
failed = 0

for sc in test_scenarios:
    unique_phone = f"+919876{sc['id'].replace('-', '')[-6:]}"
    session_id = f"WA_VOICE_TEST_{sc['id']}_{int(time.time())}"
    msg_id = f"wamid_test_voice_{sc['id']}_{int(time.time())}"
    audio_data = {"id": sc["media_id"], "mime_type": "audio/ogg"}
    
    print(f"\n--- Testing {sc['id']}: {sc['name']} ---")
    res = process_voice_reply(session_id, unique_phone, msg_id, audio_data)
    
    if res and res.get("status") == "success":
        transcript = res.get("transcript", "")
        intent = res.get("intent", "")
        lang = res.get("language", "")
        response = res.get("response", "")
        
        print(f"  Transcript Extracted : '{transcript}'")
        print(f"  Detected Language    : {lang}")
        print(f"  Intent Classified    : {intent}")
        print(f"  WhatsApp Response    : {response[:100]}...")
        
        # Validate intent
        intent_match = (
            sc["expected_intent"] is None or 
            intent == sc["expected_intent"] or 
            (isinstance(sc["expected_intent"], list) and intent in sc["expected_intent"])
        )
        lang_match = ("expected_lang" not in sc or lang == sc["expected_lang"])
        
        if intent_match and lang_match:
            print(f"  ✅ {sc['id']} PASS")
            passed += 1
        else:
            print(f"  ❌ {sc['id']} FAIL - Expected intent {sc.get('expected_intent')}, got {intent}; lang {sc.get('expected_lang')}, got {lang}")
            failed += 1
    else:
        print(f"  ❌ {sc['id']} FAIL - Voice processing failed: {res}")
        failed += 1

print("\n============================================================")
print(f"VOICE AGENT QA SUMMARY: Executed={len(test_scenarios)}, Passed={passed}, Failed={failed}")
print("============================================================")
if failed > 0:
    sys.exit(1)
