"""
tests/test_workflows.py
========================
Validates verification, routing, and escalation workflows under normal,
failed, and boundary scenarios.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from voice.session_manager import session_manager
from workflows.verification import CallerVerificationWorkflow
from workflows.routing import CallRoutingWorkflow
from workflows.escalation import EscalationWorkflow


def test_verification_workflow_clean_phone():
    assert CallerVerificationWorkflow.sanitize_phone("+91 98765-43210") == "9876543210"
    assert CallerVerificationWorkflow.sanitize_phone("09876543210") == "9876543210"
    assert CallerVerificationWorkflow.sanitize_phone("9876543210") == "9876543210"


def test_verification_workflow_matched_patient():
    session = session_manager.create_session("CALL-WF-1", "9876543210")
    res = CallerVerificationWorkflow.verify_caller("CALL-WF-1", "+91 98765 43210")
    assert res["verified"] is True
    assert res["is_existing_patient"] is True
    assert res["patient_name"] == "Ramesh Kumar"
    assert session_manager.get_session("CALL-WF-1").is_verified is True


def test_routing_workflow_emergency_detection_tamil():
    session_manager.create_session("CALL-WF-2", "9888888888")
    tamil_emergency = "ஐயா என் அப்பாவுக்கு கடுமையான நெஞ்சு வலி மயக்கம் வந்துடுச்சு உடனே உதவி வேணும்"
    route = CallRoutingWorkflow.determine_route("CALL-WF-2", tamil_emergency)
    assert route["route"] == "EMERGENCY_ESCALATION"
    assert route["intent"] == "EMERGENCY"
    assert route["requires_immediate_transfer"] is True
    assert route["transfer_target"] == "EMERGENCY_CASUALTY"


def test_routing_workflow_emergency_detection_english():
    session_manager.create_session("CALL-WF-3", "9888888889")
    route = CallRoutingWorkflow.determine_route("CALL-WF-3", "My mother is having severe chest pain and collapsed!")
    assert route["route"] == "EMERGENCY_ESCALATION"
    assert route["requires_immediate_transfer"] is True


def test_routing_workflow_frustration_escalation():
    session_manager.create_session("CALL-WF-4", "9888888890")
    route = CallRoutingWorkflow.determine_route("CALL-WF-4", "This is useless and stupid! Nobody answered my complaint!")
    assert route["route"] == "HUMAN_ESCALATION"
    assert route["sentiment"] == "Frustrated"
    assert route["transfer_target"] == "HUMAN_OPERATOR"


def test_routing_workflow_doctor_inquiry():
    session_manager.create_session("CALL-WF-5", "9888888891")
    route = CallRoutingWorkflow.determine_route("CALL-WF-5", "Is Dr. Anand available today for clinic timing?")
    assert route["route"] == "APPOINTMENT_LOOKUP"
    assert route["requires_immediate_transfer"] is False


def test_escalation_execution_emergency_casualty():
    session_manager.create_session("CALL-WF-6", "9876543210", language="ta-IN")
    escalation = EscalationWorkflow.execute_escalation(
        call_id="CALL-WF-6",
        target_desk="EMERGENCY_CASUALTY",
        reason="Acute chest pain reported",
        sentiment="Anxious"
    )
    assert escalation["status"] == "escalated"
    assert escalation["priority"] == "URGENT_EMERGENCY"
    assert "அவசர சிகிச்சைப் பிரிவிற்கு" in escalation["spoken_announcement"]
    assert "casualty-desk" in escalation["sip_destination_uri"]
