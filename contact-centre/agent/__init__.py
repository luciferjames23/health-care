"""
agent package for AG-12 Contact Centre
"""
from .instructions import CONTACT_CENTRE_SYSTEM_PROMPT, INTENT_DETECTION_RULES
from .tool_registry import ToolRegistry

__all__ = ["CONTACT_CENTRE_SYSTEM_PROMPT", "INTENT_DETECTION_RULES", "ToolRegistry"]
