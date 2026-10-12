"""
tests/test_twilio_exotel.py
===========================
Tests for Twilio Voice and Exotel Cloud Telephony webhook handlers.
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)


def test_twilio_inbound_voice_returns_valid_twiml():
    form_data = {
        "CallSid": "CA-TW-TEST-001",
        "From": "+919876543210",
        "To": "+18005550199"
    }
    response = client.post("/webhooks/twilio/voice", data=form_data)
    assert response.status_code == 200
    assert "application/xml" in response.headers.get("content-type", "")
    xml_content = response.text
    assert "<Response>" in xml_content
    assert "<Gather" in xml_content
    assert "வணக்கம்" in xml_content


def test_twilio_gather_speech_appointment_inquiry():
    form_data = {
        "CallSid": "CA-TW-TEST-002",
        "From": "+919876543210",
        "SpeechResult": "டாக்டர் ஆனந்த் இன்னைக்கு இருப்பாரா டோக்கன் வேணும்",
        "Confidence": "0.95"
    }
    response = client.post("/webhooks/twilio/gather", data=form_data)
    assert response.status_code == 200
    xml_content = response.text
    assert "<Response>" in xml_content
    assert "Dr. Anand" in xml_content
    assert "108" in xml_content


def test_twilio_gather_speech_emergency_escalation():
    form_data = {
        "CallSid": "CA-TW-TEST-003",
        "From": "+919840123456",
        "SpeechResult": "ஐயா நெஞ்சு வலி தாங்க முடியல அவசரம்",
        "Confidence": "0.98"
    }
    response = client.post("/webhooks/twilio/gather", data=form_data)
    assert response.status_code == 200
    xml_content = response.text
    assert "<Dial>" in xml_content
    assert "அவசர சிகிச்சைப் பிரிவிற்கு" in xml_content


def test_twilio_status_callback():
    form_data = {
        "CallSid": "CA-TW-TEST-001",
        "CallStatus": "completed",
        "CallDuration": "45"
    }
    response = client.post("/webhooks/twilio/status", data=form_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "recorded"
    assert data["call_status"] == "completed"


def test_exotel_passthru_get():
    params = {
        "CallSid": "EXO-TEST-001",
        "From": "09876543210",
        "To": "04466669000"
    }
    response = client.get("/webhooks/exotel/passthru", params=params)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["call_sid"] == "EXO-TEST-001"
    assert data["caller_name"] == "Ramesh Kumar"
    assert "வணக்கம்" in data["greeting_text"]


def test_exotel_passthru_post():
    form_data = {
        "CallSid": "EXO-TEST-002",
        "From": "08765432109",
        "To": "04466669000"
    }
    response = client.post("/webhooks/exotel/passthru", data=form_data)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["caller_name"] == "Anitha Nair"


def test_exotel_status_callback():
    payload = {
        "CallSid": "EXO-TEST-001",
        "Status": "completed",
        "Duration": 52,
        "RecordingUrl": "https://s3.amazonaws.com/exotel-recordings/sample.mp3"
    }
    response = client.post("/webhooks/exotel/status", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "recorded"
    assert data["call_status"] == "completed"
