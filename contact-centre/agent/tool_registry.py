"""
agent/tool_registry.py
======================
Approved tool definitions, parameter schemas, and dispatcher for the
Contact Centre Voice Agent.
"""

from typing import Dict, Any, List, Optional
import json


class ToolRegistry:
    """Registry of sanctioned tools that the voice agent can invoke."""

    TOOLS_SCHEMA: List[Dict[str, Any]] = [
        {
            "name": "appointment_lookup",
            "description": "Look up doctor consultation schedules, open token availability, and clinic room numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doctor_name": {
                        "type": "string",
                        "description": "Name or surname of the doctor (e.g. Dr. Anand, Dr. Priya)"
                    },
                    "department": {
                        "type": "string",
                        "description": "Medical specialty (e.g. Orthopedics, Cardiology, General Medicine)"
                    },
                    "date": {
                        "type": "string",
                        "description": "Target date in YYYY-MM-DD format (or 'today', 'tomorrow')"
                    }
                },
                "required": []
            }
        },
        {
            "name": "appointment_book",
            "description": "Reserve an outpatient appointment token for a caller.",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_phone": {
                        "type": "string",
                        "description": "10-digit mobile number of patient"
                    },
                    "patient_name": {
                        "type": "string",
                        "description": "Full name of the patient"
                    },
                    "doctor_name": {
                        "type": "string",
                        "description": "Name of the consulting doctor"
                    },
                    "preferred_time": {
                        "type": "string",
                        "description": "Preferred slot time (e.g. 10:30 AM)"
                    },
                    "reason_for_visit": {
                        "type": "string",
                        "description": "Brief chief complaint (e.g. knee pain, routine follow-up)"
                    }
                },
                "required": ["patient_phone", "doctor_name"]
            }
        },
        {
            "name": "create_ticket",
            "description": "Create a service request or follow-up ticket when an inquiry requires offline hospital staff action.",
            "parameters": {
                "type": "object",
                "properties": {
                    "caller_phone": {
                        "type": "string",
                        "description": "Phone number to reach the caller"
                    },
                    "category": {
                        "type": "string",
                        "enum": ["BILLING", "LAB_REPORTS", "PHARMACY", "FEEDBACK", "GENERAL"],
                        "description": "Issue classification"
                    },
                    "subject": {
                        "type": "string",
                        "description": "One-line summary of the request"
                    },
                    "details": {
                        "type": "string",
                        "description": "Full context and notes transcribed from caller"
                    },
                    "priority": {
                        "type": "string",
                        "enum": ["LOW", "MEDIUM", "HIGH", "URGENT"],
                        "description": "Urgency level"
                    }
                },
                "required": ["caller_phone", "category", "subject", "details"]
            }
        },
        {
            "name": "escalate_call",
            "description": "Trigger a live SIP transfer to a human specialist, Casualty/Trauma desk, or Billing operator.",
            "parameters": {
                "type": "object",
                "properties": {
                    "destination": {
                        "type": "string",
                        "enum": ["EMERGENCY_CASUALTY", "BILLING_DESK", "HUMAN_OPERATOR"],
                        "description": "Escalation target desk"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Why the call is being transferred"
                    },
                    "caller_sentiment": {
                        "type": "string",
                        "description": "Caller state: Calm, Anxious, Frustrated, Emergency"
                    }
                },
                "required": ["destination", "reason"]
            }
        }
    ]

    @classmethod
    def get_tool_definitions(cls) -> List[Dict[str, Any]]:
        return cls.TOOLS_SCHEMA

    @classmethod
    def get_tool_names(cls) -> List[str]:
        return [t["name"] for t in cls.TOOLS_SCHEMA]
