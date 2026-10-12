"""
tests/test_tools.py
===================
Validates tool execution endpoints: appointment lookup, appointment booking,
ticket creation, and administrative telemetry.
"""

import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)


def test_appointment_lookup_dr_anand():
    payload = {
        "doctor_name": "Dr. Anand",
        "department": "Orthopedics"
    }
    response = client.post("/tools/appointment-lookup", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["tool"] == "appointment_lookup"
    results = data["data"]["results"]
    assert len(results) > 0
    assert results[0]["doctor_name"] == "Dr. Anand"
    assert results[0]["room_number"] == "Room 108"
    assert results[0]["open_tokens_today"] == 3


def test_appointment_lookup_all_doctors():
    response = client.post("/tools/appointment-lookup", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["count"] >= 3


def test_appointment_booking_success():
    payload = {
        "patient_phone": "9876543210",
        "patient_name": "Ramesh Kumar",
        "doctor_name": "Dr. Anand",
        "preferred_time": "11:00 AM",
        "reason_for_visit": "Knee pain for mother"
    }
    response = client.post("/tools/appointment-book", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    booking = data["data"]
    assert booking["success"] is True
    assert booking["doctor_name"] == "Dr. Anand"
    assert booking["room_number"] == "Room 108"
    assert booking["token_number"] == 14
    assert "BK-" in booking["booking_id"]
    assert "முன்பதிவு செய்யப்பட்டது" in booking["confirmation_message_ta"]


def test_appointment_booking_missing_required_fields():
    # Missing required patient_phone
    response = client.post("/tools/appointment-book", json={"doctor_name": "Dr. Anand"})
    assert response.status_code == 422


def test_create_ticket_success():
    payload = {
        "caller_phone": "9840123456",
        "category": "BILLING",
        "subject": "Discrepancy in lab test charges",
        "details": "Caller states they were charged twice for CBC test on invoice #4421.",
        "priority": "HIGH"
    }
    response = client.post("/tools/create-ticket", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    ticket = data["data"]
    assert "TKT-" in ticket["ticket_id"]
    assert ticket["status"] == "OPEN"
    assert ticket["priority"] == "HIGH"
    assert ticket["sla_hours"] == 24


def test_telephony_reporting_dashboard():
    response = client.get("/reporting/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "total_calls" in data
    assert "ai_resolved_percentage" in data
    assert "language_distribution" in data
    assert "sentiment_distribution" in data
    assert isinstance(data["recent_logs"], list)
