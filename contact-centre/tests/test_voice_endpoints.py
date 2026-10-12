"""
tests/test_voice_endpoints.py
==============================
Validates incoming call webhooks, call status processing, and security.
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

# Put contact-centre root in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from voice.session_manager import session_manager

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "AG-12 Contact Centre" in data["service"]


def test_incoming_call_success_tamil():
    payload = {
        "call_id": "CALL-TEST-001",
        "caller_number": "9876543210",
        "trunk_id": "TRUNK-IND-TN-044",
        "language": "ta-IN"
    }
    response = client.post("/webhooks/voice/incoming", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["call_id"] == "CALL-TEST-001"
    assert "வணக்கம்" in data["greeting_text"]
    assert data["caller_verification"]["verified"] is True
    assert data["caller_verification"]["patient_name"] == "Ramesh Kumar"


def test_incoming_call_success_english():
    payload = {
        "call_id": "CALL-TEST-002",
        "caller_number": "8765432109",
        "trunk_id": "TRUNK-IND-TN-044",
        "language": "en-IN"
    }
    response = client.post("/webhooks/voice/incoming", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert "Welcome" in data["greeting_text"]
    assert data["caller_verification"]["patient_name"] == "Anitha Nair"


def test_incoming_call_unregistered_caller():
    payload = {
        "call_id": "CALL-TEST-003",
        "caller_number": "9999900000",
        "trunk_id": "TRUNK-IND-TN-044",
        "language": "ta-IN"
    }
    response = client.post("/webhooks/voice/incoming", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["caller_verification"]["is_existing_patient"] is False
    assert data["caller_verification"]["patient_name"] == "New Patient Caller"


def test_incoming_call_missing_parameters_validation_error():
    # Missing required caller_number field
    response = client.post("/webhooks/voice/incoming", json={"call_id": "CALL-FAIL"})
    assert response.status_code == 422


def test_call_status_update_and_completion():
    # 1. Start a call
    client.post("/webhooks/voice/incoming", json={
        "call_id": "CALL-TEST-004",
        "caller_number": "9840123456",
        "language": "ta-IN"
    })

    # 2. End the call
    status_payload = {
        "call_id": "CALL-TEST-004",
        "event": "call_ended",
        "duration_seconds": 65.5,
        "disposition": "completed_by_caller"
    }
    response = client.post("/webhooks/voice/status", json=status_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "updated"
    assert data["call_status"] == "completed"
    assert data["duration_seconds"] == 65.5


def test_call_status_unknown_call():
    response = client.post("/webhooks/voice/status", json={
        "call_id": "NON-EXISTENT-CALL",
        "event": "call_ended"
    })
    assert response.status_code == 200
    assert response.json()["status"] == "not_found"
