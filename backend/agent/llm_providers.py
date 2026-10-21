"""
llm_providers.py
================
Centralized LLM Provider Abstraction for Meridian Hospital AI Patient Desk.

Supported providers (set via LLM_PROVIDER env-var):
  - gpt6luna  -> GPT-6 Luna (gpt-6-luna) via OpenAI Chat Completions API
  - openai    -> Any OpenAI-compatible endpoint (also used for Groq)
  - gemini    -> Google Gemini REST generateContent
  - google    -> Alias for gemini
  - mock      -> Rule-based fallback only (no remote LLM)

Environment variables consumed:
  LLM_PROVIDER          = gpt6luna | openai | gemini | google | mock
  LLM_MODEL             = gpt-6-luna | gemini-2.0-flash | gpt-4o-mini  (etc.)
  LLM_API_KEY           = provider API key
  LLM_API_BASE          = optional base URL override
  LLM_TIMEOUT           = HTTP request timeout seconds (default: 12)
  LLM_REASONING_EFFORT  = none|low|medium|high|xhigh  (GPT-6 Luna only, default: medium)

Design principles:
  - All DB writes are performed by the calling agent, NEVER by the LLM.
  - Structured JSON output validated by callers; raw strings returned here.
  - Errors propagate as None; callers fall back to deterministic rule engine.
  - API keys read from environment at call time (never cached at module load).
  - SSL verification respects REQUESTS_CA_BUNDLE env var.
"""

import os
import re
import json
import time
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_DEFAULT_TIMEOUT      = 12.0
_DEFAULT_GPT6_MODEL   = "gpt-6-luna"
_DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
_GPT6_LUNA_BASE       = "https://api.openai.com/v1"
_GEMINI_BASE          = "https://generativelanguage.googleapis.com/v1beta/models"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _get_timeout() -> float:
    try:
        return float(os.getenv("LLM_TIMEOUT", str(_DEFAULT_TIMEOUT)))
    except (TypeError, ValueError):
        return _DEFAULT_TIMEOUT


def _get_ssl_verify():
    ca = os.getenv("REQUESTS_CA_BUNDLE", "").strip()
    if ca and os.path.exists(ca):
        return ca
    return True


def _get_http_session():
    try:
        import voice.whatsapp_client as _wa
        return _wa.get_http_session()
    except Exception:
        import requests
        return requests.Session()


def _strip_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Provider helpers
# ---------------------------------------------------------------------------
def get_provider() -> str:
    return os.getenv("LLM_PROVIDER", "mock").strip().lower()


def get_model() -> str:
    prov  = get_provider()
    model = os.getenv("LLM_MODEL", "").strip()
    if not model:
        if prov == "gpt6luna":
            return _DEFAULT_GPT6_MODEL
        elif prov in ("gemini", "google"):
            return _DEFAULT_GEMINI_MODEL
        return "gpt-4o-mini"
    return model


def get_api_key() -> str:
    return os.getenv("LLM_API_KEY", "").strip()


def get_api_base() -> str:
    prov = get_provider()
    base = os.getenv("LLM_API_BASE", "").strip()
    if not base:
        if prov == "gpt6luna":
            return _GPT6_LUNA_BASE
        elif prov in ("gemini", "google"):
            return _GEMINI_BASE
        return "https://api.openai.com/v1"
    return base.rstrip("/")


def is_llm_active() -> bool:
    prov = get_provider()
    key  = get_api_key()
    return bool(key and prov in {"gpt6luna", "openai", "gemini", "google", "ollama"})


# ---------------------------------------------------------------------------
# GPT-6 Luna (OpenAI Chat Completions API)
# ---------------------------------------------------------------------------
def _call_gpt6_luna(
    prompt: str,
    system_prompt: str = "",
    response_format: str = "json_object",
    temperature: float = 0.05,
) -> Optional[str]:
    api_key   = get_api_key()
    if not api_key:
        logger.warning("[GPT6_LUNA] API key not configured.")
        return None

    model     = get_model()
    base_url  = get_api_base()
    timeout   = _get_timeout()
    verify    = _get_ssl_verify()
    reasoning = os.getenv("LLM_REASONING_EFFORT", "medium").strip().lower()

    url     = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload: Dict[str, Any] = {
        "model":       model,
        "messages":    messages,
        "temperature": temperature,
    }
    if response_format == "json_object":
        payload["response_format"] = {"type": "json_object"}
    if reasoning in {"none", "low", "medium", "high", "xhigh"}:
        payload["reasoning"] = {"effort": reasoning}

    t0 = time.monotonic()
    try:
        session = _get_http_session()
        resp    = session.post(url, json=payload, headers=headers, timeout=timeout, verify=verify)
        elapsed = time.monotonic() - t0
        resp.raise_for_status()
        data    = resp.json()
        content = data["choices"][0]["message"]["content"]
        tokens  = data.get("usage", {})
        logger.info(
            "[GPT6_LUNA] model=%s latency=%.2fs prompt=%s completion=%s",
            model, elapsed,
            tokens.get("prompt_tokens", "?"),
            tokens.get("completion_tokens", "?"),
        )
        print(
            f"[GPT6_LUNA] model={model} latency={elapsed:.2f}s "
            f"prompt_tokens={tokens.get('prompt_tokens','?')} "
            f"completion_tokens={tokens.get('completion_tokens','?')}"
        )
        return content
    except Exception as exc:
        elapsed = time.monotonic() - t0
        logger.error("[GPT6_LUNA] call failed after %.2fs: %s", elapsed, exc)
        print(f"[GPT6_LUNA] API error after {elapsed:.2f}s: {exc}")
        return None


# ---------------------------------------------------------------------------
# OpenAI-compatible (generic / Groq / Ollama)
# ---------------------------------------------------------------------------
def _call_openai_compatible(
    prompt: str,
    system_prompt: str = "",
    response_format: str = "json_object",
    temperature: float = 0.05,
    model_override: str = "",
    api_key_override: str = "",
    base_url_override: str = "",
) -> Optional[str]:
    api_key  = api_key_override or get_api_key()
    if not api_key:
        return None

    model    = model_override or get_model()
    base_url = base_url_override or get_api_base()
    timeout  = _get_timeout()
    verify   = _get_ssl_verify()

    url     = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload: Dict[str, Any] = {
        "model": model, "messages": messages, "temperature": temperature,
    }
    if response_format == "json_object":
        payload["response_format"] = {"type": "json_object"}

    t0 = time.monotonic()
    try:
        session = _get_http_session()
        resp    = session.post(url, json=payload, headers=headers, timeout=timeout, verify=verify)
        elapsed = time.monotonic() - t0
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        logger.info("[OPENAI_COMPAT] model=%s latency=%.2fs", model, elapsed)
        print(f"[OPENAI_COMPAT] model={model} latency={elapsed:.2f}s")
        return content
    except Exception as exc:
        elapsed = time.monotonic() - t0
        logger.error("[OPENAI_COMPAT] call failed after %.2fs: %s", elapsed, exc)
        print(f"[OPENAI_COMPAT] API error after {elapsed:.2f}s: {exc}")
        return None


# ---------------------------------------------------------------------------
# Gemini (Google REST generateContent)
# ---------------------------------------------------------------------------
def _call_gemini(
    prompt: str,
    system_prompt: str = "",
    response_format: str = "json_object",
    temperature: float = 0.05,
) -> Optional[str]:
    api_key = get_api_key()
    if not api_key:
        return None

    model_env = get_model().strip()
    timeout   = _get_timeout()
    verify    = _get_ssl_verify()

    if "3.6" in model_env:
        primary = "gemini-3.6-flash"
    elif "2.5" in model_env:
        primary = "gemini-2.5-flash"
    elif "2.0" in model_env:
        primary = "gemini-2.0-flash"
    elif model_env:
        primary = model_env
    else:
        primary = _DEFAULT_GEMINI_MODEL

    models_to_try = [primary, "gemini-2.0-flash", "gemini-1.5-flash"]
    seen: set     = set()

    contents = []
    if system_prompt:
        contents.append({"role": "user",  "parts": [{"text": system_prompt}]})
        contents.append({"role": "model", "parts": [{"text": "Understood. I am the Meridian Hospital AI Patient Desk."}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    gen_cfg: Dict[str, Any] = {"temperature": temperature, "maxOutputTokens": 1024}
    if response_format == "json_object":
        gen_cfg["responseMimeType"] = "application/json"

    payload = {"contents": contents, "generationConfig": gen_cfg}

    t0 = time.monotonic()
    for m in [x for x in models_to_try if not (x in seen or seen.add(x))]:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{m}:generateContent?key={api_key}"
        )
        try:
            session = _get_http_session()
            resp    = session.post(url, json=payload,
                                   headers={"Content-Type": "application/json"},
                                   timeout=timeout, verify=verify)
            elapsed = time.monotonic() - t0
            if resp.status_code == 404 and m != models_to_try[-1]:
                logger.warning("[GEMINI] Model %s not found, trying fallback.", m)
                continue
            resp.raise_for_status()
            parts = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
            if parts:
                logger.info("[GEMINI] model=%s latency=%.2fs", m, elapsed)
                print(f"[GEMINI] model={m} latency={elapsed:.2f}s")
                return parts[0].get("text", "")
        except Exception as exc:
            elapsed = time.monotonic() - t0
            if "404" in str(exc) and m != models_to_try[-1]:
                logger.warning("[GEMINI] Model %s error, trying fallback: %s", m, exc)
                continue
            logger.error("[GEMINI] call failed after %.2fs: %s", elapsed, exc)
            print(f"[GEMINI] API error after {elapsed:.2f}s: {exc}")
            break
    return None


# ---------------------------------------------------------------------------
# Unified public entry point
# ---------------------------------------------------------------------------
def call_llm(
    prompt: str,
    system_prompt: str = "",
    response_format: str = "json_object",
    temperature: float = 0.05,
) -> Optional[str]:
    """
    Primary entry point for all LLM calls.

    Routes based on LLM_PROVIDER env var:
      gpt6luna  -> GPT-6 Luna (gpt-6-luna)
      openai    -> OpenAI Chat Completions
      gemini/google -> Google Gemini generateContent
      ollama    -> OpenAI-compatible local model
      mock/other -> None (rule-based fallback)

    Returns raw string or None.
    """
    if os.environ.get("SKIP_REMOTE_LLM") == "true":
        return None

    prov = get_provider()

    if prov == "gpt6luna":
        return _call_gpt6_luna(
            prompt=prompt, system_prompt=system_prompt,
            response_format=response_format, temperature=temperature,
        )
    elif prov == "openai":
        return _call_openai_compatible(
            prompt=prompt, system_prompt=system_prompt,
            response_format=response_format, temperature=temperature,
        )
    elif prov in ("gemini", "google"):
        return _call_gemini(
            prompt=prompt, system_prompt=system_prompt,
            response_format=response_format, temperature=temperature,
        )
    elif prov == "ollama":
        return _call_openai_compatible(
            prompt=prompt, system_prompt=system_prompt,
            response_format=response_format, temperature=temperature,
            base_url_override=get_api_base(),
            api_key_override="ollama",
        )
    # mock / unknown
    return None


# ---------------------------------------------------------------------------
# Shared JSON parser
# ---------------------------------------------------------------------------
def parse_json_response(raw: Optional[str]) -> Optional[dict]:
    """Parses LLM JSON output. Handles markdown fences. Returns dict or None."""
    if not raw:
        return None
    clean = _strip_fence(raw)
    try:
        result = json.loads(clean)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", clean)
    if match:
        try:
            result = json.loads(match.group(0))
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass
    logger.warning("[LLM_PROVIDERS] JSON parse failed: %s", raw[:300])
    return None


# ---------------------------------------------------------------------------
# Schema validator for intent-router output
# ---------------------------------------------------------------------------
_REQUIRED_INTENT_FIELDS = {
    "intent", "confidence", "symptoms", "medical_reason",
    "department", "booking_for", "language", "emergency",
}


def validate_intent_schema(parsed: dict) -> Tuple[bool, List[str]]:
    """Returns (is_valid, missing_fields) for LLM intent output."""
    missing = [f for f in _REQUIRED_INTENT_FIELDS if f not in parsed]
    return (len(missing) == 0, missing)


# ---------------------------------------------------------------------------
# Health check / connectivity probe
# ---------------------------------------------------------------------------
def ping_llm_provider() -> Dict[str, Any]:
    """
    Sends a minimal probe to the configured LLM provider.
    Returns dict: {provider, model, status, latency_ms, error}
    """
    prov  = get_provider()
    model = get_model()
    result: Dict[str, Any] = {
        "provider":   prov,
        "model":      model,
        "status":     "unknown",
        "latency_ms": None,
        "error":      None,
    }
    if prov == "mock":
        result["status"] = "mock (no remote call)"
        return result

    probe = '{"status": "ok", "provider": "meridian_test"}'
    probe_prompt = f"Respond with ONLY valid JSON exactly as shown: {probe}"
    t0  = time.monotonic()
    raw = call_llm(prompt=probe_prompt, response_format="json_object", temperature=0.0)
    result["latency_ms"] = round((time.monotonic() - t0) * 1000, 1)

    if raw is None:
        result["status"] = "error"
        result["error"]  = "No response from LLM provider"
        return result

    parsed = parse_json_response(raw)
    if parsed and parsed.get("status") == "ok":
        result["status"] = "ok"
    else:
        result["status"] = "degraded"
        result["error"]  = f"Unexpected response: {(raw or '')[:200]}"
    return result
