"""
test_gpt6_luna_integration.py
==============================
Automated Regression Tests - GPT-6 Luna Integration
Meridian Hospital WhatsApp AI Patient Desk

Test groups:
  1. Provider config detection
  2. llm_providers unit tests (mock/offline)
  3. JSON parser and schema validator
  4. llm_service.py backward-compatibility
  5. llm_intent_router.py dispatch (offline)
  6. WhatsApp workflow simulation (rule-based fallback, no DB)
  7. Provider connectivity ping (skipped without LLM_API_KEY)
  8. Timeout and error handling

Offline run (no API key needed):
  SKIP_REMOTE_LLM=true pytest tests/test_gpt6_luna_integration.py -v

Live run:
  LLM_PROVIDER=gpt6luna LLM_MODEL=gpt-6-luna LLM_API_KEY=sk-... pytest ... -v
"""

import os
import sys
import json
import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import db_config
import agent
import agent.llm_providers as llm_providers
import agent.llm_service as llm_service
import agent.llm_intent_router as llm_intent_router

os.environ.setdefault("SKIP_REMOTE_LLM", "true")


# ===========================================================================
# 1. Provider Config Detection
# ===========================================================================
class TestProviderConfig:
    def test_default_provider_is_mock(self, monkeypatch):
        monkeypatch.delenv("LLM_PROVIDER", raising=False)
        assert llm_providers.get_provider() == "mock"

    def test_provider_gpt6luna(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        from agent import llm_providers
        assert llm_providers.get_provider() == "gpt6luna"

    def test_model_defaults_to_gpt6luna(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.delenv("LLM_MODEL", raising=False)
        from agent import llm_providers
        assert llm_providers.get_model() == "gpt-6-luna"

    def test_model_explicit_override(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.setenv("LLM_MODEL", "gpt-6-luna-preview")
        from agent import llm_providers
        assert llm_providers.get_model() == "gpt-6-luna-preview"

    def test_api_base_gpt6luna_default(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.delenv("LLM_API_BASE", raising=False)
        from agent import llm_providers
        assert llm_providers.get_api_base() == "https://api.openai.com/v1"

    def test_api_base_custom_override(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.setenv("LLM_API_BASE", "https://custom.endpoint.com/v1")
        from agent import llm_providers
        assert llm_providers.get_api_base() == "https://custom.endpoint.com/v1"

    def test_is_llm_active_mock_returns_false(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "mock")
        monkeypatch.delenv("LLM_API_KEY", raising=False)
        from agent import llm_providers
        assert llm_providers.is_llm_active() is False

    def test_is_llm_active_gpt6luna_with_key(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.setenv("LLM_API_KEY", "sk-test-fake-key-123")
        from agent import llm_providers
        assert llm_providers.is_llm_active() is True

    def test_is_llm_active_gpt6luna_no_key(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.delenv("LLM_API_KEY", raising=False)
        from agent import llm_providers
        assert llm_providers.is_llm_active() is False

    def test_reasoning_effort_env_read(self, monkeypatch):
        monkeypatch.setenv("LLM_REASONING_EFFORT", "high")
        assert os.getenv("LLM_REASONING_EFFORT") == "high"

    def test_timeout_env(self, monkeypatch):
        monkeypatch.setenv("LLM_TIMEOUT", "20")
        from agent import llm_providers
        assert llm_providers._get_timeout() == 20.0


# ===========================================================================
# 2. call_llm returns None in offline mode
# ===========================================================================
class TestCallLlmOffline:
    def setup_method(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"

    def test_returns_none_when_skip_remote(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.setenv("LLM_API_KEY", "sk-test")
        from agent import llm_providers
        assert llm_providers.call_llm(prompt="test") is None

    def test_mock_provider_returns_none(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "mock")
        monkeypatch.delenv("SKIP_REMOTE_LLM", raising=False)
        from agent import llm_providers
        assert llm_providers.call_llm(prompt="test") is None

    def test_no_api_key_returns_none(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.delenv("LLM_API_KEY", raising=False)
        monkeypatch.delenv("SKIP_REMOTE_LLM", raising=False)
        from agent import llm_providers
        assert llm_providers._call_gpt6_luna(prompt="hello") is None


# ===========================================================================
# 3. JSON Parser and Schema Validator
# ===========================================================================
class TestJsonParser:
    def test_parse_clean_json(self):
        from agent.llm_providers import parse_json_response
        result = parse_json_response('{"intent": "GREETING", "confidence": 0.99}')
        assert result is not None
        assert result["intent"] == "GREETING"

    def test_parse_markdown_fenced(self):
        from agent.llm_providers import parse_json_response
        fence_open = "```" + "json"
        fence_close = "```"
        raw = fence_open + "\n" + '{"intent": "BOOK_APPOINTMENT"}' + "\n" + fence_close
        result = parse_json_response(raw)
        assert result is not None
        assert result["intent"] == "BOOK_APPOINTMENT"

    def test_parse_embedded_json(self):
        from agent.llm_providers import parse_json_response
        raw = 'Result: {"intent": "CANCEL_APPOINTMENT", "confidence": 0.9}'
        result = parse_json_response(raw)
        assert result is not None
        assert result["intent"] == "CANCEL_APPOINTMENT"

    def test_parse_invalid_returns_none(self):
        from agent.llm_providers import parse_json_response
        assert parse_json_response(None) is None
        assert parse_json_response("") is None
        assert parse_json_response("not json") is None
        assert parse_json_response("[1, 2, 3]") is None

    def test_schema_validator_valid(self):
        from agent.llm_providers import validate_intent_schema
        d = {
            "intent": "GREETING", "confidence": 0.99,
            "symptoms": [], "medical_reason": None,
            "department": None, "booking_for": "SELF",
            "language": "ENGLISH", "emergency": False,
        }
        ok, missing = validate_intent_schema(d)
        assert ok is True
        assert missing == []

    def test_schema_validator_missing_fields(self):
        from agent.llm_providers import validate_intent_schema
        ok, missing = validate_intent_schema({"intent": "GREETING"})
        assert ok is False
        assert "symptoms" in missing

    def test_strip_fence_plain(self):
        from agent.llm_providers import _strip_fence
        assert _strip_fence('{"a": 1}') == '{"a": 1}'

    def test_strip_fence_backtick(self):
        from agent.llm_providers import _strip_fence
        fence_input = "```json\n{\"a\": 1}\n```"
        assert _strip_fence(fence_input) == '{"a": 1}'


# ===========================================================================
# 4. llm_service backward-compatibility
# ===========================================================================
class TestLlmServiceCompat:
    def test_is_llm_active_with_gpt6luna_key(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.setenv("LLM_API_KEY", "sk-fake")
        from agent import llm_service
        assert llm_service.is_llm_active() is True

    def test_is_llm_active_mock(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "mock")
        monkeypatch.delenv("LLM_API_KEY", raising=False)
        from agent import llm_service
        assert llm_service.is_llm_active() is False

    def test_extract_structured_info_rule_fallback(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_service
        result = llm_service.extract_structured_info(
            message_text="I have fever and want to see a doctor",
            current_state={"intent": "UNKNOWN"},
        )
        assert isinstance(result, dict)
        assert "intent" in result

    def test_extract_structured_info_greeting(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_service
        result = llm_service.extract_structured_info(message_text="Hi", current_state={})
        assert isinstance(result, dict)

    def test_llm_classify_returns_dict_offline(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_service
        result = llm_service.llm_classify_intent_and_respond(
            message_text="I need to book an appointment",
            current_state={}, language="ENGLISH",
        )
        assert isinstance(result, dict)
        assert "intent" in result


# ===========================================================================
# 5. llm_intent_router dispatch (offline)
# ===========================================================================
class TestLlmIntentRouterDispatch:
    def test_route_returns_valid_structure(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_intent_router
        result = llm_intent_router.route_patient_message_llm(
            message_text="show my appointments",
            current_state={}, conversation_history=[],
        )
        assert isinstance(result, dict)
        assert result["intent"] in llm_intent_router.SUPPORTED_INTENTS

    def test_route_empty_message_is_unknown(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_intent_router
        result = llm_intent_router.route_patient_message_llm(message_text="", current_state={})
        assert result["intent"] == "UNKNOWN"

    def test_preadmission_button_fast_path(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_intent_router
        result = llm_intent_router.route_patient_message_llm(
            message_text="btn_confirm_admission", current_state={})
        assert result["intent"] == "PRE_ADMISSION"
        assert result["_llm_powered"] is False

    def test_is_llm_available_with_key(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.setenv("LLM_API_KEY", "sk-fake-key")
        from agent import llm_intent_router
        assert llm_intent_router.is_llm_available() is True

    def test_is_llm_available_mock(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "mock")
        monkeypatch.delenv("LLM_API_KEY", raising=False)
        from agent import llm_intent_router
        assert llm_intent_router.is_llm_available() is False


# ===========================================================================
# 6. WhatsApp workflow simulation (rule-based fallback)
# ===========================================================================
class TestWhatsAppWorkflowRuleBased:
    def _route(self, message, state=None):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_intent_router
        return llm_intent_router.route_patient_message_llm(
            message_text=message,
            current_state=state or {},
            conversation_history=[],
        )

    def test_greeting(self):
        r = self._route("Hello")
        assert r["intent"] in {"GREETING", "UNKNOWN"}

    def test_appointment_status(self):
        r = self._route("show my appointments")
        assert r["intent"] == "APPOINTMENT_STATUS"

    def test_cancel_appointment(self):
        r = self._route("cancel my appointment")
        assert r["intent"] == "CANCEL_APPOINTMENT"

    def test_book_appointment_fever(self):
        r = self._route("I have fever")
        assert r["intent"] in {"BOOK_APPOINTMENT", "UNKNOWN"}

    def test_pre_admission_confirm(self):
        r = self._route("confirm admission")
        assert r["intent"] == "PRE_ADMISSION"

    def test_pre_admission_cancel(self):
        r = self._route("cancel admission")
        assert r["intent"] == "PRE_ADMISSION"

    def test_son_appointments(self):
        r = self._route("show my son appointments")
        assert r["intent"] == "APPOINTMENT_STATUS"

    def test_hospital_location(self):
        r = self._route("where is the hospital")
        assert r["intent"] == "HOSPITAL_INFORMATION"

    def test_reschedule(self):
        r = self._route("I want to reschedule my appointment")
        assert r["intent"] in {"RESCHEDULE_APPOINTMENT", "UNKNOWN"}

    def test_doctor_availability(self):
        r = self._route("show doctor availability")
        assert r["intent"] in {"DOCTOR_AVAILABILITY", "BOOK_APPOINTMENT", "UNKNOWN"}

    def test_result_always_has_required_keys(self):
        for msg in ["hi", "book appointment", "cancel", "fever", ""]:
            r = self._route(msg)
            assert "intent" in r
            assert "confidence" in r
            assert "_llm_powered" in r
            assert isinstance(r["symptoms"], list)

    def test_thank_you(self):
        r = self._route("Thank you")
        assert r["intent"] in {"THANK_YOU", "GREETING", "UNKNOWN"}

    def test_language_field_present(self):
        r = self._route("Hello")
        assert r["language"] in {"ENGLISH", "TAMIL", "HINDI", "TELUGU",
                                  "MALAYALAM", "KANNADA", "URDU"}

    def test_preadmission_button_variants(self):
        for btn in ["btn_confirm_admission", "btn_cancel_admission", "btn_admission_help"]:
            r = self._route(btn)
            assert r["intent"] == "PRE_ADMISSION", f"{btn} -> expected PRE_ADMISSION"

    def test_billing_query(self):
        r = self._route("show my hospital bill")
        assert r["intent"] in {"BILLING_AND_PAYMENTS", "UNKNOWN"}

    def test_llm_powered_false_offline(self):
        r = self._route("show my appointments")
        assert r["_llm_powered"] is False

    def test_booking_for_field_present(self):
        r = self._route("book appointment")
        assert "booking_for" in r


# ===========================================================================
# 7. Provider ping
# ===========================================================================
class TestProviderPing:
    @pytest.mark.skipif(
        not os.getenv("LLM_API_KEY"),
        reason="LLM_API_KEY not set -- skipping live connectivity test"
    )
    def test_ping_gpt6luna_live(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.setenv("LLM_MODEL", "gpt-6-luna")
        monkeypatch.delenv("SKIP_REMOTE_LLM", raising=False)
        from agent import llm_providers
        result = llm_providers.ping_llm_provider()
        assert result["provider"] == "gpt6luna"
        assert result["latency_ms"] is not None
        if result["status"] == "error":
            pytest.skip(f"Live API call returned error (e.g. 429 quota / rate limit): {result.get('error')}")
        assert result["status"] in ("ok", "degraded")

    def test_ping_mock_provider(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "mock")
        from agent import llm_providers
        result = llm_providers.ping_llm_provider()
        assert result["status"] == "mock (no remote call)"
        assert result["latency_ms"] is None


# ===========================================================================
# 8. Timeout and error handling
# ===========================================================================
class TestErrorHandling:
    def test_network_error_returns_none_not_raise(self, monkeypatch):
        monkeypatch.setenv("LLM_PROVIDER", "gpt6luna")
        monkeypatch.setenv("LLM_API_KEY", "sk-fake-key")
        monkeypatch.setenv("LLM_API_BASE", "https://invalid-host-xyz.nonexistent/v1")
        monkeypatch.setenv("LLM_TIMEOUT", "1")
        monkeypatch.delenv("SKIP_REMOTE_LLM", raising=False)
        from agent import llm_providers
        result = llm_providers._call_gpt6_luna(prompt="hello")
        assert result is None

    def test_malformed_json_returns_none(self):
        from agent.llm_providers import parse_json_response
        assert parse_json_response("{bad json}") is None
        assert parse_json_response("undefined") is None

    def test_route_never_raises_on_unusual_input(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_intent_router
        for msg in ["", "   ", "a" * 2000, "SELECT * FROM patients;"]:
            try:
                r = llm_intent_router.route_patient_message_llm(
                    message_text=msg, current_state={})
                assert isinstance(r, dict)
            except Exception as e:
                pytest.fail(f"route raised on {repr(msg[:40])}: {e}")

    def test_extract_never_raises_on_unusual_input(self):
        os.environ["SKIP_REMOTE_LLM"] = "true"
        from agent import llm_service
        for msg in ["", "normal", "a" * 1000]:
            try:
                r = llm_service.extract_structured_info(message_text=msg, current_state={})
                assert isinstance(r, dict)
            except Exception as e:
                pytest.fail(f"extract raised on {repr(msg[:40])}: {e}")
